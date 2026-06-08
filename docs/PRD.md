# DocRunner Product Requirements Document

## 1. Product Summary

DocRunner catches broken README code examples in CI with zero annotations required for the common case. It extracts fenced code blocks from markdown, skips examples that are clearly placeholders or transcripts, executes runnable snippets in isolated environments, reports results locally and in pull requests, and can suggest minimal fixes through Claude when failures occur.

The product outcome is simple: maintainers should trust that the examples users copy from their README still run.

## 2. Problem Statement

README examples are often the first executable interface a developer sees. They also break easily because they live outside normal test suites. Common causes include renamed imports, missing setup steps, changed APIs, stale authentication examples, and snippets that assume hidden state.

DocRunner will quantify the problem during Phase 8 by running against a defined set of popular Python and JavaScript repositories and publishing the results in `docs/ANALYSIS.md`. Until that data is gathered, the product assumes the highest-risk pattern: README examples drift because they are reviewed as prose while users execute them as code.

## 3. Target Users

Primary users are open source maintainers who want fewer broken-example issues without adding annotations to every snippet.

Secondary users are contributors who want a PR check that tells them whether their changes broke project docs.

Tertiary users are library evaluators who want a confidence signal that examples are current before adopting a dependency.

## 4. Personas

### Burnt-Out Maintainer

Maintains a 2,000-star library with a popular quick start. They receive repeated issues saying the example no longer works. They do not want another complex CI tool. They need a two-line action, clear failure output, and almost no false positives.

Success looks like: a PR comment points to the exact README section and line, explains the runtime failure, and offers a minimal corrected snippet.

### New Contributor

Opens a PR that changes public API names. They know tests pass but do not realize the README still imports the old symbol. They need fast feedback before a maintainer has to review documentation breakage manually.

Success looks like: the CI check fails with a precise README failure and a suggested fix they can apply before review.

### Library Evaluator

Compares two libraries and wants to know whether examples are trustworthy. They will not run a full test matrix. They need a lightweight visible signal.

Success looks like: a "docs tested" badge links to a public leaderboard entry showing recent passing documentation checks.

## 5. User Stories

1. As a maintainer, I can add DocRunner to CI with two workflow lines.
2. As a maintainer, I can run `docrunner run` locally without API keys.
3. As a maintainer, I can preview detected snippets with `docrunner list`.
4. As a maintainer, I can skip a block with `<!-- docrunner: skip -->`.
5. As a maintainer, I can define setup commands in `docrunner.yml`.
6. As a maintainer, I can inject safe test environment variables.
7. As a maintainer, I can see why a placeholder block was auto-skipped.
8. As a contributor, I can see exact file, section, language, and line for failures.
9. As a contributor, I can receive an AI-generated minimal fix when configured.
10. As a CI user, I can make failures exit with status 1.
11. As a local user, I can run checks without failing my shell command by default.
12. As a project owner, I can publish a badge showing passing documentation snippets.
13. As a leaderboard visitor, I can see pass rate, last checked date, and repo metadata.
14. As a privacy-conscious maintainer, I can verify that code and output are not stored.
15. As a tool integrator, I can request JSON output for automation.
16. As a TypeScript project maintainer, I can execute TypeScript snippets through `ts-node`.
17. As a shell-heavy project maintainer, I can distinguish shell scripts from command transcripts.
18. As a project with private services, I can mark external-service examples as skipped.

## 6. Feature Priorities

### P0

- Markdown fenced block parser using AST parsing.
- Language normalization for Python, JavaScript, TypeScript, and Bash.
- False-positive defense: auto-skip heuristics, skip directive, setup directive, config setup, env injection, and clear skip reasons.
- Isolated execution with per-block timeouts.
- Local CLI: `run`, `check`, `list`, `init`, `--help`, and `--version`.
- Console reporter, JSON reporter, and GitHub PR formatter.
- Claude-powered fix suggestions with caching and graceful fallback.
- GitHub Action wrapper.
- README and docs.

### P1

- Public leaderboard with shields.io badge endpoint.
- Repo detail pages with run history.
- Idempotent GitHub PR comment updates.
- Popular repo analysis script and launch data.

### P2

- Additional languages: Ruby, Go, Rust, and Java.
- Richer setup caching.
- Organization-level dashboards.
- Maintainer notification preferences.

## 7. Non-Goals

DocRunner does not prove that output is semantically correct. It only verifies that examples execute without runtime failure.

DocRunner does not replace a test suite, linter, type checker, or documentation review.

DocRunner does not lint prose or judge whether the explanation around a snippet is accurate.

DocRunner does not store source code, snippet output, branch names, file names, or private repo content in the leaderboard.

## 8. Success Metrics

- Repositories using the GitHub Action.
- Public "docs tested" badges installed.
- GitHub stars and forks.
- First-run completion rate under three minutes.
- Failure comments that lead to applied fixes.
- Auto-skip precision measured on real README fixtures.
- Leaderboard entries with recent successful runs.

## 9. The False-Positive Problem

README snippets are frequently illustrative. If DocRunner fails examples containing `YOUR_API_KEY`, service calls, transcripts, or pseudocode, maintainers will remove it.

DocRunner treats false-positive prevention as P0:

- Placeholder patterns are skipped before execution.
- Shell transcripts are detected separately from shell scripts.
- Maintainers get a one-line skip directive.
- Setup directives allow examples to share intentionally prepared state.
- Config setup and env injection support project-wide prerequisites.
- The list command previews all decisions before execution.

The launch analysis must measure false positives. If the false-positive rate on real READMEs is above 15%, Phase 8 is not complete.

## 10. Product Principles

- Zero friction for the first run.
- Explicit control when heuristics are not enough.
- Useful failure detail instead of generic errors.
- Privacy-respecting public status.
- AI suggestions only when they reduce maintainer work.
