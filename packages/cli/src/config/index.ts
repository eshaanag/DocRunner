import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { parse as parseYaml } from "yaml";
import { ZodError } from "zod";
import { docRunnerConfigSchema } from "./schema.js";
import type { DocRunnerConfig } from "../types/index.js";
import type { z } from "zod";

export interface LoadConfigOptions {
  cwd: string;
  configPath?: string | undefined;
}

export class ConfigLoadError extends Error {
  readonly path: string;

  /**
   * Creates a config load error with the source file path attached.
   * @param message Human-readable config error message.
   * @param path Path to the config file or default path.
   * @returns A ConfigLoadError instance.
   */
  constructor(message: string, path: string) {
    super(message);
    this.name = "ConfigLoadError";
    this.path = path;
  }
}

type ParsedConfig = z.infer<typeof docRunnerConfigSchema>;

/**
 * Loads docrunner.yml from disk, validates it, and applies defaults.
 * @param options Current working directory and optional config path.
 * @returns Validated DocRunner configuration.
 */
export async function loadConfig(
  options: LoadConfigOptions,
): Promise<DocRunnerConfig> {
  const configPath = options.configPath ?? "docrunner.yml";
  const fullPath = new URL(configPath, `file://${options.cwd}/`).pathname;
  const exists = await fileExists(fullPath);

  if (!exists) {
    return normalizeConfig(docRunnerConfigSchema.parse({}));
  }

  try {
    const raw = await readFile(fullPath, "utf8");
    const parsed = parseYaml(raw) as unknown;
    return normalizeConfig(docRunnerConfigSchema.parse(parsed ?? {}));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConfigLoadError(formatZodError(error), configPath);
    }

    if (error instanceof Error) {
      throw new ConfigLoadError(
        `Failed to parse ${configPath}: ${error.message}`,
        configPath,
      );
    }

    throw new ConfigLoadError(`Failed to parse ${configPath}.`, configPath);
  }
}

/**
 * Normalizes Zod output into the stable public config interface.
 * @param config Parsed config returned by the Zod schema.
 * @returns Stable DocRunner config with explicit undefined optionals.
 */
function normalizeConfig(config: ParsedConfig): DocRunnerConfig {
  return {
    version: config.version,
    files: config.files,
    languages: config.languages,
    timeout: config.timeout,
    setup: config.setup,
    env: config.env,
    skip_patterns: config.skip_patterns,
    on_failure: config.on_failure,
    ai_suggestions: config.ai_suggestions,
    leaderboard: config.leaderboard,
  };
}

/**
 * Checks whether a file can be read.
 * @param path File path to check.
 * @returns True when the file exists and is readable.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formats Zod validation issues into actionable config messages.
 * @param error Zod validation error from the config schema.
 * @returns Multiline human-readable error message.
 */
function formatZodError(error: ZodError): string {
  const messages = error.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join(".") : "config";
    return `${field}: ${issue.message}`;
  });

  return `Invalid docrunner.yml:\n${messages.join("\n")}`;
}
