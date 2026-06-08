# DocRunner Feature Flows

## End-to-End Pull Request Flow

1. A maintainer opts in by adding checkout and `uses: eshaanag/docrunner@v1`.
2. A pull request triggers the Action with repository code and optional secrets.
3. The Action installs a pinned DocRunner release and invokes `docrunner check`.
4. The config loader reads `docrunner.yml` or applies documented defaults.
5. File globs resolve to markdown files; unreadable or empty matches produce clear errors.
6. The AST parser extracts supported fenced blocks, directives, headings, and locations.
7. Skip detection classifies manual skips and strong placeholder/transcript heuristics.
8. Executable blocks are dispatched to fresh language-specific subprocess workspaces.
9. Results are classified as pass, fail, timeout, error, or skipped and aggregated.
10. Failed blocks may receive cached Claude suggestions when explicitly enabled.
11. The Action creates or updates one marker-tagged PR comment.
12. `check` exits according to failures and `on_failure`.
13. When leaderboard registration is enabled, aggregate counts are authenticated and sent.
14. Badge requests reflect the last accepted aggregate run.

## Skip Detection Flow

For each supported block, apply the first matching rule and preserve that reason:

1. If immediately preceded by `<!-- docrunner: skip -->`, skip as `manual directive`.
2. If a configured literal `skip_patterns` value occurs, skip with the matched pattern.
3. If code contains `YOUR_API_KEY`, `YOUR_TOKEN`, `{YOUR_`, `<your-`, `<YOUR-`, or
   `<placeholder>`, skip as a placeholder.
4. If any trimmed line is exactly `...`, `# TODO`, or `# FIXME`, skip as incomplete.
5. If every non-empty line begins with `$ `, skip as a shell transcript.
6. If trimmed code begins with `>`, skip as output/blockquote transcript.
7. If the only line is an HTTP(S) URL, skip as a reference link.
8. If a shebang exists and is not `#!/bin/bash` or `#!/usr/bin/env python`, skip as an
   unsupported runtime declaration.
9. Otherwise, execute the block.

Examples:

| Example                               | Classification | Reason                     |
| ------------------------------------- | -------------- | -------------------------- |
| `client = Client("YOUR_API_KEY")`     | skipped        | placeholder `YOUR_API_KEY` |
| `$ npm install` and `$ npm test`      | skipped        | shell transcript           |
| `curl https://example.test/health`    | executable     | valid Bash command         |
| `https://example.test/docs`           | skipped        | URL-only block             |
| Explicit skip before a runnable block | skipped        | manual directive           |

## Setup Pairing Flow

1. A `<!-- docrunner: setup -->` block is queued for the next non-setup block of the same
   language.
2. DocRunner creates one fresh workspace for the pair.
3. Project-level setup runs first, then the paired setup block, then the test block.
4. File side effects persist inside the pair; process memory does not.
5. Setup failure produces an error tied to the target block and the test block does not run.
6. The setup block is not counted as a test result.
7. An unpaired setup block produces a warning.

## AI Fix Flow

1. Trigger only for runtime `fail`, never pass, skip, timeout, or infrastructure error.
2. Require `ai_suggestions: true` and `ANTHROPIC_API_KEY`.
3. Hash block identity, code, and normalized error; return cached suggestion on a hit.
4. Send file, section, language, line, failing code, bounded error, and bounded surrounding
   README context to Claude. Do not send repository-wide contents.
5. Request a one-sentence diagnosis, minimal corrected block, and optional requirement note.
6. Validate and parse the response. Invalid responses are logged and omitted.
7. Store cache entry and render the suggestion below the matching failure.
8. If Claude is unavailable, continue reporting and state that AI suggestions are unavailable.

## Leaderboard Registration Flow

1. Registration is opt-in through config or an explicit command.
2. DocRunner refuses to register a private repository.
3. The client sends owner, repo, stars, pass/fail/skip counts, and run timestamp only.
4. The API authenticates the write, validates bounds, and upserts the repository and run.
5. Badge color is computed from pass rate and never uses red.
6. Public pages show aggregate counts, last checked time, stars, and history.
7. Code, output, errors, paths, branches, actors, and secrets are never accepted or stored.

## Local `docrunner run` Flow

1. User runs `docrunner run [file]`.
2. DocRunner loads config, applies a file override if supplied, and resolves markdown files.
3. It parses, classifies, executes, and renders a scannable report.
4. Failures include exact location, bounded stderr, timeout/setup guidance, and AI hint.
5. `run` exits zero for exploration; `check` uses CI failure semantics.
6. User fixes examples or adds explicit setup/skip configuration and reruns.

## Crisis Flows

### GitHub API Rate Limited

Keep the check result, log the reset time, retry with bounded exponential backoff while the
job remains viable, and write the full markdown report to job output if posting still fails.
Never hide the actual snippet exit status.

### Claude API Unavailable

Do not retry aggressively. Render all deterministic results and add: "AI suggestions
unavailable; add or verify `ANTHROPIC_API_KEY` and rerun." The check status is unchanged.

### Subprocess Timeout

Kill the process tree, classify `timeout` separately from `fail` and `error`, clean the
workspace, and explain how to raise `timeout` or skip a service-dependent example.

### All Blocks Skipped

Exit zero with a warning: "0 blocks executed. Your README may have no executable examples
or all were auto-skipped. Run with `--verbose` to see why." Never describe this as passing.

### Runtime Missing

Classify as `error`, name the missing executable and affected block, and provide the exact
installation/setup action. Continue independent languages where possible.

### Malformed Config

Stop before execution, list every invalid field with its received value and expected shape,
and preserve the original config file.
