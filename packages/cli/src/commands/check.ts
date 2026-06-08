import type { Command } from "commander";
import { executeDocRunner, hasBlockingFailures } from "../core/run.js";
import {
  loadGitHubCommentContext,
  postOrUpdateGitHubComment,
} from "../github/commentClient.js";
import { logger } from "../lib/logger.js";
import { formatConsoleReport } from "../reporter/console.js";
import { formatGitHubComment } from "../reporter/github.js";
import { stringifyJsonReport } from "../reporter/json.js";

interface CheckOptions {
  config?: string;
  json?: boolean;
  githubComment?: boolean;
  postGithubComment?: boolean;
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
    .option("--json", "print machine-readable JSON")
    .option("--github-comment", "print GitHub PR comment markdown")
    .option(
      "--post-github-comment",
      "create or update a GitHub pull request comment",
    )
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
    const run = await executeDocRunner({
      cwd: process.cwd(),
      file,
      configPath: options.config,
      aiApiKey: process.env.ANTHROPIC_API_KEY,
    });
    const githubComment = formatGitHubComment(
      run.blocks,
      run.results,
      run.suggestions,
      run.config.ai_suggestions,
    );
    if (options.postGithubComment === true) {
      await postCommentIfConfigured(githubComment.markdown);
    }

    const output =
      options.json === true
        ? stringifyJsonReport(run.blocks, run.results, run.suggestions)
        : options.githubComment === true
          ? githubComment.markdown
          : formatConsoleReport(run.blocks, run.results, {
              version: "0.1.0",
              color: process.stdout.isTTY,
            });
    process.stdout.write(`${output}\n`);
    process.exitCode = hasBlockingFailures(run) ? 1 : 0;
  } catch (error) {
    logger.error("Unable to start DocRunner check.", {
      error: error instanceof Error ? error.message : "unknown error",
    });
    process.exitCode = 1;
  }
}

/**
 * Posts a GitHub comment when token and event context are available.
 * @param markdown Comment markdown body.
 * @returns Promise that settles after best-effort posting.
 */
async function postCommentIfConfigured(markdown: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (token === undefined || eventPath === undefined) {
    logger.warn(
      "GitHub comment skipped because token or event path is missing.",
    );
    return;
  }

  try {
    const context = await loadGitHubCommentContext(eventPath);
    await postOrUpdateGitHubComment({ token, context, body: markdown });
  } catch (error) {
    logger.warn(
      "GitHub comment update failed; results are still available in logs.",
      {
        error: error instanceof Error ? error.message : "unknown error",
      },
    );
  }
}
