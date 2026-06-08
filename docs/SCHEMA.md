# DocRunner Schemas

## TypeScript Data Models

```typescript
export type SupportedLanguage = "python" | "javascript" | "typescript" | "bash";
export type ExecutionStatus = "pass" | "fail" | "error" | "skipped" | "timeout";
export type FailureMode = "error" | "warn";

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
  on_failure: FailureMode;
  ai_suggestions: boolean;
  leaderboard?: {
    enabled: boolean;
    endpoint: string;
  };
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
```

## Zod External Input Schemas

```typescript
const supportedLanguageSchema = z.enum(["python", "javascript", "typescript", "bash"]);

const docRunnerConfigSchema = z.object({
  version: z.literal(1).default(1),
  files: z.array(z.string().min(1)).min(1).default(["README.md"]),
  languages: z.array(supportedLanguageSchema).optional(),
  timeout: z.number().int().min(1).max(300).default(10),
  setup: z.record(supportedLanguageSchema, z.string()).default({}),
  env: z.record(z.string(), z.string()).default({}),
  skip_patterns: z.array(z.string().min(1)).default([]),
  on_failure: z.enum(["error", "warn"]).default("error"),
  ai_suggestions: z.boolean().default(false),
  leaderboard: z.object({
    enabled: z.boolean().default(false),
    endpoint: z.string().url().default("https://docrunner.dev/api/leaderboard")
  }).optional()
});

const leaderboardWriteSchema = z.object({
  owner: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  repo: z.string().regex(/^[A-Za-z0-9_.-]+$/),
  stars: z.number().int().min(0),
  passCount: z.number().int().min(0),
  failCount: z.number().int().min(0),
  skipCount: z.number().int().min(0),
  lastRunAt: z.string().datetime()
});
```

## Pydantic Models

```python
from typing import Literal
from pydantic import BaseModel, Field

SupportedLanguage = Literal["python", "javascript", "typescript", "bash"]

class RunnerConfig(BaseModel):
    timeout: int = Field(default=10, ge=1, le=300)
    env: dict[str, str] = Field(default_factory=dict)
    setup: dict[SupportedLanguage, str] = Field(default_factory=dict)

class RunnerBlock(BaseModel):
    id: str
    file: str
    language: SupportedLanguage
    code: str
    start_line: int = Field(ge=1)
    is_setup: bool = False

class RunnerResult(BaseModel):
    block_id: str
    status: Literal["pass", "fail", "error", "timeout"]
    exit_code: int | None
    stdout: str
    stderr: str
    duration_ms: int = Field(ge=0)
    error_message: str | None
```

## `docrunner.yml`

```yaml
version: 1
files:
  - README.md
  - docs/**/*.md
languages:
  - python
  - bash
  - javascript
timeout: 10
setup:
  python: |
    pip install -r requirements.txt
  javascript: |
    npm install
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

Defaults:

| Field | Type | Default |
|---|---|---|
| `version` | literal `1` | `1` |
| `files` | string[] | `["README.md"]` |
| `languages` | supported language[] | all supported |
| `timeout` | integer 1-300 | `10` |
| `setup` | language-command map | `{}` |
| `env` | string map | `{}` |
| `skip_patterns` | string[] | `[]` |
| `on_failure` | `error` or `warn` | `error` |
| `ai_suggestions` | boolean | `false` |
| `leaderboard.enabled` | boolean | `false` |

## GitHub Action Schema

```yaml
name: DocRunner
description: Test README code examples and optionally post PR comments.
inputs:
  github-token:
    description: Token used to create or update a pull request comment.
    required: false
  anthropic-api-key:
    description: Optional Claude API key for fix suggestions.
    required: false
  config:
    description: Path to docrunner.yml.
    required: false
    default: docrunner.yml
  leaderboard-secret:
    description: Shared secret for opt-in leaderboard writes.
    required: false
outputs:
  summary:
    description: Human-readable result summary.
  json:
    description: Machine-readable DocRunner result JSON.
```

## SQLite Leaderboard Schema

```sql
CREATE TABLE repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner, repo)
);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  pass_count INTEGER NOT NULL,
  fail_count INTEGER NOT NULL,
  skip_count INTEGER NOT NULL,
  pass_rate REAL NOT NULL,
  badge_color TEXT NOT NULL,
  run_at TEXT NOT NULL
);
```

## AI Prompt Template

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

## JSON Output

```json
{
  "schemaVersion": 1,
  "files": ["README.md"],
  "summary": {
    "passed": 3,
    "failed": 1,
    "skipped": 2,
    "timeout": 0,
    "error": 0,
    "durationMs": 912
  },
  "results": [
    {
      "blockId": "readme-23-python-abc123",
      "file": "README.md",
      "heading": "Quick Start",
      "name": null,
      "language": "python",
      "line": 23,
      "status": "fail",
      "exitCode": 1,
      "stdout": "",
      "stderr": "NameError: name 'client' is not defined",
      "durationMs": 823,
      "skipReason": null,
      "errorMessage": null,
      "aiSuggestion": null
    }
  ]
}
```
