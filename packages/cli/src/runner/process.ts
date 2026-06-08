import { spawn } from "node:child_process";
import type { ExecutionStatus } from "../types/index.js";

export interface ProcessRequest {
  command: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  env: Record<string, string>;
}

export interface ProcessResult {
  status: Exclude<ExecutionStatus, "skipped">;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  errorMessage: string | null;
}

const MINIMAL_PATH = [
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  "/opt/homebrew/bin",
].join(":");

/**
 * Builds the isolated environment passed to snippet subprocesses.
 * @param configuredEnvironment User-configured environment values.
 * @returns Minimal execution environment.
 */
export function buildExecutionEnvironment(
  configuredEnvironment: Record<string, string>,
): Record<string, string> {
  return {
    DOCRUNNER: "1",
    HOME: "/tmp",
    PATH: MINIMAL_PATH,
    ...configuredEnvironment,
  };
}

/**
 * Executes one subprocess with output capture and timeout classification.
 * @param request Command, workspace, timeout, and environment.
 * @returns Classified subprocess result.
 */
export async function runProcess(
  request: ProcessRequest,
): Promise<ProcessResult> {
  const startedAt = performance.now();

  return new Promise<ProcessResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(request.command, [...request.args], {
      cwd: request.cwd,
      env: request.env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid);
    }, request.timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.once("error", (error) => {
      finish({
        status: "error",
        exitCode: null,
        errorMessage: `Unable to start ${request.command}: ${error.message}`,
      });
    });

    child.once("close", (exitCode) => {
      if (timedOut) {
        finish({
          status: "timeout",
          exitCode: null,
          errorMessage: null,
        });
        return;
      }

      finish({
        status: exitCode === 0 ? "pass" : "fail",
        exitCode,
        errorMessage: null,
      });
    });

    /**
     * Resolves the process result once and clears its timeout.
     * @param outcome Final status, exit code, and infrastructure error.
     * @returns Nothing.
     */
    function finish(
      outcome: Pick<ProcessResult, "status" | "exitCode" | "errorMessage">,
    ): void {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve({
        ...outcome,
        stdout,
        stderr,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  });
}

/**
 * Terminates a child process and its process group when supported.
 * @param pid Child process identifier.
 * @returns Nothing.
 */
function killProcessTree(pid: number | undefined): void {
  if (pid === undefined) {
    return;
  }

  try {
    process.kill(process.platform === "win32" ? pid : -pid, "SIGKILL");
  } catch {
    // The process may have exited between the timeout and kill attempt.
  }
}
