import { beforeEach, describe, expect, test } from "vitest";
import {
  clearSuggestionCache,
  parseSuggestion,
  suggestFix,
  type ClaudeClient,
} from "../src/ai/fixSuggester.js";
import { buildFixPrompt } from "../src/ai/prompts.js";
import {
  createClaudeMock,
  mockAISuggestion,
} from "../src/lib/mocks/claudeMock.js";
import type {
  ExecutionResult,
  ParsedBlock,
  SupportedLanguage,
} from "../src/types/index.js";

/**
 * Creates a failing parsed block for AI tests.
 * @param language Block language.
 * @param code Failing source code.
 * @returns Parsed block.
 */
function block(language: SupportedLanguage, code: string): ParsedBlock {
  return {
    id: `${language}-failure`,
    file: "README.md",
    language,
    code,
    startLine: 23,
    heading: "Quick Start",
    name: null,
    isSetup: false,
    skipReason: null,
  };
}

/**
 * Creates an execution result for AI tests.
 * @param blockId Associated block ID.
 * @param stderr Runtime error output.
 * @param status Optional execution status.
 * @returns Execution result.
 */
function result(
  blockId: string,
  stderr: string,
  status: ExecutionResult["status"] = "fail",
): ExecutionResult {
  return {
    blockId,
    status,
    exitCode: status === "pass" ? 0 : 1,
    stdout: "",
    stderr,
    durationMs: 10,
    skipReason: null,
    errorMessage: null,
  };
}

beforeEach(() => {
  clearSuggestionCache();
});

describe("suggestFix", () => {
  test.each([
    ["python", "client.get('/')", "NameError: client is not defined"],
    ["javascript", "client.get('/')", "ReferenceError: client is not defined"],
    ["bash", "missing-command", "missing-command: command not found"],
  ] as const)(
    "returns a parsed mock fix for %s failures",
    async (language, code, error) => {
      const failingBlock = block(language, code);
      const suggestion = mockAISuggestion(failingBlock, error);

      const actual = await suggestFix({
        block: failingBlock,
        result: result(failingBlock.id, error),
        surroundingText: "Example context",
        enabled: true,
        apiKey: "test-key",
        client: createClaudeMock(suggestion),
      });

      expect(actual).toEqual(suggestion);
    },
  );

  test("returns null without a key or for non-failure results", async () => {
    const failingBlock = block("python", "client.get('/')");
    const client: ClaudeClient = {
      async request(): Promise<string> {
        throw new Error("client should not be called");
      },
    };

    await expect(
      suggestFix({
        block: failingBlock,
        result: result(failingBlock.id, "NameError"),
        surroundingText: "",
        enabled: true,
        client,
      }),
    ).resolves.toBeNull();
    await expect(
      suggestFix({
        block: failingBlock,
        result: result(failingBlock.id, "", "pass"),
        surroundingText: "",
        enabled: true,
        apiKey: "test-key",
        client,
      }),
    ).resolves.toBeNull();
  });

  test("caches suggestions by block and failure hash", async () => {
    const failingBlock = block("python", "client.get('/')");
    let requests = 0;
    const client = createClaudeMock(
      mockAISuggestion(failingBlock, "NameError"),
      () => {
        requests += 1;
      },
    );
    const options = {
      block: failingBlock,
      result: result(failingBlock.id, "NameError"),
      surroundingText: "",
      enabled: true,
      apiKey: "test-key",
      client,
    };

    await suggestFix(options);
    await suggestFix(options);

    expect(requests).toBe(1);
  });

  test("returns null when the API client or response parser fails", async () => {
    const failingBlock = block("python", "client.get('/')");
    const invalidClient: ClaudeClient = {
      async request(): Promise<string> {
        return "unstructured response";
      },
    };

    await expect(
      suggestFix({
        block: failingBlock,
        result: result(failingBlock.id, "NameError"),
        surroundingText: "",
        enabled: true,
        apiKey: "test-key",
        client: invalidClient,
      }),
    ).resolves.toBeNull();
    expect(parseSuggestion("not valid")).toBeNull();
  });
});

describe("buildFixPrompt", () => {
  test("contains exact context and bounds large error/context values", () => {
    const prompt = buildFixPrompt(
      block("python", "client.get('/')"),
      "x".repeat(5_000),
      "y".repeat(7_000),
    );

    expect(prompt).toContain("File: README.md");
    expect(prompt).toContain("Section: Quick Start");
    expect(prompt).toContain("Respond in this exact format");
    expect(prompt.match(/\[truncated by DocRunner\]/gu)).toHaveLength(2);
  });
});
