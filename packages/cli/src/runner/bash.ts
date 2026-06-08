import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runProcess, type ProcessResult } from "./process.js";

/**
 * Executes Bash code in an existing isolated workspace.
 * @param code Bash source code.
 * @param workspace Isolated working directory.
 * @param timeoutMs Execution timeout in milliseconds.
 * @param env Minimal subprocess environment.
 * @returns Classified subprocess result.
 */
export async function runBashCode(
  code: string,
  workspace: string,
  timeoutMs: number,
  env: Record<string, string>,
): Promise<ProcessResult> {
  const script = join(workspace, "script.sh");
  await writeFile(script, code, { encoding: "utf8", mode: 0o700 });
  return runProcess({
    command: "/bin/bash",
    args: ["-e", script],
    cwd: workspace,
    timeoutMs,
    env,
  });
}
