# DocRunner Feature Flows

## 1. GitHub Action Flow

1. Maintainer adds DocRunner action to pull request workflow.
2. Pull request opens or updates.
3. GitHub checks out repository.
4. Action runs `docrunner check`.
5. CLI loads `docrunner.yml` or defaults.
6. CLI discovers target markdown files.
7. Parser extracts fenced blocks.
8. Skip detector marks placeholder or manually skipped blocks.
9. Runner executes remaining blocks in isolated temp directories.
10. Results are aggregated.
11. If failures exist and AI is configured, fix suggestions are requested.
12. PR comment is posted or updated.
13. Process exits 1 on failure or timeout, otherwise 0.
14. Optional leaderboard payload is sent with aggregate counts only.

## 2. Local `docrunner run` Flow

1. User runs `docrunner run` or `docrunner run README.md`.
2. CLI loads config and validates it with Zod.
3. CLI parses markdown and classifies blocks.
4. CLI executes runnable blocks.
5. Console reporter prints scannable table and failure detail.
6. Command exits 0 even when snippets fail.

`run` is exploratory. It should not punish local users for discovering failures.

## 3. CI `docrunner check` Flow

1. User or action runs `docrunner check`.
2. Same parser and execution path as `run`.
3. Results are printed.
4. Command exits 1 if any block has `fail`, `timeout`, or `error`, unless config `on_failure: warn`.

`check` is enforcement. It is the correct CI command.

## 4. Skip Detection Flow

1. Check for manual `<!-- docrunner: skip -->` directive immediately before the block.
2. Check user-defined `skip_patterns`.
3. Check strong placeholder patterns.
4. Check transcript patterns.
5. Check unsupported shebang.
6. Check one-line URL-only block.
7. If none match, mark executable.

Examples:

```python
client = Client("YOUR_API_KEY")
```

Result: skipped, detected placeholder `YOUR_API_KEY`.

```bash
$ npm install docrunner
$ docrunner run
```

Result: skipped, shell transcript.

```python
...
```

Result: skipped, ellipsis placeholder.

```bash
#!/bin/bash
echo "ok"
```

Result: executable.

## 5. Setup Block Flow

1. Parser sees `<!-- docrunner: setup -->`.
2. The following block is marked `isSetup`.
3. Runner stores it as pending setup for the next non-setup block of the same language.
4. Runner creates one temp directory for setup and target block.
5. Project-level setup runs first if configured.
6. Setup block runs and may write files.
7. Target block runs in same temp directory.
8. Setup block is excluded from final result counts.

## 6. AI Fix Flow

1. A block fails with a non-zero exit code.
2. Config has `ai_suggestions: true`.
3. `ANTHROPIC_API_KEY` exists.
4. Cache key is computed from block ID, code hash, language, and stderr hash.
5. On cache hit, cached suggestion is used.
6. On cache miss, prompt is sent to Claude with `max_tokens: 512`.
7. Response is parsed into `AISuggestion`.
8. Suggestion is attached to the failure section in the PR comment or `suggest` output.

If Claude is unavailable, DocRunner reports normal results and adds a short availability note. It must not fail the run because AI was unavailable.

## 7. Leaderboard Registration Flow

1. Maintainer opts in by enabling leaderboard reporting.
2. CLI or action computes aggregate counts.
3. Payload includes owner, repo, stars, pass count, fail count, skip count, and timestamp.
4. Payload is signed or authorized with `LEADERBOARD_SECRET`.
5. API validates payload with Zod.
6. SQLite row is inserted or updated.
7. Badge endpoint reflects latest aggregate state.

No source code, output, file names, branches, or errors are sent.

## 8. Badge Flow

1. README requests `/api/badge/[owner]/[name]`.
2. API looks up latest entry.
3. If no entry exists, return `not registered` and color `lightgrey`.
4. If entry exists, compute message as `passCount/total executable passing`.
5. Return shields.io JSON.

## 9. Crisis Flows

### GitHub API Rate Limited

The action prints results to console, marks PR comment posting as failed with a clear warning, and exits according to snippet results. Future implementation can retry with backoff, but rate limiting must never hide snippet failures.

### Claude API Unavailable

DocRunner skips AI suggestions, reports all execution results, and records `aiSuggestion: null`.

### Subprocess Timeout

Runner kills the process tree, marks status `timeout`, captures available output, and prints timeout-specific guidance.

### All Blocks Skipped

Reporter warns:

```text
0 blocks executed. Your README may have no executable examples or all were auto-skipped.
Run `docrunner list --verbose` to see why.
```

### Missing Runtime

Runner returns `error`, not `fail`, because the snippet did not run. The message names the missing runtime and how to install or configure it.

### Malformed Config

CLI fails before parsing snippets. It prints field-level validation errors and exits 1.
