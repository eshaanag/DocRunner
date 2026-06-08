import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Command } from "commander";
import { suggestFix, type ClaudeClient } from "../ai/fixSuggester.js";
import { executeDocRunner } from "../core/run.js";
import { logger } from "../lib/logger.js";

/**
 * Registers targeted AI fix suggestions.
 * @param program Commander program receiving the command.
 * @returns Nothing.
 */
export function registerSuggestCommand(program: Command): void {
  program
    .command("suggest")
    .argument("<file:line>", "failing block location")
    .description("Get an AI-generated fix for one failing block.")
    .action(async (location: string) => {
      try {
        process.stdout.write(
          `${await suggestAtLocation(process.cwd(), location)}\n`,
        );
      } catch (error) {
        logger.error("Unable to suggest a DocRunner fix.", {
          error: error instanceof Error ? error.message : "unknown error",
        });
        process.exitCode = 1;
      }
    });
}

/**
 * Executes a file and requests a fix for one exact block line.
 * @param cwd Project working directory.
 * @param location Location formatted as file:line.
 * @returns Human-readable suggestion.
 */
export async function suggestAtLocation(
  cwd: string,
  location: string,
): Promise<string> {
  return suggestAtLocationWithOptions(cwd, location, {
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

export interface SuggestLocationOptions {
  apiKey?: string | undefined;
  client?: ClaudeClient | undefined;
}

/**
 * Executes and suggests a fix using explicit AI client options.
 * @param cwd Project working directory.
 * @param location Location formatted as file:line.
 * @param options API key and optional mock/client.
 * @returns Human-readable suggestion.
 */
export async function suggestAtLocationWithOptions(
  cwd: string,
  location: string,
  options: SuggestLocationOptions,
): Promise<string> {
  const match = /^(.*):(\d+)$/u.exec(location);
  if (match === null) {
    throw new Error(
      "Location must use the format file:line, for example README.md:23.",
    );
  }
  const file = match[1] ?? "";
  const line = Number(match[2]);
  const apiKey = options.apiKey;
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error("AI suggestions require ANTHROPIC_API_KEY.");
  }

  const run = await executeDocRunner({ cwd, file, aiApiKey: undefined });
  const block = run.blocks.find((candidate) => candidate.startLine === line);
  if (block === undefined) {
    throw new Error(`No supported block found at ${location}.`);
  }
  const result = run.results.find(
    (candidate) => candidate.blockId === block.id,
  );
  if (result === undefined || result.status !== "fail") {
    throw new Error(`Block at ${location} did not produce a runtime failure.`);
  }
  const suggestion = await suggestFix({
    block,
    result,
    surroundingText: await readFile(resolve(cwd, file), "utf8"),
    enabled: true,
    apiKey,
    client: options.client,
  });
  if (suggestion === null) {
    throw new Error(
      "AI suggestion unavailable; verify ANTHROPIC_API_KEY and try again.",
    );
  }

  return [
    `Diagnosis: ${suggestion.diagnosis}`,
    "",
    suggestion.fixedCode,
    ...(suggestion.note === null ? [] : ["", `Note: ${suggestion.note}`]),
  ].join("\n");
}
