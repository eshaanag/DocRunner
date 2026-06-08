# DocRunner Technical Requirements Document

## 1. System Overview

DocRunner has four main surfaces:

- CLI package: parses markdown, executes snippets, reports results, and powers the GitHub Action.
- GitHub Action: runs DocRunner in CI and posts or updates PR comments.
- Dashboard package: serves the public leaderboard, badge endpoint, and repo detail pages.
- Execution layer: runs Python, JavaScript, TypeScript, and Bash snippets in isolated subprocesses.

The CLI is the source of truth for parsing, config validation, result classification, reporters, and AI fix suggestions. The dashboard receives aggregate counts only.

## 2. Architecture

```text
README.md / docs/**/*.md
        |
        v
Config loader + markdown parser
        |
        v
ParsedBlock[] -> skip detector -> executable blocks
        |
        v
Language dispatcher
        |
        +--> Python subprocess
        +--> Node.js subprocess
        +--> Bash subprocess
        +--> ts-node subprocess
        |
        v
ExecutionResult[]
        |
        +--> Console reporter
        +--> JSON reporter
        +--> GitHub PR formatter
        +--> AI fix suggester on failures
        +--> Leaderboard aggregate payload
```

## 3. Parser Requirements

The parser must use `unified` and `remark-parse`. It must not parse markdown code fences with regular expressions.

For each markdown file, it returns `ParsedBlock[]`:

- Fenced code blocks only.
- Supported languages only unless `list` mode requests all known blocks.
- Language aliases normalized.
- Heading is nearest preceding h1, h2, or h3.
- Name override comes from `<!-- docrunner: name="..." -->` immediately before a block.
- Setup marker comes from `<!-- docrunner: setup -->` immediately before a block.
- Skip marker comes from `<!-- docrunner: skip -->` immediately before a block.
- Start line is source line from markdown position metadata.
- ID is deterministic hash of file path, start line, normalized language, and code hash.

## 4. Language Normalization

```text
python, python3, py -> python
javascript, js, node -> javascript
typescript, ts -> typescript
bash, sh, shell -> bash
```

Unsupported languages are ignored by `run` and `check` unless future config enables strict unsupported-language reporting.

## 5. Skip Detection

The skip detector runs before execution. It produces a clear `skipReason`.

Built-in auto-skip patterns:

- Contains `YOUR_API_KEY`, `YOUR_TOKEN`, `{YOUR_`, `<your-`, or `<YOUR-`.
- Contains `<placeholder>` or common placeholder syntax.
- Contains a line where trimmed content is exactly `...`.
- Contains a line where trimmed content is exactly `# TODO` or `# FIXME`.
- Every non-empty line starts with `$ `, indicating a shell transcript.
- Starts with `>`, indicating blockquote-style output.
- One-line block contains only a URL.
- Contains a shebang other than `#!/bin/bash` or `#!/usr/bin/env python`.
- Matches user-defined `skip_patterns`.

Manual skip has highest priority and uses reason `manual skip directive`.

## 6. Result Scoring Algorithm

Each block receives one of five statuses:

- `pass`: process exits with code 0.
- `fail`: process exits with non-zero code before timeout.
- `timeout`: process exceeds configured timeout and is killed.
- `error`: DocRunner could not start or manage the process.
- `skipped`: block was not executed due to directive or heuristic.

Confidence:

- High: manual skip, pass, fail with captured stderr, timeout.
- Medium: auto-skip by strong placeholder pattern.
- Low: auto-skip by weak heuristic such as transcript detection.

Confidence is used internally for messaging and future analytics, not for changing pass/fail behavior.

## 7. Execution Isolation

Every executable block runs in a fresh temporary directory unless it is paired with a setup block. The temp directory is removed in a `finally` path after execution.

Environment:

- Always set `DOCRUNNER=1`.
- Set `HOME=/tmp`.
- Set a minimal `PATH` sufficient for Python, Node, Bash, and ts-node.
- Add `config.env` keys.
- Do not pass through the host environment wholesale.

Timeout:

- Default is 10 seconds.
- Configurable through `docrunner.yml`.
- Timeout kills the process tree where supported.
- Timeout reports `timeout`, not `fail`.

## 8. Language Runners

### Python

Write code to `script.py`, run `python3 script.py`, capture stdout, stderr, exit code, duration, and timeout. If `python3` is missing, return `error` with a helpful message.

### JavaScript

Write code to `script.js` or `script.mjs`. Use `.mjs` when import/export syntax appears. Run through `node`. If ESM code needs `require`, inject a compatible `createRequire` shim only when safe and necessary.

### Bash

Write code to `script.sh`. Run `bash -e script.sh`. Do not run as root. Treat non-zero command exits as `fail`.

### TypeScript

