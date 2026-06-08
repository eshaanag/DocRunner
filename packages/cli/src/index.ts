#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { Command } from "commander";
import { registerCheckCommand } from "./commands/check.js";
import { registerInitCommand } from "./commands/init.js";
import { registerListCommand } from "./commands/list.js";
import { registerRunCommand } from "./commands/run.js";
import { registerSuggestCommand } from "./commands/suggest.js";
import { logger } from "./lib/logger.js";

/**
 * Builds the DocRunner command-line program.
 * @returns Configured Commander program.
 */
export function buildProgram(): Command {
  const program = new Command();
  program
    .name("docrunner")
    .description("Test README code examples before your users do.")
    .version("0.1.0");

  registerRunCommand(program);
  registerCheckCommand(program);
  registerInitCommand(program);
  registerListCommand(program);
  registerSuggestCommand(program);
  return program;
}

/**
 * Parses command-line arguments and reports startup failures.
 * @param argv Complete process argument vector.
 * @returns Promise that settles after command handling.
 */
export async function main(argv: string[]): Promise<void> {
  try {
    await buildProgram().parseAsync(argv);
  } catch (error) {
    logger.error("DocRunner could not parse the command.", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    process.exitCode = 1;
  }
}

if (isEntrypoint(process.argv[1])) {
  await main(process.argv);
}

/**
 * Checks whether this module is the invoked executable, including npm bin symlinks.
 * @param entrypoint Process entrypoint path.
 * @returns True when the CLI should run immediately.
 */
export function isEntrypoint(entrypoint: string | undefined): boolean {
  if (entrypoint === undefined) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(realpathSync(entrypoint)).href;
  } catch {
    return import.meta.url === pathToFileURL(entrypoint).href;
  }
}
