import { access, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Command } from "commander";
import fg from "fast-glob";
import { parseMarkdownFile } from "../parser/index.js";
import { logger } from "../lib/logger.js";
import type { ParsedBlock, SupportedLanguage } from "../types/index.js";

/**
 * Registers the smart config initialization command.
 * @param program Commander program receiving the command.
 * @returns Nothing.
 */
export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Scan markdown files and create a smart docrunner.yml.")
    .action(async () => {
      try {
        const result = await initializeProject(process.cwd());
        process.stdout.write(`${result.message}\n`);
      } catch (error) {
        logger.error("Unable to initialize DocRunner.", {
          error: error instanceof Error ? error.message : "unknown error",
        });
        process.exitCode = 1;
      }
    });
}

export interface InitResult {
  config: string;
  blocks: ParsedBlock[];
  files: string[];
  message: string;
}

/**
 * Scans a project and writes a smart docrunner.yml without overwriting existing config.
 * @param cwd Project working directory.
 * @returns Generated config, discovered blocks/files, and summary message.
 */
export async function initializeProject(cwd: string): Promise<InitResult> {
  const configPath = resolve(cwd, "docrunner.yml");
  try {
    await access(configPath);
    throw new Error("docrunner.yml already exists; refusing to overwrite it.");
  } catch (error) {
    if (
      error instanceof Error &&
      !("code" in error && error.code === "ENOENT")
    ) {
      throw error;
    }
  }

  const files = (
    await fg(["*.md", "docs/**/*.md"], { cwd, onlyFiles: true, unique: true })
  ).sort();
  if (files.length === 0) {
    throw new Error("No markdown files found in the current project.");
  }

  const blocks = (
    await Promise.all(
      files.map((file) =>
        parseMarkdownFile(resolve(cwd, file), { file, skipPatterns: [] }),
      ),
    )
  ).flat();
  const languages = [...new Set(blocks.map((block) => block.language))].sort();
  const config = generateConfig(
    files,
    languages,
    process.env.ANTHROPIC_API_KEY !== undefined,
  );
  await writeFile(configPath, config, "utf8");
  return {
    config,
    blocks,
    files,
    message: summarizeDiscovery(blocks, files),
  };
}

/**
 * Generates a documented initial config.
 * @param files Detected markdown files.
 * @param languages Detected supported languages.
 * @param aiEnabled Whether an Anthropic key is currently available.
 * @returns YAML config string.
 */
export function generateConfig(
  files: readonly string[],
  languages: readonly SupportedLanguage[],
  aiEnabled: boolean,
): string {
  return [
    "version: 1",
    "files:",
    ...files.map((file) => `  - ${JSON.stringify(file)}`),
    ...(languages.length > 0
      ? ["languages:", ...languages.map((language) => `  - ${language}`)]
      : []),
    "timeout: 10",
    "",
    "# Add setup commands here if examples need project dependencies.",
    "setup: {}",
    "env: {}",
    "skip_patterns: []",
    "on_failure: error",
    `ai_suggestions: ${aiEnabled}`,
    "",
  ].join("\n");
}

/**
 * Summarizes detected blocks by language.
 * @param blocks Detected supported blocks.
 * @param files Detected markdown files.
 * @returns Human-readable init summary.
 */
function summarizeDiscovery(
  blocks: readonly ParsedBlock[],
  files: readonly string[],
): string {
  const counts = new Map<SupportedLanguage, number>();
  for (const block of blocks) {
    counts.set(block.language, (counts.get(block.language) ?? 0) + 1);
  }
  const detail = [...counts.entries()]
    .map(([language, count]) => `${count} ${language}`)
    .join(", ");
  return `Found ${blocks.length} code blocks${detail ? ` (${detail})` : ""} across ${files.length} files. Created docrunner.yml. Run \`docrunner run\` to test them.`;
}
