import type { Command } from "commander";
import { ConfigLoadError, loadConfig } from "../config/index.js";

export interface CheckCommandOptions {
  config?: string;
}

/**
 * Registers the CI check command.
 * @param program Commander program instance to extend.
 * @returns Nothing.
 */
export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .argument("[file]", "Markdown file to check")
    .option("-c, --config <path>", "Path to docrunner.yml")
    .description("Run README code checks for CI")
    .action(async (file: string | undefined, options: CheckCommandOptions) => {
      try {
        const config = await loadConfig({
          cwd: process.cwd(),
          configPath: options.config,
        });
        const files = file === undefined ? config.files : [file];
        process.stdout.write(
          `DocRunner config valid. CI files selected: ${files.join(", ")}.\n`,
        );
        process.stdout.write(
          "Parser and execution runner are scheduled for the next phases.\n",
        );
      } catch (error) {
        handleCommandError(error);
      }
    });
}

/**
 * Writes command errors and sets a failing exit code.
 * @param error Unknown error thrown during command execution.
 * @returns Nothing.
 */
function handleCommandError(error: unknown): void {
  if (error instanceof ConfigLoadError) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    process.stderr.write(`Unexpected check command error: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  process.stderr.write("Unexpected check command error.\n");
  process.exitCode = 1;
}
