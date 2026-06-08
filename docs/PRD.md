# DocRunner Product Requirements

## Product Statement

DocRunner makes README examples trustworthy by finding executable fenced code blocks,
skipping examples that are clearly illustrative, running the rest in CI, and showing
maintainers the exact failure with an optional minimal AI-generated fix.

## Problem

README examples are often the first API surface a developer uses and the last surface a
test suite covers. They drift when APIs, package names, setup steps, and defaults change.
The result is repeated "your example does not work" issues, lost evaluator trust, and
maintenance work that arrives after a release.

There is no defensible public baseline for how frequently popular README examples fail.
DocRunner will measure it during Phase 8 by running against at least 50 popular Python and
JavaScript repositories, publishing methodology and aggregate results in `docs/ANALYSIS.md`.
The launch hypothesis is that more than 20% contain at least one runnable example that
fails; the product remains useful even if the measured rate is lower.

## Users

### Primary: Burnt-Out OSS Maintainer

Maintains a 2,000-star library alongside a full-time job. They receive recurring issues
about stale Quick Start examples and distrust tools that require annotating every block.
They need a low-noise PR signal, a fast escape hatch, and no new service to operate.

### Secondary: New Contributor

Wants confidence that a PR changing an API or README will not embarrass the project.
They need a local command with the same behavior as CI and errors that point to the
specific section, line, and missing setup.

### Tertiary: Library Evaluator

Compares libraries under time pressure. They treat a broken first example as evidence
that the project is neglected. They need a visible, current, privacy-respecting signal
that examples execute.

## User Stories

1. As a maintainer, I can add one Action step and test README examples on every PR.
2. As a maintainer, I can try DocRunner locally without an API key.
3. As a maintainer, I can preview every detected and skipped block before execution.
4. As a maintainer, I can skip a contextual example with one adjacent directive.
5. As a maintainer, I can define project-wide setup commands and environment values.
6. As a maintainer, I can pair setup code with the next example.
7. As a maintainer, I see why each block was skipped.
8. As a maintainer, a failing PR receives one updated comment rather than repeated comments.
9. As a maintainer, I receive a minimal suggested fix when Claude is configured.
10. As a maintainer, basic checks still complete when Claude is unavailable.
11. As a maintainer, I can choose whether failures block CI or only warn.
12. As a contributor, I can run the same checks locally that CI runs.
13. As a contributor, errors identify the file, section, language, line, and runtime error.
14. As an automation author, I can consume stable JSON results.
15. As a library evaluator, I can view a current "docs tested" badge.
16. As a project owner, I can opt into a public aggregate-only leaderboard.
17. As a private-repo owner, I can use DocRunner without sending data to the leaderboard.
18. As a security-conscious maintainer, I can see exactly what environment reaches snippets.

## Priorities

### P0: Trustworthy Core

- Parse fenced Python, JavaScript, TypeScript, and Bash blocks without annotations.
- Normalize aliases and attach source location and nearest heading.
- Aggressively skip placeholders, transcripts, unsupported shebangs, and manual skips.
- Execute snippets in isolated subprocess workspaces with timeout and minimal environment.
- Provide `run`, `check`, `list`, and stable JSON output.
- Produce actionable console and idempotent GitHub PR reports.
- Validate `docrunner.yml` with field-specific errors.

### P1: Differentiation and Distribution

- Claude fix suggestions with cache, strict cost controls, and graceful fallback.
- `docrunner init` with detected files and languages.
- Docker GitHub Action.
- Opt-in public leaderboard, repo page, and shields.io badge endpoint.

### P2: Expansion

- Ruby, Go, Rust, and Java execution.
- Historical trend insights and richer repository filters.
- Organization policy controls and hosted execution.

## Success Metrics

| Metric | 30-day target | 90-day target |
|---|---:|---:|
| Repositories running DocRunner | 50 | 250 |
| Repositories displaying badge | 20 | 100 |
| GitHub stars | 300 | 1,000 |
| Median first-run setup time | under 3 minutes | under 2 minutes |
| False-positive rate in measured real READMEs | below 15% | below 10% |
| PR comments with actionable location | 100% | 100% |

## Non-Goals

- DocRunner does not verify that output is semantically correct; it verifies execution.
- DocRunner does not replace unit, integration, security, or compatibility tests.
- DocRunner does not lint prose, style, grammar, or API documentation completeness.
- DocRunner v1 does not provide a hardened hostile-code sandbox. CI must treat repository
  code as trusted to the same degree as existing test scripts.
- The leaderboard never stores snippets, output, errors, file names, or branch names.

## False-Positive Contract

False positives are the primary adoption risk. README blocks commonly require secrets,
services, dependencies, or reader substitutions. DocRunner therefore defaults to caution:

- Strong placeholders and explicit directives become `skipped`, never `failed`.
- Every skip includes a reason and is visible in `list`, console, JSON, and PR output.
- Project setup, per-language setup, environment injection, and paired setup blocks cover
  contextual examples without forcing them into the main test suite.
- All-skipped runs warn rather than claim success.
- Phase 8 measures behavior on real READMEs. A false-positive rate above 15% blocks launch.

## Release Acceptance

The v1 release is acceptable when all P0 and P1 features pass their required tests,
DocRunner passes against its own README, a real-repository analysis is published, the CLI
is installable from npm, the Action is usable by version tag, and the leaderboard is live.
