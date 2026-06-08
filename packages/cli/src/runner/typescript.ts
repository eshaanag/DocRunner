import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runProcess, type ProcessResult } from "./process.js";

const require = createRequire(import.meta.url);

/**
 * Executes TypeScript code through ts-node in an isolated workspace.
 * @param code TypeScript source code.
 * @param workspace Isolated working directory.
 * @param timeoutMs Execution timeout in milliseconds.
 * @param env Minimal subprocess environment.
 * @returns Classified subprocess result.
 */
export async function runTypeScriptCode(
  code: string,
  workspace: string,
  timeoutMs: number,
  env: Record<string, string>,
): Promise<ProcessResult> {
  const script = join(workspace, "script.ts");
  await writeFile(script, code, "utf8");

  try {
    const tsNode = require.resolve("ts-node/dist/bin.js");
    return runProcess({
      command: process.execPath,
      args: [
        tsNode,
        "--transpile-only",
        "--compiler-options",
        '{"module":"CommonJS","moduleResolution":"Node"}',
        script,
      ],
      cwd: workspace,
      timeoutMs,
      env,
    });
  } catch (error) {
    return {
      status: "error",
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs: 0,
      errorMessage:
        `TypeScript blocks require ts-node. Add it to your setup: \`npm install -g ts-node typescript\`. ${error instanceof Error ? error.message : ""}`.trim(),
    };
  }
}
