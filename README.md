# DocRunner

DocRunner catches broken README code examples in CI with zero annotations required for the common case.

It parses fenced code blocks, skips obvious placeholders and transcripts, executes runnable snippets in isolated subprocesses, and reports exact failures with optional AI-generated fix suggestions.

## Status

DocRunner is in Phase 0 foundation work.

| Feature | Status |
|---|---|
| Product and technical docs | Complete |
| Project structure | Complete |
| Config validation | Complete |
| Parser | Planned |
| Execution runner | Planned |
| GitHub Action | Planned |
| Leaderboard | Planned |

## Architecture

```text
Markdown files -> parser -> skip detector -> isolated runners -> reporters
                                                     |
                                                     +-> AI suggestions
                                                     +-> leaderboard aggregates
```

## Tech Stack

| Tool | Purpose |
|---|---|
| TypeScript | CLI and dashboard implementation |
| Node.js | CLI runtime |
| Zod | Config and input validation |
| Vitest | TypeScript unit tests |
| Python subprocess runner | Future isolated execution layer |
| Next.js | Future public leaderboard |

## Planned Quick Start

```bash
npm install -g docrunner
docrunner run
```

## Planned GitHub Action

```yaml
- uses: actions/checkout@v4
- uses: eshaanag/docrunner@v1
```

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `ANTHROPIC_API_KEY` | Enables optional AI fix suggestions | No |
| `GITHUB_TOKEN` | Posts PR comments in GitHub Actions | CI only |
| `NEXT_PUBLIC_APP_URL` | Public leaderboard URL | Dashboard only |
| `LEADERBOARD_SECRET` | Authenticates leaderboard writes | Dashboard only |

## Badge

```markdown
[![docs tested](https://docrunner.dev/api/badge/OWNER/REPO)](https://docrunner.dev/repo/OWNER/REPO)
```

## AI Fix Suggestions

When enabled, DocRunner sends only failing snippet context to Claude and asks for a minimal corrected code block. Automated tests use mocks and never call the API.

## Leaderboard

The planned leaderboard at `https://docrunner.dev` stores aggregate counts only. It never stores code, output, file names, branch names, or error text.
