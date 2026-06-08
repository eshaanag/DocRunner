import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadConfig, ConfigLoadError } from "../src/config/index.js";

/**
 * Creates a temporary directory for config tests.
 * @param name Directory suffix for easier debugging.
 * @returns Absolute temporary directory path.
 */
async function makeTempDir(name: string): Promise<string> {
  const dir = join(process.cwd(), "tests", ".tmp", name);
  await mkdir(dir, { recursive: true });
  return dir;
}

describe("loadConfig", () => {
  test("returns defaults when docrunner.yml is missing", async () => {
    const cwd = await makeTempDir("missing-config");
    const config = await loadConfig({ cwd });

    expect(config.files).toEqual(["README.md"]);
    expect(config.timeout).toBe(10);
    expect(config.on_failure).toBe("error");
    expect(config.ai_suggestions).toBe(false);
  });

  test("loads a valid config file", async () => {
    const cwd = await makeTempDir("valid-config");
    await writeFile(
      join(cwd, "docrunner.yml"),
      [
        "version: 1",
        "files:",
        "  - README.md",
        "  - docs/**/*.md",
        "languages:",
        "  - python",
        "timeout: 20",
        "env:",
        "  API_URL: http://localhost:3000",
        "ai_suggestions: true",
      ].join("\n"),
      "utf8",
    );

    const config = await loadConfig({ cwd });

    expect(config.files).toEqual(["README.md", "docs/**/*.md"]);
    expect(config.languages).toEqual(["python"]);
    expect(config.timeout).toBe(20);
    expect(config.env.API_URL).toBe("http://localhost:3000");
    expect(config.ai_suggestions).toBe(true);
  });

  test("throws a helpful error for malformed config values", async () => {
    const cwd = await makeTempDir("invalid-config");
    await writeFile(
      join(cwd, "docrunner.yml"),
      ["version: 1", "timeout: ten"].join("\n"),
      "utf8",
    );

    await expect(loadConfig({ cwd })).rejects.toThrow(ConfigLoadError);
    await expect(loadConfig({ cwd })).rejects.toThrow("timeout");
  });
});
