# DocRunner

[![docs tested](https://docrunner.dev/api/badge/eshaanag/DocRunner)](https://docrunner.dev/repo/eshaanag/DocRunner)

DocRunner catches broken README code examples in CI with zero annotations required for the
common case.

README examples are where developers decide whether your project is worth trusting.
DocRunner parses fenced snippets, skips obvious placeholders and transcripts, executes
runnable examples in isolated subprocesses, and reports exact failures with optional
AI-generated fixes.

## Architecture

```text
Markdown files -> parser -> skip detector -> isolated runners -> reporters
                                                     |
                                                     +-> AI suggestions
                                                     +-> leaderboard aggregates
```

## Tech Stack

| Tool                         | Purpose                                      |
| ---------------------------- | -------------------------------------------- |
| Node.js + TypeScript         | CLI and dashboard implementation             |
| unified + remark-parse       | Markdown AST parsing                         |
| Zod                          | Runtime validation for config and API inputs |
| Vitest                       | TypeScript unit tests                        |
| pytest                       | Python runner tests                          |
| Playwright                   | Dashboard E2E tests                          |
| Python subprocess + tempfile | Future execution sandbox helpers             |
| Next.js 14                   | Public leaderboard                           |
| SQLite                       | Leaderboard storage                          |
| Anthropic Claude             | Optional fix suggestions                     |
| Docker Action                | GitHub Actions integration                   |

## Features

| Feature                                          | Status      |
| ------------------------------------------------ | ----------- |
| Product and technical foundation docs            | ✅ Complete |
| Project structure and config validation          | ✅ Complete |
| Markdown parser and skip detector                | ✅ Complete |
| Python, JavaScript, TypeScript, and Bash runners | ✅ Complete |
| Console, JSON, and GitHub reporters              | ✅ Complete |
| Claude fix suggestions                           | ✅ Complete |
| GitHub Action                                    | ✅ Complete |
| Public verified-docs leaderboard                 | ✅ Complete |
| CLI init, list, check, run, and suggest commands | ✅ Complete |
| Dogfooding workflow and public README analysis   | ✅ Complete |

## 60-Second Demo

```text
❌ README.md · "Quick Start" · python · line 23
   NameError: name 'client' is not defined

✅ README.md · "Installation" · bash · line 8
✅ README.md · "Authentication" · javascript · line 41

2 passed · 1 failed · suggested fix below
```

DocRunner is designed so the failure report is enough to fix the README without opening
logs, guessing which block failed, or asking a contributor for reproduction steps.

## Installation

```bash
npm install -g docrunner
docrunner run
```

## CLI Commands

| Command                         | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `docrunner init`                | Scan markdown files and create `docrunner.yml` |
| `docrunner list [file]`         | Preview detected blocks and skip reasons       |
| `docrunner run [file]`          | Run checks locally and always exit zero        |
| `docrunner check [file]`        | Run checks in CI and exit non-zero on failure  |
| `docrunner suggest <file:line>` | Request an AI fix for one failing block        |

## GitHub Action Setup

```yaml
- uses: actions/checkout@v4
- uses: eshaanag/docrunner@v1
```

## Environment Variables

| Variable              | Description                             | Required       |
| --------------------- | --------------------------------------- | -------------- |
| `ANTHROPIC_API_KEY`   | Enables optional Claude fix suggestions | No             |
| `GITHUB_TOKEN`        | Posts PR comments in GitHub Actions     | CI only        |
| `NEXT_PUBLIC_APP_URL` | Public leaderboard URL                  | Dashboard only |
| `LEADERBOARD_SECRET`  | Authenticates leaderboard writes        | Dashboard only |

## Badge

```markdown
[![docs tested](https://docrunner.dev/api/badge/OWNER/REPO)](https://docrunner.dev/repo/OWNER/REPO)
```

## AI Fix Suggestions

When enabled, DocRunner sends only failing snippet context, bounded stderr, and bounded
surrounding README text to Claude. The prompt asks for a one-sentence diagnosis and a
minimal corrected code block. Automated tests use mocks and never call the API.

## Leaderboard

The public leaderboard at `https://docrunner.dev` is opt-in and stores aggregate counts
only: repository name, stars, pass/fail/skip counts, pass rate, badge color, and last run
time. It never stores code, output, errors, file names, branch names, or private repo data.

## README Analysis

The launch dataset lives in [docs/ANALYSIS.md](docs/ANALYSIS.md). It is a raw
zero-config run against public README files and is documented with methodology caveats so
the results are useful without overstating missing dependency setup as broken docs.
