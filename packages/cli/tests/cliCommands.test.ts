import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateConfig, initializeProject } from "../src/commands/init.js";
import { formatBlockList } from "../src/commands/list.js";
import { suggestAtLocationWithOptions } from "../src/commands/suggest.js";
import {
  createClaudeMock,
  mockAISuggestion,
} from "../src/lib/mocks/claudeMock.js";
import type { ParsedBlock } from "../src/types/index.js";

/**
 * Creates an isolated project for command tests.
 * @returns Absolute temporary project path.
 */
async function makeProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), "docrunner-commands-"));
}

describe("init command helpers", () => {
  test("generates a valid smart config from detected files and languages", () => {
    const config = generateConfig(
      ["README.md", "docs/guide.md"],
      ["bash", "python"],
      true,
    );

    expect(config).toContain('"README.md"');
    expect(config).toContain("  - python");
    expect(config).toContain("ai_suggestions: true");
  });

  test("scans markdown and refuses to overwrite existing config", async () => {
    const cwd = await makeProject();
    await writeFile(join(cwd, "README.md"), "```bash\necho ready\n```", "utf8");

    const initialized = await initializeProject(cwd);
    expect(initialized.blocks).toHaveLength(1);
    expect(initialized.message).toContain("Created docrunner.yml");
    await expect(initializeProject(cwd)).rejects.toThrow("already exists");
  });

  test("reports projects without markdown files", async () => {
    await expect(initializeProject(await makeProject())).rejects.toThrow(
      "No markdown files found",
    );
  });
});

describe("list command formatter", () => {
  test("shows execution and skip decisions without running blocks", () => {
    const blocks: ParsedBlock[] = [
      {
        id: "one",
        file: "README.md",
        language: "python",
        code: "print('ready')",
        startLine: 4,
        heading: "Quick Start",
        name: null,
        isSetup: false,
        skipReason: null,
      },
      {
        id: "two",
        file: "README.md",
        language: "bash",
        code: "$ npm install",
        startLine: 10,
        heading: "Install",
        name: null,
        isSetup: false,
        skipReason: "shell transcript",
      },
    ];

    const output = formatBlockList(blocks);
    expect(output).toContain("[execute]");
    expect(output).toContain("[skip: shell transcript]");
  });

  test("shows a clear empty state", () => {
    expect(formatBlockList([])).toBe("No supported code blocks found.");
  });
});

describe("suggest command helper", () => {
  test("returns a mock suggestion for one failing location", async () => {
    const cwd = await makeProject();
    await writeFile(join(cwd, "README.md"), "```bash\nexit 2\n```", "utf8");
    const block: ParsedBlock = {
      id: "mock",
      file: "README.md",
      language: "bash",
      code: "exit 2",
      startLine: 1,
      heading: null,
      name: null,
      isSetup: false,
      skipReason: null,
    };
    const suggestion = mockAISuggestion(block, "exit 2");

    const output = await suggestAtLocationWithOptions(cwd, "README.md:1", {
      apiKey: "test-key",
      client: createClaudeMock(suggestion),
    });

    expect(output).toContain(suggestion.diagnosis);
    expect(output).toContain(suggestion.fixedCode);
  });

  test("rejects invalid locations and missing keys", async () => {
    const cwd = await makeProject();
    await expect(
      suggestAtLocationWithOptions(cwd, "README.md", { apiKey: "test-key" }),
    ).rejects.toThrow("file:line");
    await expect(
      suggestAtLocationWithOptions(cwd, "README.md:1", {}),
    ).rejects.toThrow("ANTHROPIC_API_KEY");
  });
});
