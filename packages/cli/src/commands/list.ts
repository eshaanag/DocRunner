import type { Command } from "commander";
import { discoverDocRunner } from "../core/run.js";
import { logger } from "../lib/logger.js";
import type { ParsedBlock } from "../types/index.js";

interface ListOptions {
  config?: string;
}

/**
 * Registers the parser-only block listing command.
 * @param program Commander program receiving the command.
 * @returns Nothing.
 */
export function registerListCommand(program: Command): void {
  program
    .command("list")
    .argument("[file]", "markdown file to inspect")
    .option("-c, --config <path>", "path to docrunner.yml")
    .description(
      "List detected blocks and skip reasons without executing code.",
    )
    .action(async (file: string | undefined, options: ListOptions) => {
      try {
        const discovery = await discoverDocRunner({
          cwd: process.cwd(),
          file,
          configPath: options.config,
        });
        process.stdout.write(`${formatBlockList(discovery.blocks)}\n`);
      } catch (error) {
        logger.error("Unable to list DocRunner blocks.", {
          error: error instanceof Error ? error.message : "unknown error",
        });
        process.exitCode = 1;
      }
    });
}

/**
 * Formats detected blocks for terminal preview.
 * @param blocks Detected parsed blocks.
 * @returns Human-readable block list.
 */
export function formatBlockList(blocks: readonly ParsedBlock[]): string {
  if (blocks.length === 0) {
    return "No supported code blocks found.";
  }

  return blocks
    .map((block) => {
      const label = block.name ?? block.heading ?? "Unlabeled block";
      const state = block.isSetup
        ? "setup"
        : block.skipReason === null
          ? "execute"
          : `skip: ${block.skipReason}`;
      return `${block.file}:${block.startLine}  ${block.language.padEnd(10)}  ${label}  [${state}]`;
    })
    .join("\n");
}
