import type { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { logger } from "../lib/logger.js";

interface RunOptions {
  config?: string;
}

/**
 * Registers the local exploratory run command.
 * @param program Commander program receiving the command.
 * @returns Nothing.
 */
export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .argument("[file]", "markdown file to check")
    .option("-c, --config <path>", "path to docrunner.yml")
    .description(
      "Run README checks locally and always exit zero for snippet failures.",
    )
    .action(handleRun);
}

/**
 * Validates run command configuration before parser integration.
 * @param file Optional markdown file override.
 * @param options Run command options.
 * @returns Promise that settles after validation and reporting.
 */
async function handleRun(
  file: string | undefined,
  options: RunOptions,
): Promise<void> {
  try {
    const config = await loadConfig({
      cwd: process.cwd(),
      configPath: options.config,
    });
    logger.info("DocRunner run command is ready for parser integration.", {
      file: file ?? null,
      configuredFiles: config.files.length,
    });
  } catch (error) {
    logger.error("Unable to start DocRunner run.", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    process.exitCode = 1;
  }
}
