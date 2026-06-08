# DocRunner Developer Experience Spec

## 1. DX Philosophy

DocRunner must be useful before it is configured. A maintainer should install it, run one command, and immediately understand which README examples are runnable, skipped, passing, or broken.

The experience should feel like a focused test runner: quiet when healthy, precise when broken, and never surprising about what it executed.

## 2. CLI Commands

```text
docrunner run [file]          Run checks, show results, exit 0 always
docrunner check [file]        Run checks, exit 1 on failure for CI
docrunner init                Create docrunner.yml with smart defaults
docrunner suggest <file:line> Get AI fix for a specific failing block
docrunner list [file]         List detected blocks without running them
docrunner --version           Print version
docrunner --help              Print help
```

## 3. `docrunner run` Output

The output should be dense, aligned, and screenshot-worthy.

```text
docrunner v0.1.0  .  README.md

  PASS  "Installation"        bash        line 8      12ms
  PASS  "Authentication"      javascript  line 41     45ms
  FAIL  "Quick Start"         python      line 23    823ms
  SKIP  "Advanced Config"     python      line 67     placeholder detected

  --------------------------------------------------
  Results: 2 passed . 1 failed . 1 skipped
  Duration: 880ms

  FAILED: "Quick Start" (python . README.md:23)
    NameError: name 'client' is not defined

    Hint: Run `docrunner suggest README.md:23` for an AI-generated fix.
```

Color rules:

- Pass: green.
- Fail: red.
- Timeout: yellow.
- Error: red with explicit tool problem.
- Skip: dim gray.
- Duration: dim.

## 4. `docrunner list` Output

```text
README.md

  line 8    bash        "Installation"      executable
  line 23   python      "Quick Start"       executable
  line 67   python      "Advanced Config"   skipped: detected YOUR_API_KEY
```

This command is a trust builder. It lets maintainers see execution decisions before running code.

## 5. `docrunner init` Experience

The command scans configured or default markdown files, counts blocks by language, and writes a conservative config.

```text
Found 12 code blocks across 3 markdown files.
Languages: python 4, bash 6, javascript 2.
Created docrunner.yml.
Run `docrunner run` to test your examples.
```

If `docrunner.yml` already exists, the command refuses to overwrite unless `--force` is provided.

## 6. PR Comment Format

```markdown
## DocRunner Results

| Status | Section | Language | Line |
|--------|---------|----------|------|
| Pass | Installation | `bash` | 8 |
| Pass | Authentication | `javascript` | 41 |
| Fail | Quick Start | `python` | 23 |
| Skip | Advanced Config | `python` | 67 |

**2 passed . 1 failed . 1 skipped**

---

### Quick Start - `python` . line 23

```
NameError: name 'client' is not defined
```

**Suggested fix** (via Claude):

The `client` variable is used before it is defined.

```python
from mylib import Client

client = Client(api_key="YOUR_API_KEY")  # Defines client before use.
response = client.get("/endpoint")
print(response)
```

---
<sub>Powered by [DocRunner](https://docrunner.dev) . [Add badge](https://docrunner.dev/badge) . [View leaderboard](https://docrunner.dev)</sub>
```

The real implementation may use status icons in comments, but the markdown must remain readable without color.

## 7. Badge Design

Shields endpoint:

```json
{
  "schemaVersion": 1,
  "label": "docs tested",
  "message": "12/12 passing",
  "color": "brightgreen"
}
```

README snippet:

```markdown
[![docs tested](https://docrunner.dev/api/badge/OWNER/REPO)](https://docrunner.dev/repo/OWNER/REPO)
```

Color logic:

- 100 percent passing: `brightgreen`.
- 80 to 99 percent: `green`.
- 60 to 79 percent: `yellow`.
- Below 60 percent: `orange`.
- Never use red for public badges.

## 8. Config UX

Default config:

```yaml
version: 1
files:
  - README.md
timeout: 10
on_failure: error
ai_suggestions: false
```

Malformed config errors should name the field, expected type, received value, and fix.

Example:

```text
docrunner.yml: timeout must be a positive number of seconds.
Received: "ten"
Fix: set timeout: 10
```

## 9. Error Message Catalog

Python runtime failure:

```text
Python block at README.md:23 ("Quick Start") raised NameError: name 'client' is not defined.
```

Timeout:

```text
Python block at README.md:23 ("Quick Start") timed out after 10s.
If this example needs more time, set `timeout: 30` in docrunner.yml.
If it depends on a live service, add `<!-- docrunner: skip -->`.
```

Missing tool:

```text
TypeScript blocks require ts-node.
Install it with `npm install -g ts-node typescript` or add setup in docrunner.yml.
```

All skipped:

```text
0 blocks executed. Your README may have no runnable examples or all examples were skipped.
Run `docrunner list --verbose` to see why.
```

Malformed config:

```text
docrunner.yml: languages[0] must be one of python, javascript, typescript, bash.
Received: "php"
```

AI unavailable:

```text
AI suggestions unavailable. Set ANTHROPIC_API_KEY to enable suggested fixes.
```

## 10. Leaderboard UX

The leaderboard is a utility page, not a marketing page. It shows:

- Repository.
- Stars.
- Pass rate.
- Passing, failing, skipped counts.
- Last checked date.
- Badge snippet.

It must state the privacy boundary clearly: DocRunner stores aggregate counts only, never code or output.

## 11. Onboarding Goal

Target time from install to first useful result: under three minutes.

Path:

1. `npm install -g docrunner`
2. `docrunner init`
3. `docrunner list`
4. `docrunner run`
5. Add the GitHub Action if useful.
