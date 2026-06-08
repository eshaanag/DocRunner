import {
  blockLabel,
  formatSummary,
  joinResults,
  summarizeResults,
} from "./summary.js";
import type {
  AISuggestion,
  ExecutionResult,
  PRComment,
  ParsedBlock,
} from "../types/index.js";

/**
 * Formats execution results as a GitHub pull request comment.
 * @param blocks Parsed blocks associated with the results.
 * @param results Execution results to render.
 * @param suggestions Optional AI suggestions keyed by block ID.
 * @param aiEnabled Whether AI suggestions were requested.
 * @returns PR comment metadata and markdown.
 */
export function formatGitHubComment(
  blocks: readonly ParsedBlock[],
  results: readonly ExecutionResult[],
  suggestions: ReadonlyMap<string, AISuggestion> = new Map(),
  aiEnabled = false,
): PRComment {
  const summary = summarizeResults(results);
  const rows = joinResults(blocks, results).map(({ block, result }) =>
    formatTableRow(block, result),
  );
  const problemSections = joinResults(blocks, results)
    .filter(({ result }) =>
      ["fail", "timeout", "error"].includes(result.status),
    )
    .map(({ block, result }) =>
      formatProblemSection(
        block,
        result,
        suggestions.get(result.blockId),
        aiEnabled,
      ),
    );

  const markdown = [
    "<!-- docrunner-comment -->",
    "## 🔍 DocRunner Results",
    "",
    "| Status | Section | Language | Line |",
    "|--------|---------|----------|------|",
    ...rows,
    "",
    `**${formatSummary(summary)}**`,
    "",
    "---",
    "",
    ...problemSections,
    footer(),
  ].join("\n");

  return {
    summary: formatSummary(summary),
    markdown,
    hasFailures: summary.failed + summary.timeout + summary.error > 0,
    aiSuggestionsIncluded: suggestions.size > 0,
  };
}

/**
 * Formats one Markdown result table row.
 * @param block Parsed block metadata or null.
 * @param result Execution result.
 * @returns Markdown table row.
 */
function formatTableRow(
  block: ParsedBlock | null,
  result: ExecutionResult,
): string {
  return `| ${githubStatus(result)} | ${escapeMarkdown(blockLabel(block))} | \`${block?.language ?? "unknown"}\` | ${block?.startLine ?? "?"} |`;
}

/**
 * Formats a detailed GitHub failure section.
 * @param block Parsed block metadata or null.
 * @param result Execution result.
 * @param suggestion Optional AI suggestion.
 * @param aiEnabled Whether AI suggestions were requested.
 * @returns Markdown failure section.
 */
function formatProblemSection(
  block: ParsedBlock | null,
  result: ExecutionResult,
  suggestion: AISuggestion | undefined,
  aiEnabled: boolean,
): string {
  const language = block?.language ?? "text";
  const title =
    result.status === "timeout"
      ? "⏱️ Timeout"
      : result.status === "error"
        ? "⚠️ Error"
        : "❌ Fail";
  const output =
    result.errorMessage ??
    (result.stderr.trim() || "No error output captured.");
  const lines = [
    `### ${title} — ${escapeMarkdown(blockLabel(block))} — \`${language}\` · line ${block?.startLine ?? "?"}`,
    "",
    "```",
    output,
    "```",
    "",
  ];

  if (suggestion !== undefined) {
    lines.push(
      "**💡 Suggested fix** (via Claude):",
      "",
      suggestion.diagnosis,
      "",
      `\`\`\`${language}`,
      suggestion.fixedCode,
      "```",
    );
    if (suggestion.note !== null && suggestion.note.trim().length > 0) {
      lines.push("", `_${suggestion.note}_`);
    }
    lines.push("");
  } else if (aiEnabled) {
    lines.push(
      "_AI suggestions unavailable — add `ANTHROPIC_API_KEY` to use this feature._",
      "",
    );
  }

  lines.push("---", "");
  return lines.join("\n");
}

/**
 * Selects the GitHub table status label.
 * @param result Execution result.
 * @returns Emoji status label.
 */
function githubStatus(result: ExecutionResult): string {
  switch (result.status) {
    case "pass":
      return "✅ Pass";
    case "skipped":
      return "⏭️ Skip";
    case "timeout":
      return "⏱️ Timeout";
    case "error":
      return "⚠️ Error";
    case "fail":
      return "❌ Fail";
  }
}

/**
 * Escapes Markdown table-sensitive characters.
 * @param value Raw string.
 * @returns Escaped string.
 */
function escapeMarkdown(value: string): string {
  return value.replaceAll("|", "\\|");
}

/**
 * Builds the DocRunner PR comment footer.
 * @returns Markdown footer.
 */
function footer(): string {
  return "<sub>Powered by [DocRunner](https://docrunner.dev) · [Add badge](https://docrunner.dev/badge) · [View leaderboard](https://docrunner.dev)</sub>";
}
