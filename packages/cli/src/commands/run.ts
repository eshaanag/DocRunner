import type { Command } from "commander";
import { ConfigLoadError, loadConfig } from "../config/index.js";

export interface RunCommandOptions {
  config?: string;
}

/**
 * Registers the local run command.
 * @param program Commander program instance to extend.
 * @returns Nothing.
 */
export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .argument("[file]", "Markdown file to check")
    .option("-c, --config <path>", "Path to docrunner.yml")
    .description("Run README code checks locally and exit 0")
    .action(async (file: string | undefined, options: RunCommandOptions) => {
      try {
        const config = await loadConfig({
          cwd: process.cwd(),
          configPath: options.config,
        });
        const files = file === undefined ? config.files : [file];
        process.stdout.write(
          `DocRunner config valid. Files selected: ${files.join(", ")}.\n`,
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
    process.stderr.write(`Unexpected run command error: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  process.stderr.write("Unexpected run command error.\n");
  process.exitCode = 1;
}
