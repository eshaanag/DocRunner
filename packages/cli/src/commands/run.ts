import type { Command } from "commander";
import { executeDocRunner } from "../core/run.js";
import { logger } from "../lib/logger.js";
import { formatConsoleReport } from "../reporter/console.js";
import { stringifyJsonReport } from "../reporter/json.js";

interface RunOptions {
  config?: string;
  json?: boolean;
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
    .option("--json", "print machine-readable JSON")
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
    const run = await executeDocRunner({
      cwd: process.cwd(),
      file,
      configPath: options.config,
      aiApiKey: process.env.ANTHROPIC_API_KEY,
    });
    const output =
      options.json === true
        ? stringifyJsonReport(run.blocks, run.results, run.suggestions)
        : formatConsoleReport(run.blocks, run.results, {
            version: "0.1.0",
            color: process.stdout.isTTY,
          });
    process.stdout.write(`${output}\n`);
  } catch (error) {
    logger.error("Unable to start DocRunner run.", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    process.exitCode = 1;
  }
}
