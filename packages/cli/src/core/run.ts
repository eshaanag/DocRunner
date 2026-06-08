import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fg from "fast-glob";
import { suggestFix } from "../ai/fixSuggester.js";
import { loadConfig } from "../config/index.js";
import { parseMarkdown } from "../parser/index.js";
import { runBlocks } from "../runner/index.js";
import type {
  AISuggestion,
  DocRunnerConfig,
  ExecutionResult,
  ParsedBlock,
} from "../types/index.js";

export interface ExecuteDocRunnerOptions {
  cwd: string;
  file?: string | undefined;
  configPath?: string | undefined;
  aiApiKey?: string | undefined;
}

export interface DocRunnerRun {
  config: DocRunnerConfig;
  blocks: ParsedBlock[];
  results: ExecutionResult[];
  suggestions: Map<string, AISuggestion>;
  files: string[];
}

/**
 * Runs config loading, parsing, execution, and optional AI suggestions.
 * @param options Working directory and command overrides.
 * @returns Complete DocRunner run.
 */
export async function executeDocRunner(
  options: ExecuteDocRunnerOptions,
): Promise<DocRunnerRun> {
  const config = await loadConfig({
    cwd: options.cwd,
    configPath: options.configPath,
  });
  const files = await resolveMarkdownFiles(
    options.cwd,
    options.file ?? config.files,
  );
  const fileContents = await readMarkdownFiles(options.cwd, files);
  const blocks = [...fileContents.entries()].flatMap(([file, markdown]) =>
    parseMarkdown(markdown, { file, skipPatterns: config.skip_patterns }),
  );
  const selectedBlocks =
    config.languages === undefined
      ? blocks
      : blocks.filter((block) => config.languages?.includes(block.language));
  const results = await runBlocks(selectedBlocks, config);
  const suggestions = await collectSuggestions(
    selectedBlocks,
    results,
    fileContents,
    config,
    options.aiApiKey,
  );

  return { config, blocks: selectedBlocks, results, suggestions, files };
}

/**
 * Determines whether a completed run should fail CI.
 * @param run Completed DocRunner run.
 * @returns True when check should exit non-zero.
 */
export function hasBlockingFailures(run: DocRunnerRun): boolean {
  return (
    run.config.on_failure === "error" &&
    run.results.some((result) =>
      ["fail", "timeout", "error"].includes(result.status),
    )
  );
}

/**
 * Resolves markdown patterns relative to a working directory.
 * @param cwd Working directory.
 * @param patterns File override or configured globs.
 * @returns Sorted relative file paths.
 */
async function resolveMarkdownFiles(
  cwd: string,
  patterns: string | readonly string[],
): Promise<string[]> {
  const requested = Array.isArray(patterns) ? patterns : [patterns];
  const matches = await fg(requested, { cwd, onlyFiles: true, unique: true });
  if (matches.length === 0) {
    throw new Error(`No markdown files matched: ${requested.join(", ")}`);
  }
  return matches.sort();
}

/**
 * Reads markdown files into a relative-path content map.
 * @param cwd Working directory.
 * @param files Relative markdown file paths.
 * @returns File content map.
 */
async function readMarkdownFiles(
  cwd: string,
  files: readonly string[],
): Promise<Map<string, string>> {
  const entries = await Promise.all(
    files.map(
      async (file) =>
        [file, await readFile(resolve(cwd, file), "utf8")] as const,
    ),
  );
  return new Map(entries);
}

/**
 * Requests suggestions for eligible runtime failures.
 * @param blocks Parsed blocks.
 * @param results Execution results.
 * @param fileContents Markdown content by file.
 * @param config Validated config.
 * @param apiKey Optional Anthropic API key.
 * @returns Suggestions keyed by block ID.
 */
async function collectSuggestions(
  blocks: readonly ParsedBlock[],
  results: readonly ExecutionResult[],
  fileContents: ReadonlyMap<string, string>,
  config: DocRunnerConfig,
  apiKey: string | undefined,
): Promise<Map<string, AISuggestion>> {
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  const suggestions = new Map<string, AISuggestion>();

  for (const result of results) {
    const block = blocksById.get(result.blockId);
    if (block === undefined) {
      continue;
    }
    const suggestion = await suggestFix({
      block,
      result,
      surroundingText: fileContents.get(block.file) ?? "",
      enabled: config.ai_suggestions,
      apiKey,
    });
    if (suggestion !== null) {
      suggestions.set(block.id, suggestion);
    }
  }

  return suggestions;
}
