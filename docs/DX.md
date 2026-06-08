# DocRunner Developer Experience

## Philosophy

DocRunner should feel like a mature test tool, not another bot. The first local run must
require no API key, no annotations, and no account. Configuration exists for the cases where
README examples are contextual, not to make the common path work.

Principles:

- Zero friction to try: `npm install -g @eshaanag/docrunner`, then `docrunner run`.
- Low friction to configure: `docrunner init` generates sensible defaults.
- High value immediately: exact section, line, language, stderr, and next action.
- No surprise execution: `docrunner list` previews every block and skip reason.
- No shame UI: skipped examples are normal, visible, and non-alarming.

## CLI Output

Console output is compact, aligned, and quiet. It uses color when TTY supports it and plain
symbols otherwise.

```text
docrunner v0.1.0  ·  README.md

  ✓  "Installation"      bash        line 8      12ms
  ✓  "Authentication"    javascript  line 41     45ms
  ✗  "Quick Start"       python      line 23    823ms
  ⊘  "Advanced Config"   python      line 67    skipped (placeholder YOUR_API_KEY)

  ─────────────────────────────────────────────
  Results: 2 passed · 1 failed · 1 skipped
  Duration: 880ms

  ✗ FAILED: "Quick Start" (python · README.md:23)
    NameError: name 'client' is not defined

    Hint: Run `docrunner suggest README.md:23` for an AI-generated fix.
  ─────────────────────────────────────────────
```

States:

- Success: summary only after rows.
- Error: show config/runtime problem before per-block rows if execution cannot begin.
- Edge: no files, no supported blocks, all skipped, missing runtime, timeout, and malformed
  config all produce distinct messages.

## Commands

| Command                         | Exit behavior                                             | Purpose               |
| ------------------------------- | --------------------------------------------------------- | --------------------- |
| `docrunner run [file]`          | Always exits 0 unless DocRunner itself cannot run         | Local exploration     |
| `docrunner check [file]`        | Exits 1 on fail/timeout/error unless warn mode            | CI                    |
| `docrunner init`                | Exits 0 when config created, error when overwrite refused | First setup           |
| `docrunner list [file]`         | Exits 0 after detection preview                           | Debug false positives |
| `docrunner suggest <file:line>` | Exits 0 on suggestion, error on missing key/block         | Targeted AI fix       |
| `docrunner --help`              | Exits 0                                                   | Command reference     |

## PR Comment Format

The PR comment is a code review artifact and a screenshot surface.

````markdown
## 🔍 DocRunner Results

| Status  | Section         | Language     | Line |
| ------- | --------------- | ------------ | ---- |
| ✅ Pass | Installation    | `bash`       | 8    |
| ✅ Pass | Authentication  | `javascript` | 41   |
| ❌ Fail | Quick Start     | `python`     | 23   |
| ⏭️ Skip | Advanced Config | `python`     | 67   |

**2 passed · 1 failed · 1 skipped**

---

### ❌ Quick Start — `python` · line 23

```
NameError: name 'client' is not defined
```

**💡 Suggested fix** (via Claude):

The `client` variable is used before it is defined.

```python
from mylib import Client

client = Client(api_key="YOUR_API_KEY")  # Added before first use.
response = client.get("/endpoint")
print(response)
```

---

<sub>Powered by [DocRunner](https://docrunner.dev) · [Add badge](https://docrunner.dev/badge) · [View leaderboard](https://docrunner.dev)</sub>
````

If AI is unavailable, the failed section remains and includes: "AI suggestions unavailable;
add `ANTHROPIC_API_KEY` to use this feature."

## Badge Design

DocRunner uses the shields.io endpoint contract:

```json
{
  "schemaVersion": 1,
  "label": "docs tested",
  "message": "12/12 passing",
  "color": "brightgreen"
}
```

Colors:

- `brightgreen`: all executed blocks pass.
- `green`: pass rate 80-99%.
- `yellow`: pass rate 60-79%.
- `orange`: pass rate below 60%.
- Never `red`; red encourages badge removal instead of documentation improvement.

## Config UX

Defaults work for a repository with `README.md` and common runnable examples:

```yaml
version: 1
files:
  - README.md
timeout: 10
on_failure: error
ai_suggestions: false
```

Helpful config errors:

- `timeout: expected an integer from 1 to 300 seconds, received "forever".`
- `languages[1]: "php" is not supported in v1. Supported: python, javascript, typescript, bash.`
- `env.API_KEY: expected string; use quotes for numeric-looking values.`
- `files: provide at least one markdown glob, for example "README.md".`

## Leaderboard UX

The leaderboard is minimal and work-focused:

- Headline: "These projects test their documentation."
- Table: repository, stars, pass rate, passed/failed/skipped counts, last checked, badge.
- Sorting: pass rate descending, then stars descending.
- Repo page: latest status, run history, badge snippet, privacy statement.
- Empty state: explain opt-in registration and show setup.

No code snippets, errors, file names, or branch names appear on public pages.

## Error Message Catalog

| Situation        | Message                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Missing config   | `No docrunner.yml found; using defaults for README.md.`                                                                   |
| Malformed config | `Invalid docrunner.yml: timeout must be an integer from 1 to 300 seconds.`                                                |
| No files         | `No markdown files matched: README.md, docs/**/*.md.`                                                                     |
| No blocks        | `No supported code blocks found. Use docrunner list --all to inspect ignored languages.`                                  |
| All skipped      | `0 blocks executed. Your README may have no executable examples or all were auto-skipped. Run with --verbose to see why.` |
| Runtime failure  | `Python block at README.md:23 ("Quick Start") raised NameError: name 'client' is not defined.`                            |
| Timeout          | `Python block at README.md:23 ("Quick Start") timed out after 10s. Increase timeout or skip service-dependent examples.`  |
| Missing ts-node  | `TypeScript blocks require ts-node. Add it to setup: npm install -g ts-node typescript.`                                  |
| Claude missing   | `AI suggestions unavailable: ANTHROPIC_API_KEY is not set.`                                                               |
| Rate limit       | `GitHub comment update was rate limited; results are printed below and will be retried when possible.`                    |

## Onboarding Timeline

Target: under 3 minutes for a standard Node.js project.

1. 20s: install CLI.
2. 20s: run `docrunner list`.
3. 30s: run `docrunner init`.
4. 30s: inspect generated config.
5. 30s: run `docrunner run`.
6. 30s: add two Action lines.
7. Remaining buffer: fix one setup/skip issue.

The onboarding succeeds when a maintainer understands what executed, what skipped, and what
will happen in CI without reading long docs.
