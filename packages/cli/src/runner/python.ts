import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runProcess, type ProcessResult } from "./process.js";

/**
 * Executes Python code in an existing isolated workspace.
 * @param code Python source code.
 * @param workspace Isolated working directory.
 * @param timeoutMs Execution timeout in milliseconds.
 * @param env Minimal subprocess environment.
 * @returns Classified subprocess result.
 */
export async function runPythonCode(
  code: string,
  workspace: string,
  timeoutMs: number,
  env: Record<string, string>,
): Promise<ProcessResult> {
  const script = join(workspace, "script.py");
  await writeFile(script, code, "utf8");
  return runProcess({
    command: "python3",
    args: [script],
    cwd: workspace,
    timeoutMs,
    env,
  });
}
