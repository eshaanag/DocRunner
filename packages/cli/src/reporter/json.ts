import {
  joinResults,
  summarizeResults,
  type ResultSummary,
} from "./summary.js";
import type {
  AISuggestion,
  ExecutionResult,
  ParsedBlock,
} from "../types/index.js";

export interface JsonReport {
  schemaVersion: 1;
  files: string[];
  summary: ResultSummary;
  results: JsonReportResult[];
}

export interface JsonReportResult {
  blockId: string;
  file: string | null;
  heading: string | null;
  name: string | null;
  language: string | null;
  line: number | null;
  status: ExecutionResult["status"];
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  skipReason: string | null;
  errorMessage: string | null;
  aiSuggestion: AISuggestion | null;
}

/**
 * Formats execution results as a schema-versioned JSON report object.
 * @param blocks Parsed blocks associated with the results.
 * @param results Execution results to serialize.
 * @param suggestions Optional AI suggestions keyed by block ID.
 * @returns Stable machine-readable report.
 */
export function formatJsonReport(
  blocks: readonly ParsedBlock[],
  results: readonly ExecutionResult[],
  suggestions: ReadonlyMap<string, AISuggestion> = new Map(),
): JsonReport {
  const files = [...new Set(blocks.map((block) => block.file))].sort();
  return {
    schemaVersion: 1,
    files,
    summary: summarizeResults(results),
    results: joinResults(blocks, results).map(({ block, result }) => ({
      blockId: result.blockId,
      file: block?.file ?? null,
      heading: block?.heading ?? null,
      name: block?.name ?? null,
      language: block?.language ?? null,
      line: block?.startLine ?? null,
      status: result.status,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      skipReason: result.skipReason,
      errorMessage: result.errorMessage,
      aiSuggestion: suggestions.get(result.blockId) ?? null,
    })),
  };
}

/**
 * Formats execution results as pretty JSON text.
 * @param blocks Parsed blocks associated with the results.
 * @param results Execution results to serialize.
 * @param suggestions Optional AI suggestions keyed by block ID.
 * @returns Pretty-printed JSON string.
 */
export function stringifyJsonReport(
  blocks: readonly ParsedBlock[],
  results: readonly ExecutionResult[],
  suggestions: ReadonlyMap<string, AISuggestion> = new Map(),
): string {
  return JSON.stringify(
    formatJsonReport(blocks, results, suggestions),
    null,
    2,
  );
}
