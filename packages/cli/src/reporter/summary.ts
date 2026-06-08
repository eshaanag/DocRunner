import type { ExecutionResult, ParsedBlock } from "../types/index.js";

export interface ResultSummary {
  passed: number;
  failed: number;
  skipped: number;
  timeout: number;
  error: number;
  durationMs: number;
}

export interface JoinedResult {
  block: ParsedBlock | null;
  result: ExecutionResult;
}

/**
 * Computes aggregate counts from execution results.
 * @param results Execution results to summarize.
 * @returns Status counts and total duration.
 */
export function summarizeResults(
  results: readonly ExecutionResult[],
): ResultSummary {
  return results.reduce<ResultSummary>(
    (summary, result) => ({
      passed: summary.passed + (result.status === "pass" ? 1 : 0),
      failed: summary.failed + (result.status === "fail" ? 1 : 0),
      skipped: summary.skipped + (result.status === "skipped" ? 1 : 0),
      timeout: summary.timeout + (result.status === "timeout" ? 1 : 0),
      error: summary.error + (result.status === "error" ? 1 : 0),
      durationMs: summary.durationMs + result.durationMs,
    }),
    { passed: 0, failed: 0, skipped: 0, timeout: 0, error: 0, durationMs: 0 },
  );
}

/**
 * Joins execution results to parsed block metadata by block ID.
 * @param blocks Parsed blocks that produced the results.
 * @param results Execution results to enrich with metadata.
 * @returns Joined results preserving result order.
 */
export function joinResults(
  blocks: readonly ParsedBlock[],
  results: readonly ExecutionResult[],
): JoinedResult[] {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  return results.map((result) => ({
    result,
    block: blocksById.get(result.blockId) ?? null,
  }));
}

/**
 * Selects the display label for a block.
 * @param block Parsed block metadata.
 * @returns Name, heading, or fallback section label.
 */
export function blockLabel(block: ParsedBlock | null): string {
  return block?.name ?? block?.heading ?? "Unlabeled block";
}

/**
 * Formats a summary using DocRunner's human-readable wording.
 * @param summary Aggregate result counts.
 * @returns Compact summary string.
 */
export function formatSummary(summary: ResultSummary): string {
  const parts = [
    `${summary.passed} passed`,
    `${summary.failed} failed`,
    `${summary.skipped} skipped`,
  ];

  if (summary.timeout > 0) {
    parts.push(`${summary.timeout} timed out`);
  }

  if (summary.error > 0) {
    parts.push(`${summary.error} errored`);
  }

  return parts.join(" · ");
}
