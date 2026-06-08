import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runProcess, type ProcessResult } from "./process.js";

/**
 * Executes JavaScript code in an existing isolated workspace.
 * @param code JavaScript source code.
 * @param workspace Isolated working directory.
 * @param timeoutMs Execution timeout in milliseconds.
 * @param env Minimal subprocess environment.
 * @returns Classified subprocess result.
 */
export async function runNodeCode(
  code: string,
  workspace: string,
  timeoutMs: number,
  env: Record<string, string>,
): Promise<ProcessResult> {
  const extension = /\b(?:import|export)\s/u.test(code) ? "mjs" : "js";
  const script = join(workspace, `script.${extension}`);
  await writeFile(script, code, "utf8");
  return runProcess({
    command: process.execPath,
    args: [script],
    cwd: workspace,
    timeoutMs,
    env,
  });
}
