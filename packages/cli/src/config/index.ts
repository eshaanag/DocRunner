import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { ZodError, type z } from "zod";
import { docRunnerConfigSchema } from "./schema.js";
import type { DocRunnerConfig } from "../types/index.js";

export interface LoadConfigOptions {
  cwd: string;
  configPath?: string | undefined;
}

export class ConfigLoadError extends Error {
  readonly path: string;

  /**
   * Creates a config error that preserves the source path.
   * @param message Actionable error message.
   * @param path Config path associated with the error.
   * @returns ConfigLoadError instance.
   */
  constructor(message: string, path: string) {
    super(message);
    this.name = "ConfigLoadError";
    this.path = path;
  }
}

type ParsedConfig = z.infer<typeof docRunnerConfigSchema>;

/**
 * Loads, validates, and normalizes a DocRunner config file.
 * @param options Working directory and optional config path.
 * @returns Validated configuration with defaults applied.
 */
export async function loadConfig(
  options: LoadConfigOptions,
): Promise<DocRunnerConfig> {
  const configPath = options.configPath ?? "docrunner.yml";
  const fullPath = resolve(options.cwd, configPath);
  let raw: string;

  try {
    raw = await readFile(fullPath, "utf8");
  } catch (error) {
    if (
      isNodeError(error) &&
      error.code === "ENOENT" &&
      options.configPath === undefined
    ) {
      return normalizeConfig(docRunnerConfigSchema.parse({}));
    }

    throw new ConfigLoadError(
      `Unable to read ${configPath}: ${errorMessage(error)}`,
      configPath,
    );
  }

  try {
    const input = parseYaml(raw) as unknown;
    return normalizeConfig(docRunnerConfigSchema.parse(input ?? {}));
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ConfigLoadError(formatZodError(error, configPath), configPath);
    }

    throw new ConfigLoadError(
      `Unable to parse ${configPath} as YAML: ${errorMessage(error)}`,
      configPath,
    );
  }
}

/**
 * Normalizes inferred schema output into the public config contract.
 * @param config Parsed Zod configuration.
 * @returns Stable public configuration.
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
 * Formats validation issues into field-specific remediation messages.
 * @param error Zod validation error.
 * @param configPath Config path shown to the user.
 * @returns Multiline actionable validation message.
 */
function formatZodError(error: ZodError, configPath: string): string {
  const issues = error.issues.map((issue) => {
    const field = issue.path.length === 0 ? "config" : issue.path.join(".");
    return `  - ${field}: ${issue.message}`;
  });
  return `Invalid ${configPath}:\n${issues.join("\n")}`;
}

/**
 * Converts an unknown thrown value into a readable message.
 * @param error Unknown thrown value.
 * @returns Human-readable error text.
 */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * Checks whether an unknown error contains a Node.js error code.
 * @param error Unknown thrown value.
 * @returns True when the value is a Node.js system error.
 */
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
