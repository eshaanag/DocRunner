# DocRunner Technical Requirements

## System Architecture

DocRunner has four deployable surfaces:

- CLI package: TypeScript command surface, config validation, markdown parsing, execution
  dispatch, reporting, AI suggestions, and leaderboard publishing.
- GitHub Action: Docker-based wrapper that runs the CLI in a consistent CI image and posts
  idempotent PR comments.
- Dashboard: Next.js leaderboard, repository detail pages, badge endpoint, and aggregate
  registration API.
- Python runner module: typed subprocess helpers and validation models for future deeper
  language execution isolation.

~~~text
Markdown files + docrunner.yml
        |
        v
Config loader (Zod) -> file resolver -> remark AST parser
        |
        v
ParsedBlock[] -> directive parser -> skip detector -> execution plan
        |
        +--> skipped result
        +--> python subprocess
        +--> node subprocess
        +--> bash subprocess
        +--> ts-node subprocess
        |
        v
ExecutionResult[] -> console/json/GitHub reporters
        |
        +--> Claude fix suggestions for eligible failures
        +--> aggregate leaderboard payload
~~~

## Parser

The parser uses `unified` and `remark-parse` with position metadata. Regex is allowed only
inside a fenced block after the AST has already identified code nodes.

For each markdown file:

1. Parse the file into mdast.
2. Walk top-level and nested nodes in source order.
3. Track nearest preceding h1, h2, or h3 text.
4. Track immediately preceding HTML directives:
   - `<!-- docrunner: skip -->`
   - `<!-- docrunner: setup -->`
   - `<!-- docrunner: name="Quick Start" -->`
5. For each `code` node, normalize the language and ignore unsupported languages unless
   listing all blocks.
6. Compute `startLine` from `node.position.start.line`.
7. Compute deterministic `id` from normalized file path, line, language, and code hash.
8. Apply manual skip first, then heuristic skip detection.
9. Return `ParsedBlock[]` with heading, optional name, setup flag, and skip reason.

Language aliases:

| Input | Normalized |
|---|---|
| `python`, `python3`, `py` | `python` |
| `javascript`, `js`, `node` | `javascript` |
| `typescript`, `ts` | `typescript` |
| `bash`, `sh`, `shell` | `bash` |

## Skip System

Manual skip has highest priority. Built-in heuristic skips are visible and reversible.

Auto-skip patterns:

- `YOUR_API_KEY`, `YOUR_TOKEN`, `{YOUR_`, `<your-`, `<YOUR-`, `<placeholder>`.
- A trimmed line that is exactly `...`.
- A trimmed line that is exactly `# TODO` or `# FIXME`.
- Every non-empty line starts with `$ `.
- Trimmed block starts with `>`.
- Single-line block is only an HTTP(S) URL.
- First line shebang is neither `#!/bin/bash` nor `#!/usr/bin/env python`.
- Any user-defined literal `skip_patterns` value appears in the block.

Skip confidence is recorded internally:

- High: manual directive, strong placeholder, configured pattern.
- Medium: ellipsis, TODO/FIXME, unsupported shebang.
- Low: transcript or URL-only heuristics.

Confidence affects messaging and future analysis only; skipped blocks are never failures.

## Execution Runner

Each executable block runs in a fresh temporary directory. A setup block and its following
target block share one temporary directory so file side effects persist only within that
pair. The directory is removed in `finally` even after failure or timeout.

Environment:

- Always set `DOCRUNNER=1`.
- Always set `HOME=/tmp`.
- Set a minimal `PATH` that can locate required runtimes.
- Add only keys from `config.env`.
- Never pass through the host environment wholesale.

Timeout:

- Default 10 seconds, max 300 seconds.
- Kill the process tree where supported.
- Classify as `timeout`, not `fail`.
- Message includes the block location and config guidance.

Language behavior:

| Language | File | Command | Notes |
|---|---|---|---|
| Python | `script.py` | `python3 script.py` | Missing runtime is `error`. |
| JavaScript | `script.js` or `script.mjs` | `node script.*` | Use `.mjs` for import/export syntax. |
| Bash | `script.sh` | `bash -e script.sh` | Fail fast on command errors. |
| TypeScript | `script.ts` | `ts-node --transpile-only script.ts` | Missing ts-node explains install command. |

