import type { SupportedLanguage } from "../types/index.js";

const LANGUAGE_ALIASES: Readonly<Record<string, SupportedLanguage>> = {
  python: "python",
  python3: "python",
  py: "python",
  javascript: "javascript",
  js: "javascript",
  node: "javascript",
  typescript: "typescript",
  ts: "typescript",
  bash: "bash",
  sh: "bash",
  shell: "bash",
};

/**
 * Normalizes a markdown code-fence language into a supported runtime.
 * @param language Raw language tag from a markdown code fence.
 * @returns Supported language or null when the tag is absent or unsupported.
 */
export function normalizeLanguage(
  language: string | null | undefined,
): SupportedLanguage | null {
  if (language === null || language === undefined) {
    return null;
  }

  return LANGUAGE_ALIASES[language.trim().toLowerCase()] ?? null;
}
