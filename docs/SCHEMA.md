# DocRunner Data Models and Config Schema

## 1. TypeScript Models

```typescript
export type SupportedLanguage = "python" | "javascript" | "typescript" | "bash";

export type ExecutionStatus = "pass" | "fail" | "error" | "skipped" | "timeout";

export interface ParsedBlock {
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

export interface ExecutionResult {
  blockId: string;
  status: ExecutionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  skipReason: string | null;
  errorMessage: string | null;
}

export interface AISuggestion {
  diagnosis: string;
  fixedCode: string;
  note: string | null;
}

export interface DocRunnerConfig {
  version: 1;
  files: string[];
  languages?: SupportedLanguage[];
  timeout: number;
  setup: Partial<Record<SupportedLanguage, string>>;
  env: Record<string, string>;
  skip_patterns: string[];
  on_failure: "error" | "warn";
  ai_suggestions: boolean;
  leaderboard?: LeaderboardConfig;
}

export interface LeaderboardConfig {
  enabled: boolean;
  endpoint: string;
}

export interface PRComment {
  summary: string;
  markdown: string;
  hasFailures: boolean;
  aiSuggestionsIncluded: boolean;
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

export interface JsonRunOutput {
  version: 1;
  files: string[];
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    timedOut: number;
    errors: number;
    durationMs: number;
  };
  blocks: ParsedBlock[];
  results: ExecutionResult[];
}
```

## 2. Zod Schemas

```typescript
import { z } from "zod";

export const supportedLanguageSchema = z.enum([
  "python",
  "javascript",
  "typescript",
  "bash",
]);

export const docRunnerConfigSchema = z.object({
  version: z.literal(1),
  files: z.array(z.string().min(1)).min(1).default(["README.md"]),
  languages: z.array(supportedLanguageSchema).optional(),
  timeout: z.number().int().positive().max(300).default(10),
  setup: z.record(supportedLanguageSchema, z.string()).default({}),
  env: z.record(z.string(), z.string()).default({}),
  skip_patterns: z.array(z.string().min(1)).default([]),
  on_failure: z.enum(["error", "warn"]).default("error"),
  ai_suggestions: z.boolean().default(false),
  leaderboard: z
    .object({
      enabled: z.boolean().default(false),
      endpoint: z.string().url().default("https://docrunner.dev/api/leaderboard"),
    })
    .optional(),
});

export const leaderboardPayloadSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  stars: z.number().int().nonnegative(),
  passCount: z.number().int().nonnegative(),
  failCount: z.number().int().nonnegative(),
  skipCount: z.number().int().nonnegative(),
  lastRunAt: z.string().datetime(),
});

export const githubActionInputSchema = z.object({
  githubToken: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  config: z.string().optional(),
  files: z.string().optional(),
  leaderboard: z.string().optional(),
});
```

## 3. Pydantic Runner Models

```python
from typing import Literal
from pydantic import BaseModel, Field

SupportedLanguage = Literal["python", "javascript", "typescript", "bash"]
RunnerStatus = Literal["pass", "fail", "error", "timeout"]

class RunnerBlock(BaseModel):
    """Executable block payload passed to the runner."""

    id: str
    language: SupportedLanguage
    code: str
    start_line: int = Field(ge=1)
    timeout: int = Field(gt=0, le=300)
    env: dict[str, str] = Field(default_factory=dict)

class RunnerResult(BaseModel):
    """Execution result returned by the runner."""

    block_id: str
    status: RunnerStatus
    exit_code: int | None
    stdout: str
    stderr: str
    duration_ms: int = Field(ge=0)
    error_message: str | None
```

## 4. `docrunner.yml` Schema

Full example:

```yaml
version: 1

files:
  - README.md
  - docs/**/*.md

languages:
  - python
  - bash
  - javascript
  - typescript

timeout: 10

setup:
  python: |
    pip install -r requirements.txt
  javascript: |
    npm install
  typescript: |
    npm install
  bash: |
    echo "setup complete"

env:
  API_URL: "http://localhost:3000"

skip_patterns:
  - "YOUR_"
  - "<placeholder>"

on_failure: error
ai_suggestions: true

leaderboard:
  enabled: false
  endpoint: "https://docrunner.dev/api/leaderboard"
```

Field table:

| Field | Type | Default | Required | Description |
|---|---|---:|---|---|
| `version` | literal `1` | none | yes | Config schema version. |
| `files` | string array | `["README.md"]` | no | Markdown globs to scan. |
| `languages` | language array | all supported | no | Languages to execute. |
| `timeout` | integer seconds | `10` | no | Per-block timeout. |
| `setup` | language to command map | `{}` | no | Commands run before blocks by language. |
| `env` | string map | `{}` | no | Environment variables injected into executions. |
| `skip_patterns` | string array | `[]` | no | Additional auto-skip patterns. |
| `on_failure` | `error` or `warn` | `error` | no | CI exit behavior. |
| `ai_suggestions` | boolean | `false` | no | Whether failures request AI suggestions. |
| `leaderboard.enabled` | boolean | `false` | no | Whether to publish aggregate results. |
| `leaderboard.endpoint` | URL | DocRunner endpoint | no | Leaderboard API endpoint. |

## 5. GitHub Action Schema

`action/action.yml` inputs:

```yaml
inputs:
  github-token:
    description: "GitHub token used to post or update PR comments"
    required: false
  anthropic-api-key:
    description: "Anthropic API key used for optional AI fix suggestions"
    required: false
  config:
    description: "Path to docrunner.yml"
    required: false
    default: "docrunner.yml"
  files:
    description: "Optional markdown file or glob override"
    required: false
  leaderboard:
    description: "Whether to publish aggregate results to the leaderboard"
    required: false
    default: "false"
```

Outputs:

```yaml
outputs:
  passed:
    description: "Number of passing blocks"
  failed:
    description: "Number of failing blocks"
  skipped:
    description: "Number of skipped blocks"
  timed-out:
    description: "Number of timed out blocks"
  errors:
    description: "Number of runner errors"
```

## 6. Leaderboard Database Schema

SQLite:

```sql
CREATE TABLE leaderboard_entries (
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  pass_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  skip_count INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT NOT NULL,
  badge_color TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner, repo)
);

CREATE INDEX idx_leaderboard_sort
ON leaderboard_entries (pass_count DESC, stars DESC, last_run_at DESC);
```

Badge color is precomputed from pass rate:

```text
100 percent pass -> brightgreen
80 to 99 percent -> green
60 to 79 percent -> yellow
below 60 percent -> orange
```

## 7. JSON Output for `--json`

```json
{
  "version": 1,
  "files": ["README.md"],
  "summary": {
    "passed": 2,
    "failed": 1,
    "skipped": 1,
    "timedOut": 0,
    "errors": 0,
    "durationMs": 880
  },
  "blocks": [
    {
      "id": "README-23-python-a1b2",
      "file": "README.md",
      "language": "python",
      "code": "client.get('/endpoint')",
      "startLine": 23,
      "heading": "Quick Start",
      "name": null,
      "isSetup": false,
      "skipReason": null
    }
  ],
  "results": [
    {
      "blockId": "README-23-python-a1b2",
      "status": "fail",
      "exitCode": 1,
      "stdout": "",
      "stderr": "NameError: name 'client' is not defined",
      "durationMs": 823,
      "skipReason": null,
      "errorMessage": null
    }
  ]
}
```

## 8. AI Fix Suggestion Prompt

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
