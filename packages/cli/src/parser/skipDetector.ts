const PLACEHOLDER_PATTERNS = [
  "YOUR_API_KEY",
  "YOUR_TOKEN",
  "{YOUR_",
  "<your-",
  "<YOUR-",
  "<placeholder>",
] as const;

const ALLOWED_SHEBANGS = new Set(["#!/bin/bash", "#!/usr/bin/env python"]);

/**
 * Detects whether block code should be skipped before execution.
 * @param code Raw fenced code content.
 * @param configuredPatterns User-configured literal skip patterns.
 * @returns Actionable skip reason or null when the block should execute.
 */
export function detectSkipReason(
  code: string,
  configuredPatterns: readonly string[] = [],
): string | null {
  for (const pattern of configuredPatterns) {
    if (pattern.length > 0 && code.includes(pattern)) {
      return `configured skip pattern \`${pattern}\``;
    }
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (code.includes(pattern)) {
      return `placeholder pattern \`${pattern}\``;
    }
  }

  const lines = code.split(/\r?\n/u);
  const trimmedLines = lines.map((line) => line.trim());

  if (trimmedLines.includes("...")) {
    return "placeholder ellipsis on its own line";
  }

  if (trimmedLines.includes("# TODO") || trimmedLines.includes("# FIXME")) {
    return "incomplete TODO or FIXME marker";
  }

  const nonEmptyLines = trimmedLines.filter((line) => line.length > 0);
  if (
    nonEmptyLines.length > 0 &&
    nonEmptyLines.every((line) => line.startsWith("$ "))
  ) {
    return "shell transcript with `$ ` prompts";
  }

  const trimmedCode = code.trim();
  if (trimmedCode.startsWith(">")) {
    return "output transcript starting with `>`";
  }

  if (
    nonEmptyLines.length === 1 &&
    /^https?:\/\/\S+$/u.test(nonEmptyLines[0] ?? "")
  ) {
    return "single URL reference";
  }

  const firstLine = trimmedLines[0] ?? "";
  if (firstLine.startsWith("#!") && !ALLOWED_SHEBANGS.has(firstLine)) {
    return `unsupported shebang \`${firstLine}\``;
  }

  return null;
}
