import { access } from "node:fs/promises";
import { describe, expect, test } from "vitest";
import { runBlock, runBlocks } from "../src/runner/index.js";
import {
  buildExecutionEnvironment,
  runProcess,
} from "../src/runner/process.js";
import type {
  DocRunnerConfig,
  ParsedBlock,
  SupportedLanguage,
} from "../src/types/index.js";

/**
 * Creates a parsed block for runner tests.
 * @param language Runtime language.
 * @param code Source code.
 * @param overrides Optional block field overrides.
 * @returns ParsedBlock suitable for execution tests.
 */
function block(
  language: SupportedLanguage,
  code: string,
  overrides: Partial<ParsedBlock> = {},
): ParsedBlock {
  return {
    id: overrides.id ?? `${language}-${Math.random().toString(16).slice(2)}`,
    file: overrides.file ?? "README.md",
    language,
    code,
    startLine: overrides.startLine ?? 1,
    heading: overrides.heading ?? "Test",
    name: overrides.name ?? null,
    isSetup: overrides.isSetup ?? false,
    skipReason: overrides.skipReason ?? null,
  };
}

/**
 * Creates a validated-equivalent config for runner tests.
 * @param overrides Optional config field overrides.
 * @returns DocRunner config.
 */
function config(overrides: Partial<DocRunnerConfig> = {}): DocRunnerConfig {
  return {
    version: 1,
    files: ["README.md"],
    languages: undefined,
    timeout: 3,
    setup: {},
    env: {},
    skip_patterns: [],
    on_failure: "error",
    ai_suggestions: false,
    leaderboard: undefined,
    ...overrides,
  };
}

describe("language runners", () => {
  test("executes a passing Python block", async () => {
    const result = await runBlock(
      block("python", "assert sum([1, 2, 3]) == 6"),
      config(),
    );

    expect(result.status).toBe("pass");
    expect(result.exitCode).toBe(0);
  });

  test("captures Python runtime failures", async () => {
    const result = await runBlock(block("python", "client.get('/')"), config());

    expect(result.status).toBe("fail");
    expect(result.stderr).toContain("NameError");
  });

  test("classifies Python timeouts separately", async () => {
    const result = await runBlock(
      block("python", "import time\ntime.sleep(2)"),
      config({ timeout: 1 }),
    );

    expect(result.status).toBe("timeout");
    expect(result.exitCode).toBeNull();
  });

  test("executes passing and failing Bash blocks", async () => {
    const pass = await runBlock(block("bash", "test docs = docs"), config());
    const fail = await runBlock(block("bash", "exit 7"), config());

    expect(pass.status).toBe("pass");
    expect(fail.status).toBe("fail");
    expect(fail.exitCode).toBe(7);
  });

  test("executes JavaScript and captures ReferenceError", async () => {
    const pass = await runBlock(
      block("javascript", "if (2 + 2 !== 4) throw new Error('bad math')"),
      config(),
    );
    const fail = await runBlock(
      block("javascript", "missingValue.toString()"),
      config(),
    );

    expect(pass.status).toBe("pass");
    expect(fail.status).toBe("fail");
    expect(fail.stderr).toContain("ReferenceError");
  });

  test("executes TypeScript through ts-node", async () => {
    const result = await runBlock(
      block(
        "typescript",
        "const count: number = 4; if (count !== 4) throw new Error();",
      ),
      config(),
    );

    expect(result.status).toBe("pass");
  });
});

describe("runner orchestration", () => {
  test("keeps setup file side effects for the next matching block only", async () => {
    const results = await runBlocks(
      [
        block(
          "python",
          "from pathlib import Path\nPath('value.txt').write_text('42')",
          {
            isSetup: true,
          },
        ),
        block(
          "python",
          "from pathlib import Path\nassert Path('value.txt').read_text() == '42'",
        ),
      ],
      config(),
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("pass");
  });

  test("injects DOCRUNNER and configured environment values", async () => {
    const result = await runBlock(
      block(
        "python",
        "import os\nassert os.environ['DOCRUNNER'] == '1'\nassert os.environ['API_URL'] == 'http://localhost:3000'",
      ),
      config({ env: { API_URL: "http://localhost:3000" } }),
    );

    expect(result.status).toBe("pass");
  });

  test("isolates files written by different target blocks", async () => {
    const results = await runBlocks(
      [
        block("bash", "echo hidden > marker.txt"),
        block("bash", "test ! -e marker.txt"),
      ],
      config(),
    );

    expect(results.map((result) => result.status)).toEqual(["pass", "pass"]);
  });

  test("removes temporary workspaces after execution", async () => {
    const result = await runBlock(
      block("python", "from pathlib import Path\nprint(Path.cwd())"),
      config(),
    );
    const workspace = result.stdout.trim();

    await expect(access(workspace)).rejects.toThrow();
  });

  test("returns skipped results without execution", async () => {
    const results = await runBlocks(
      [block("bash", "exit 1", { skipReason: "manual skip directive" })],
      config(),
    );

    expect(results[0]?.status).toBe("skipped");
    expect(results[0]?.skipReason).toBe("manual skip directive");
  });

  test("reports subprocess spawn failures as errors", async () => {
    const result = await runProcess({
      command: "docrunner-missing-runtime",
      args: [],
      cwd: process.cwd(),
      timeoutMs: 1_000,
      env: buildExecutionEnvironment({}),
    });

    expect(result.status).toBe("error");
    expect(result.errorMessage).toContain("Unable to start");
  });
});
