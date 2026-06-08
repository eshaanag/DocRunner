import type { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { logger } from "../lib/logger.js";

interface CheckOptions {
  config?: string;
}

/**
 * Registers the CI-oriented check command.
 * @param program Commander program receiving the command.
 * @returns Nothing.
 */
export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .argument("[file]", "markdown file to check")
    .option("-c, --config <path>", "path to docrunner.yml")
    .description(
      "Run README checks and exit non-zero when executable examples fail.",
    )
    .action(handleCheck);
}

/**
 * Validates check command configuration before parser integration.
 * @param file Optional markdown file override.
 * @param options Check command options.
 * @returns Promise that settles after validation and reporting.
 */
async function handleCheck(
  file: string | undefined,
  options: CheckOptions,
): Promise<void> {
  try {
    const config = await loadConfig({
      cwd: process.cwd(),
      configPath: options.config,
    });
    logger.info("DocRunner check command is ready for parser integration.", {
      file: file ?? null,
      configuredFiles: config.files.length,
    });
  } catch (error) {
    logger.error("Unable to start DocRunner check.", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    process.exitCode = 1;
  }
}
