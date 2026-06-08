import { Chalk, type ChalkInstance } from "chalk";
import {
  blockLabel,
  formatSummary,
  joinResults,
  summarizeResults,
} from "./summary.js";
import type { ExecutionResult, ParsedBlock } from "../types/index.js";

export interface ConsoleReportOptions {
  version: string;
  color?: boolean | undefined;
}

/**
 * Formats execution results for terminal output.
 * @param blocks Parsed blocks associated with the results.
 * @param results Execution results to render.
 * @param options Version and color settings.
 * @returns Human-readable terminal report.
 */
export function formatConsoleReport(
  blocks: readonly ParsedBlock[],
  results: readonly ExecutionResult[],
  options: ConsoleReportOptions,
): string {
  const chalk = new Chalk({ level: options.color === true ? 1 : 0 });
  const summary = summarizeResults(results);
  const files =
    [...new Set(blocks.map((block) => block.file))].join(", ") || "no files";
  const lines = [`docrunner v${options.version}  ·  ${files}`, ""];

  for (const joined of joinResults(blocks, results)) {
    lines.push(formatRow(joined.block, joined.result, chalk));
  }

  lines.push(
    "",
    chalk.dim("  ─────────────────────────────────────────────"),
    `  Results: ${formatSummary(summary)}`,
    `  Duration: ${summary.durationMs}ms`,
  );

  const problemResults = joinResults(blocks, results).filter(({ result }) =>
    ["fail", "timeout", "error"].includes(result.status),
  );

  for (const { block, result } of problemResults) {
    lines.push("", formatProblem(block, result, chalk));
  }

  if (
    results.length > 0 &&
    summary.passed === 0 &&
    summary.skipped === results.length
  ) {
    lines.push(
      "",
      chalk.yellow(
        "  0 blocks executed. Your README may have no executable examples or all were auto-skipped. Run with --verbose to see why.",
      ),
    );
  }

  lines.push(chalk.dim("  ─────────────────────────────────────────────"));
  return lines.join("\n");
}

/**
 * Formats one terminal result row.
 * @param block Parsed block metadata or null.
 * @param result Execution result.
 * @param chalk Chalk instance configured for this report.
 * @returns Aligned terminal row.
 */
function formatRow(
  block: ParsedBlock | null,
  result: ExecutionResult,
  chalk: ChalkInstance,
): string {
  const icon = statusIcon(result, chalk);
  const label = `"${blockLabel(block)}"`.padEnd(24);
  const language = (block?.language ?? "unknown").padEnd(11);
  const line = `line ${block?.startLine ?? "?"}`.padEnd(10);
  const duration =
    result.status === "skipped"
      ? `skipped (${result.skipReason ?? "not executable"})`
      : `${result.durationMs}ms`;
  return `  ${icon}  ${label} ${language} ${line} ${chalk.dim(duration)}`;
}

/**
 * Formats a detailed failure, timeout, or infrastructure error section.
 * @param block Parsed block metadata or null.
 * @param result Execution result.
 * @param chalk Chalk instance configured for this report.
 * @returns Multiline problem section.
 */
function formatProblem(
  block: ParsedBlock | null,
  result: ExecutionResult,
  chalk: ChalkInstance,
): string {
  const language = block?.language ?? "unknown";
  const location = `${block?.file ?? "unknown"}:${block?.startLine ?? "?"}`;
  const detail =
    result.errorMessage ??
    (result.stderr.trim() || "No error output captured.");
  const title =
    result.status === "timeout"
      ? "TIMED OUT"
      : result.status === "error"
        ? "ERROR"
        : "FAILED";

  return [
    chalk.red(
      `  ✗ ${title}: "${blockLabel(block)}" (${language} · ${location})`,
    ),
    `    ${detail}`,
    "",
    "    Hint: Run `docrunner suggest <file:line>` for an AI-generated fix.",
  ].join("\n");
}

/**
 * Selects a status icon with optional color.
 * @param result Execution result.
 * @param chalk Chalk instance configured for this report.
 * @returns Status icon string.
 */
function statusIcon(result: ExecutionResult, chalk: ChalkInstance): string {
  switch (result.status) {
    case "pass":
      return chalk.green("✓");
    case "skipped":
      return chalk.dim("⊘");
    case "timeout":
    case "error":
    case "fail":
      return chalk.red("✗");
  }
}