## Result Scoring Algorithm

| Status | Meaning | Blocks CI? |
|---|---|---|
| `pass` | Process exited 0 | No |
| `fail` | Process exited non-zero | Yes unless `on_failure: warn` |
| `timeout` | Process exceeded timeout and was killed | Yes unless `on_failure: warn` |
| `error` | DocRunner could not start/manage execution | Yes unless `on_failure: warn` |
| `skipped` | Manual or heuristic skip | No |

All results include duration, stdout, stderr, exit code where available, skip reason, and
error message where applicable. Setup blocks are not reported as standalone test results.

## GitHub Action

The Docker Action contains Node.js, Python 3, Bash, TypeScript, and ts-node. It runs
`docrunner check` after checkout. Inputs:

- `github-token`: optional token for PR comments.
- `anthropic-api-key`: optional key for AI suggestions.
- `config`: optional config path.
- `leaderboard-secret`: optional aggregate publishing secret.

Comment posting requires `pull-requests: write`. The formatter embeds a hidden marker so
reruns update one existing comment. If no token is present, the Action prints the report and
exits using normal `check` semantics.

## AI Fix Suggestion Pipeline

Trigger only for `fail` when `ai_suggestions: true`, `ANTHROPIC_API_KEY` exists, and the
failure hash misses cache. The request includes only the failing block, bounded stderr, and
bounded surrounding README context.

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

Automated tests always use mocks and never call Claude.

## Leaderboard API

Collected:

- owner, repo, stars.
- pass, fail, skip counts.
- last run ISO timestamp.
- computed badge color and pass rate.

Never collected:

- code, output, errors, file names, branch names, private repo data, usernames, secrets.

Writes are authenticated by `LEADERBOARD_SECRET`, validated with Zod, and stored in SQLite.

## Config Schema

```yaml
version: 1
files:
  - README.md
languages:
  - python
timeout: 10
setup:
  python: |
    pip install -r requirements.txt
env:
  API_URL: "http://localhost:3000"
skip_patterns:
  - "YOUR_"
on_failure: error
ai_suggestions: true
leaderboard:
  enabled: false
  endpoint: "https://docrunner.dev/api/leaderboard"
```

Validation rejects unsupported languages, timeout outside 1-300, non-string environment
values, invalid URLs, unknown failure modes, and empty file patterns.

## TypeScript Contracts

```typescript
type SupportedLanguage = "python" | "javascript" | "typescript" | "bash";
type ExecutionStatus = "pass" | "fail" | "error" | "skipped" | "timeout";

interface ParsedBlock {
  id: string;
  file: string;
  language: SupportedLanguage;
  code: string;
  startLine: number;
  heading: string | null;
  name: string | null;
  isSetup: boolean;
  skipReason: string | null;
}

interface ExecutionResult {
  blockId: string;
  status: ExecutionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  skipReason: string | null;
  errorMessage: string | null;
}

interface DocRunnerConfig {
  version: 1;
  files: string[];
  languages?: SupportedLanguage[];
  timeout: number;
  setup: Partial<Record<SupportedLanguage, string>>;
  env: Record<string, string>;
  skip_patterns: string[];
  on_failure: "error" | "warn";
  ai_suggestions: boolean;
}

interface PRComment {
  summary: string;
  markdown: string;
  hasFailures: boolean;
  aiSuggestionsIncluded: boolean;
}

interface LeaderboardEntry {
  owner: string;
  repo: string;
  stars: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  lastRunAt: string;
  badgeColor: "brightgreen" | "green" | "yellow" | "orange";
}
```

## Pydantic Runner Models

```python
class RunnerBlock(BaseModel):
    id: str
    language: Literal["python", "javascript", "typescript", "bash"]
    code: str
    file: str
    start_line: int
    timeout: int
    env: dict[str, str]

class RunnerResult(BaseModel):
    block_id: str
    status: Literal["pass", "fail", "error", "timeout"]
    exit_code: int | None
    stdout: str
    stderr: str
    duration_ms: int
    error_message: str | None
```
