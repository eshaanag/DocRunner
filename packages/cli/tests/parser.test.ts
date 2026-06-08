import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { normalizeLanguage } from "../src/parser/languageNormalizer.js";
import { parseMarkdown } from "../src/parser/index.js";

/**
 * Loads a markdown parser fixture.
 * @param name Fixture file name.
 * @returns Fixture markdown content.
 */
async function fixture(name: string): Promise<string> {
  return readFile(join(process.cwd(), "tests", "fixtures", name), "utf8");
}

describe("normalizeLanguage", () => {
  test.each([
    ["py", "python"],
    ["python3", "python"],
    ["js", "javascript"],
    ["node", "javascript"],
    ["ts", "typescript"],
    ["sh", "bash"],
    ["shell", "bash"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeLanguage(input)).toBe(expected);
  });

  test("returns null for unsupported or missing languages", () => {
    expect(normalizeLanguage("ruby")).toBeNull();
    expect(normalizeLanguage(undefined)).toBeNull();
  });
});

describe("parseMarkdown", () => {
  test("extracts clean examples with headings and source lines", async () => {
    const markdown = await fixture("simple.md");
    const blocks = parseMarkdown(markdown, { file: "README.md" });

    expect(blocks).toHaveLength(3);
    expect(blocks.map((block) => block.heading)).toEqual([
      "Installation",
      "Quick Start",
      "Browser Check",
    ]);
    expect(blocks.map((block) => block.startLine)).toEqual([5, 11, 18]);
    expect(blocks.every((block) => block.skipReason === null)).toBe(true);
  });

  test("extracts directives without leaking them to later blocks", async () => {
    const markdown = await fixture("withSetup.md");
    const blocks = parseMarkdown(markdown, { file: "README.md" });

    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.isSetup).toBe(true);
    expect(blocks[1]?.isSetup).toBe(false);
    expect(blocks[1]?.name).toBe("Read generated message");
    expect(blocks[2]?.skipReason).toBe("manual skip directive");
  });

  test("normalizes mixed aliases and ignores unsupported languages", async () => {
    const markdown = await fixture("mixedLanguages.md");
    const blocks = parseMarkdown(markdown, { file: "README.md" });

    expect(blocks.map((block) => block.language)).toEqual([
      "python",
      "javascript",
      "typescript",
      "bash",
    ]);
  });

  test("auto-skips realistic placeholders and transcripts", async () => {
    const markdown = await fixture("withPlaceholders.md");
    const blocks = parseMarkdown(markdown, { file: "README.md" });

    expect(blocks).toHaveLength(6);
    expect(blocks.every((block) => block.skipReason !== null)).toBe(true);
  });

  test("parses real-world-style examples and manual network skip", async () => {
    const markdown = await fixture("realWorld.md");
    const blocks = parseMarkdown(markdown, { file: "docs/realWorld.md" });

    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.heading).toBe("FastAPI Application");
    expect(blocks[1]?.skipReason).toBe("manual skip directive");
    expect(blocks[2]?.language).toBe("python");
  });

  test("creates deterministic IDs and honors configured patterns", () => {
    const markdown = "```python\ncall_live_service()\n```";
    const options = { file: "README.md", skipPatterns: ["live_service"] };
    const first = parseMarkdown(markdown, options);
    const second = parseMarkdown(markdown, options);

    expect(first[0]?.id).toBe(second[0]?.id);
    expect(first[0]?.skipReason).toBe("configured skip pattern `live_service`");
  });
});