Write code to `script.ts`. Run `ts-node --transpile-only script.ts`. Missing `ts-node` returns an `error` explaining how to install `ts-node` and `typescript`.

## 9. Setup Blocks

A block marked `<!-- docrunner: setup -->` is infrastructure, not a reported test. It runs before the next non-setup block of the same language. File side effects persist into that next block's temp directory. Runtime variables do not persist across separate processes unless setup writes files or config commands create state.

Project-level setup commands in config run before each block for the matching language in that block's temp directory.

## 10. GitHub Action Integration

The action runs `docrunner check`. It exits 0 when all blocks pass or are skipped and exits 1 when any block fails or times out. With `github-token`, it posts an idempotent PR comment by searching for an existing DocRunner marker and updating it.

Permissions needed:

- `contents: read`
- `pull-requests: write` for PR comments

When no token exists, the action still runs and prints console output.

## 11. AI Fix Suggestion Pipeline

Trigger only when:

- A block has status `fail`.
- `ai_suggestions` is true.
- `ANTHROPIC_API_KEY` is set.
- Cache miss for the failure hash.

Prompt input:

- File path.
- Section/name.
- Language.
- Line.
- Failing code.
- Stderr.
- Surrounding README context.

Never send skipped blocks. Automated tests must use a mock.

Prompt template:

~~~text
You are a code documentation assistant helping fix a broken README code example.

A README code block has failed execution. Your job is to suggest a minimal,
correct fix that makes the example work while keeping it readable.

## Context
File: {file}
Section: {heading}
Language: {language}
Line: {line}

## The failing code
```{language}
{code}
```

## The error
```
{stderr}
```

## Surrounding README context (for understanding intent)
{surroundingText}

## Instructions
1. Diagnose the root cause in one sentence.
2. Provide the corrected code block (minimal change, preserve the example's intent).
3. Add a one-line comment on the line you changed explaining why.
4. Do NOT add unnecessary imports or boilerplate.
5. If the fix requires an environment variable or external service, note this briefly.
6. If the code appears to be pseudocode or illustrative (not meant to run),
   say so and suggest adding <!-- docrunner: skip --> instead.

Respond in this exact format:
DIAGNOSIS: <one sentence>
FIXED_CODE:
```{language}
<corrected code here>
```
NOTE: <optional one-line note about requirements, or empty>
~~~

## 12. Leaderboard API

The leaderboard receives aggregate run data:

- Owner.
- Repo name.
- Stars.
- Pass count.
- Fail count.
- Skip count.
- Last run timestamp.
- Badge color.

It never stores:

- Code.
- Output.
- Error text.
- File names.
- Branch names.
- Private repo data.

Writes require `LEADERBOARD_SECRET`. Reads are public.

## 13. Core Interfaces

```typescript
export interface ParsedBlock {
  id: string;
  file: string;
  language: "python" | "javascript" | "typescript" | "bash";
  code: string;
  startLine: number;
  heading: string | null;
  name: string | null;
  isSetup: boolean;
  skipReason: string | null;
}

export interface ExecutionResult {
  blockId: string;
  status: "pass" | "fail" | "error" | "skipped" | "timeout";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  skipReason: string | null;
  errorMessage: string | null;
}

export interface DocRunnerConfig {
  version: 1;
  files: string[];
  languages?: Array<"python" | "javascript" | "typescript" | "bash">;
  timeout: number;
  setup: Partial<Record<"python" | "javascript" | "typescript" | "bash", string>>;
  env: Record<string, string>;
  skip_patterns: string[];
  on_failure: "error" | "warn";
  ai_suggestions: boolean;
}

export interface AISuggestion {
  diagnosis: string;
  fixedCode: string;
  note: string | null;
}

export interface LeaderboardEntry {
  owner: string;
  repo: string;
  stars: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  lastRunAt: string;
  badgeColor: "brightgreen" | "green" | "yellow" | "orange";
}

export interface PRComment {
  summary: string;
  markdown: string;
  hasFailures: boolean;
}
```

## 14. Pydantic Models

```python
from pydantic import BaseModel, Field
from typing import Literal

class RunnerBlock(BaseModel):
    id: str
    language: Literal["python", "javascript", "typescript", "bash"]
    code: str
    start_line: int = Field(ge=1)
    timeout: int = Field(gt=0, le=300)

class RunnerResult(BaseModel):
    block_id: str
    status: Literal["pass", "fail", "error", "timeout"]
    exit_code: int | None
    stdout: str
    stderr: str
    duration_ms: int
    error_message: str | None
```

## 15. Config Schema

`docrunner.yml` defaults:

```yaml
version: 1
files:
  - README.md
timeout: 10
setup: {}
env: {}
skip_patterns: []
on_failure: error
ai_suggestions: false
```

Full schema is defined in `docs/SCHEMA.md` and implemented with Zod.
