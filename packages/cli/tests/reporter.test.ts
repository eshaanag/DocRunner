import { describe, expect, test } from "vitest";
import { formatConsoleReport } from "../src/reporter/console.js";
import { formatGitHubComment } from "../src/reporter/github.js";
import { formatJsonReport, stringifyJsonReport } from "../src/reporter/json.js";
import type {
  AISuggestion,
  ExecutionResult,
  ParsedBlock,
} from "../src/types/index.js";

const blocks: ParsedBlock[] = [
  {
    id: "pass",
    file: "README.md",
    language: "bash",
    code: "echo ready",
    startLine: 8,
    heading: "Installation",
    name: null,
    isSetup: false,
    skipReason: null,
  },
  {
    id: "fail",
    file: "README.md",
    language: "python",
    code: "client.get('/')",
    startLine: 23,
    heading: "Quick | Start",
    name: null,
    isSetup: false,
    skipReason: null,
  },
  {
    id: "skip",
    file: "README.md",
    language: "python",
    code: "Client('YOUR_API_KEY')",
    startLine: 67,
    heading: "Advanced Config",
    name: null,
    isSetup: false,
    skipReason: "placeholder pattern `YOUR_API_KEY`",
  },
];

const results: ExecutionResult[] = [
  {
    blockId: "pass",
    status: "pass",
    exitCode: 0,
    stdout: "ready\n",
    stderr: "",
    durationMs: 12,
    skipReason: null,
    errorMessage: null,
  },
  {
    blockId: "fail",
    status: "fail",
    exitCode: 1,
    stdout: "",
    stderr: "NameError: name 'client' is not defined",
    durationMs: 823,
    skipReason: null,
    errorMessage: null,
  },
  {
    blockId: "skip",
    status: "skipped",
    exitCode: null,
    stdout: "",
    stderr: "",
    durationMs: 0,
    skipReason: "placeholder pattern `YOUR_API_KEY`",
    errorMessage: null,
  },
];

const suggestion: AISuggestion = {
  diagnosis: "The client variable is used before initialization.",
  fixedCode: "client = Client()\nclient.get('/')",
  note: null,
};

describe("console reporter", () => {
  test("renders scannable rows, summary, and failure details", () => {
    const output = formatConsoleReport(blocks, results, {
      version: "0.1.0",
      color: false,
    });

    expect(output).toContain('✓  "Installation"');
    expect(output).toContain('✗  "Quick | Start"');
    expect(output).toContain("1 passed · 1 failed · 1 skipped");
    expect(output).toContain("NameError");
  });

  test("warns when all reportable blocks are skipped", () => {
    const output = formatConsoleReport([blocks[2]!], [results[2]!], {
      version: "0.1.0",
      color: false,
    });

    expect(output).toContain("0 blocks executed");
  });
});

describe("JSON reporter", () => {
  test("returns a stable schema-versioned report", () => {
    const report = formatJsonReport(blocks, results);
    const text = stringifyJsonReport(blocks, results);

    expect(report.schemaVersion).toBe(1);
    expect(report.summary).toMatchObject({ passed: 1, failed: 1, skipped: 1 });
    expect(JSON.parse(text)).toEqual(report);
  });

  test("handles missing block metadata without crashing", () => {
    const unknown = { ...results[0]!, blockId: "unknown" };
    const report = formatJsonReport([], [unknown]);

    expect(report.results[0]?.file).toBeNull();
    expect(report.results[0]?.language).toBeNull();
  });
});

describe("GitHub reporter", () => {
  test("renders a PR table, escaped labels, and AI suggestion", () => {
    const comment = formatGitHubComment(
      blocks,
      results,
      new Map([["fail", suggestion]]),
      true,
    );

    expect(comment.hasFailures).toBe(true);
    expect(comment.aiSuggestionsIncluded).toBe(true);
    expect(comment.markdown).toContain("Quick \\| Start");
    expect(comment.markdown).toContain("Suggested fix");
    expect(comment.markdown).toContain("client = Client()");
  });

  test("renders AI unavailable note and distinct timeout status", () => {
    const timeout: ExecutionResult = {
      ...results[1]!,
      status: "timeout",
      stderr: "",
      exitCode: null,
    };
    const comment = formatGitHubComment(blocks, [timeout], new Map(), true);

    expect(comment.markdown).toContain("⏱️ Timeout");
    expect(comment.markdown).toContain("AI suggestions unavailable");
  });

  test("reports a clean run without failure sections", () => {
    const comment = formatGitHubComment([blocks[0]!], [results[0]!]);

    expect(comment.hasFailures).toBe(false);
    expect(comment.summary).toBe("1 passed · 0 failed · 0 skipped");
    expect(comment.markdown).not.toContain("Suggested fix");
  });
});
