import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { ConfigLoadError, loadConfig } from "../src/config/index.js";

/**
 * Creates an isolated temporary directory for a config test.
 * @returns Absolute path to the temporary directory.
 */
async function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "docrunner-config-"));
}

describe("loadConfig", () => {
  test("returns defaults when the default config is missing", async () => {
    const cwd = await makeTempDir();
    const config = await loadConfig({ cwd });

    expect(config.files).toEqual(["README.md"]);
    expect(config.timeout).toBe(10);
    expect(config.on_failure).toBe("error");
    expect(config.ai_suggestions).toBe(false);
  });

  test("loads a valid config and applies optional values", async () => {
    const cwd = await makeTempDir();
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

  test("rejects unknown keys and invalid field values", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      join(cwd, "docrunner.yml"),
      ["version: 1", "timeout: 0", "mystery: true"].join("\n"),
      "utf8",
    );

    await expect(loadConfig({ cwd })).rejects.toThrow(ConfigLoadError);
    await expect(loadConfig({ cwd })).rejects.toThrow("timeout");
    await expect(loadConfig({ cwd })).rejects.toThrow("Unrecognized key");
  });

  test("reports malformed YAML with its config path", async () => {
    const cwd = await makeTempDir();
    await writeFile(join(cwd, "custom.yml"), "files: [README.md", "utf8");

    await expect(loadConfig({ cwd, configPath: "custom.yml" })).rejects.toThrow(
      "Unable to parse custom.yml as YAML",
    );
  });

  test("reports a missing explicit config instead of silently using defaults", async () => {
    const cwd = await makeTempDir();

    await expect(
      loadConfig({ cwd, configPath: "missing.yml" }),
    ).rejects.toThrow("Unable to read missing.yml");
  });
});
