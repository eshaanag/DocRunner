import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { executeDocRunner, hasBlockingFailures } from "../src/core/run.js";

/**
 * Creates a temporary project directory with optional files.
 * @returns Absolute temporary directory path.
 */
async function makeProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), "docrunner-pipeline-"));
}

describe("executeDocRunner", () => {
  test("runs passing README examples through the full pipeline", async () => {
    const cwd = await makeProject();
    await writeFile(
      join(cwd, "README.md"),
      ["# Demo", "```bash", "test docs = docs", "```"].join("\n"),
      "utf8",
    );

    const run = await executeDocRunner({ cwd });

    expect(run.blocks).toHaveLength(1);
    expect(run.results[0]?.status).toBe("pass");
    expect(hasBlockingFailures(run)).toBe(false);
  });

  test("skips placeholder blocks and blocks failing checks", async () => {
    const cwd = await makeProject();
    await writeFile(
      join(cwd, "README.md"),
      [
        "# Demo",
        "```python",
        "Client('YOUR_API_KEY')",
        "```",
        "```bash",
        "exit 4",
        "```",
      ].join("\n"),
      "utf8",
    );

    const run = await executeDocRunner({ cwd });

    expect(run.results.map((result) => result.status)).toEqual([
      "skipped",
      "fail",
    ]);
    expect(hasBlockingFailures(run)).toBe(true);
  });

  test("honors warn mode for CI failure decisions", async () => {
    const cwd = await makeProject();
    await writeFile(join(cwd, "README.md"), "```bash\nexit 2\n```", "utf8");
    await writeFile(join(cwd, "docrunner.yml"), "on_failure: warn\n", "utf8");

    const run = await executeDocRunner({ cwd });

    expect(run.results[0]?.status).toBe("fail");
    expect(hasBlockingFailures(run)).toBe(false);
  });

  test("reports missing markdown matches as an error", async () => {
    const cwd = await makeProject();

    await expect(executeDocRunner({ cwd, file: "missing.md" })).rejects.toThrow(
      "No markdown files matched",
    );
  });
});
