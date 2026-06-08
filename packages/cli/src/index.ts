#!/usr/bin/env node
import { Command } from "commander";
import { registerCheckCommand } from "./commands/check.js";
import { registerRunCommand } from "./commands/run.js";

/**
 * Builds the DocRunner CLI program.
 * @returns Configured Commander program.
 */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("docrunner")
    .description("Run README code snippets in CI with helpful failure output.")
    .version("0.1.0");

  registerRunCommand(program);
  registerCheckCommand(program);

  return program;
}

/**
 * Runs the CLI with process arguments.
 * @param argv Command-line arguments.
 * @returns Promise that settles after command handling.
 */
export async function main(argv: string[]): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

await main(process.argv);
