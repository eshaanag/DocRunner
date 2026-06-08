import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runBashCode } from "./bash.js";
import { runNodeCode } from "./node.js";
import { buildExecutionEnvironment, type ProcessResult } from "./process.js";
import { runPythonCode } from "./python.js";
import { runTypeScriptCode } from "./typescript.js";
import type {
  DocRunnerConfig,
  ExecutionResult,
  ParsedBlock,
  SupportedLanguage,
} from "../types/index.js";

/**
 * Executes parsed blocks while pairing setup blocks with the next matching language.
 * @param blocks Parsed blocks in source order.
 * @param config Validated DocRunner configuration.
 * @returns Reportable execution results excluding setup blocks.
 */
export async function runBlocks(
  blocks: readonly ParsedBlock[],
  config: DocRunnerConfig,
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  const pendingSetup = new Map<SupportedLanguage, ParsedBlock>();

  for (const block of blocks) {
    if (block.isSetup) {
      if (block.skipReason === null) {
        pendingSetup.set(block.language, block);
      }
      continue;
    }

    if (block.skipReason !== null) {
      results.push(skippedResult(block));
      continue;
    }

    const setupBlock = pendingSetup.get(block.language);
    pendingSetup.delete(block.language);
    results.push(await runBlock(block, config, setupBlock));
  }

  return results;
}

/**
 * Executes one target block in a fresh temporary workspace.
 * @param block Target block to execute.
 * @param config Validated DocRunner configuration.
 * @param setupBlock Optional setup block paired with the target.
 * @returns Classified target execution result.
 */
export async function runBlock(
  block: ParsedBlock,
  config: DocRunnerConfig,
  setupBlock?: ParsedBlock,
): Promise<ExecutionResult> {
  const workspace = await mkdtemp(join(tmpdir(), "docrunner-"));
  const env = buildExecutionEnvironment(config.env);
  const timeoutMs = config.timeout * 1_000;

  try {
    const projectSetup = config.setup[block.language];
    if (projectSetup !== undefined && projectSetup.trim().length > 0) {
      const setupResult = await runBashCode(
        projectSetup,
        workspace,
        timeoutMs,
        env,
      );
      if (setupResult.status !== "pass") {
        return fromProcessResult(block, setupResult, "project setup failed");
      }
    }

    if (setupBlock !== undefined) {
      const setupResult = await runLanguageCode(
        setupBlock.language,
        setupBlock.code,
        workspace,
        timeoutMs,
        env,
      );
      if (setupResult.status !== "pass") {
        return fromProcessResult(
          block,
          setupResult,
          "paired setup block failed",
        );
      }
    }

    const result = await runLanguageCode(
      block.language,
      block.code,
      workspace,
      timeoutMs,
      env,
    );
    return fromProcessResult(block, result);
  } catch (error) {
    return {
      blockId: block.id,
      status: "error",
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs: 0,
      skipReason: null,
      errorMessage: `Unable to execute ${block.language} block at ${block.file}:${block.startLine}: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

/**
 * Dispatches source code to its language-specific adapter.
 * @param language Normalized execution language.
 * @param code Source code to execute.
 * @param workspace Isolated working directory.
 * @param timeoutMs Execution timeout in milliseconds.
 * @param env Minimal subprocess environment.
 * @returns Classified process result.
 */
async function runLanguageCode(
  language: SupportedLanguage,
  code: string,
  workspace: string,
  timeoutMs: number,
  env: Record<string, string>,
): Promise<ProcessResult> {
  switch (language) {
    case "python":
      return runPythonCode(code, workspace, timeoutMs, env);
    case "javascript":
      return runNodeCode(code, workspace, timeoutMs, env);
    case "bash":
      return runBashCode(code, workspace, timeoutMs, env);
    case "typescript":
      return runTypeScriptCode(code, workspace, timeoutMs, env);
  }
}

/**
 * Converts a process result into the public execution contract.
 * @param block Target block associated with the process.
 * @param result Classified subprocess result.
 * @param setupFailure Optional setup failure context.
 * @returns Public execution result.
 */
function fromProcessResult(
  block: ParsedBlock,
  result: ProcessResult,
  setupFailure?: string,
): ExecutionResult {
  return {
    blockId: block.id,
    status: result.status,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: setupFailure
      ? `${setupFailure}: ${result.stderr || result.errorMessage || "unknown error"}`
      : result.stderr,
    durationMs: result.durationMs,
    skipReason: null,
    errorMessage: result.errorMessage,
  };
}

/**
 * Creates a reportable result for a skipped block.
 * @param block Parsed block with a skip reason.
 * @returns Skipped execution result.
 */
function skippedResult(block: ParsedBlock): ExecutionResult {
  return {
    blockId: block.id,
    status: "skipped",
    exitCode: null,
    stdout: "",
    stderr: "",
    durationMs: 0,
    skipReason: block.skipReason,
    errorMessage: null,
  };
}
