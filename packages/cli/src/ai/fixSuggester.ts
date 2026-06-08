import { createHash } from "node:crypto";
import { z } from "zod";
import { buildFixPrompt } from "./prompts.js";
import type {
  AISuggestion,
  ExecutionResult,
  ParsedBlock,
} from "../types/index.js";

export interface ClaudeClient {
  request(prompt: string, apiKey: string): Promise<string>;
}

export interface SuggestFixOptions {
  block: ParsedBlock;
  result: ExecutionResult;
  surroundingText: string;
  enabled: boolean;
  apiKey?: string | undefined;
  client?: ClaudeClient | undefined;
}

const suggestionSchema = z.object({
  diagnosis: z.string().min(1),
  fixedCode: z.string().min(1),
  note: z.string().nullable(),
});

const anthropicResponseSchema = z.object({
  content: z.array(
    z.object({
      type: z.literal("text"),
      text: z.string(),
    }),
  ),
});

const suggestionCache = new Map<string, AISuggestion>();

/**
 * Requests or retrieves a cached AI fix for one runtime failure.
 * @param options Failing block, result, context, configuration, and optional client.
 * @returns Parsed suggestion or null when unavailable or ineligible.
 */
export async function suggestFix(
  options: SuggestFixOptions,
): Promise<AISuggestion | null> {
  if (
    !options.enabled ||
    options.result.status !== "fail" ||
    options.apiKey === undefined ||
    options.apiKey.length === 0
  ) {
    return null;
  }

  const cacheKey = createCacheKey(options.block, options.result);
  const cached = suggestionCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const client = options.client ?? new AnthropicHttpClient();
    const prompt = buildFixPrompt(
      options.block,
      options.result.stderr,
      options.surroundingText,
    );
    const raw = await client.request(prompt, options.apiKey);
    const suggestion = parseSuggestion(raw);
    if (suggestion !== null) {
      suggestionCache.set(cacheKey, suggestion);
    }
    return suggestion;
  } catch {
    return null;
  }
}

/**
 * Clears the in-memory suggestion cache for tests and explicit lifecycle resets.
 * @returns Nothing.
 */
export function clearSuggestionCache(): void {
  suggestionCache.clear();
}

/**
 * Parses Claude's required structured text response.
 * @param raw Raw Claude text response.
 * @returns Validated suggestion or null for malformed output.
 */
export function parseSuggestion(raw: string): AISuggestion | null {
  const match =
    /^DIAGNOSIS:\s*(.+)\nFIXED_CODE:\s*\n```[^\n]*\n([\s\S]*?)\n```\nNOTE:\s*(.*)$/u.exec(
      raw.trim(),
    );
  if (match === null) {
    return null;
  }

  const parsed = suggestionSchema.safeParse({
    diagnosis: match[1]?.trim(),
    fixedCode: match[2]?.trim(),
    note: match[3]?.trim() || null,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Creates the cache key for a block and its current failure.
 * @param block Failing parsed block.
 * @param result Runtime failure result.
 * @returns Stable SHA-256 cache key.
 */
function createCacheKey(block: ParsedBlock, result: ExecutionResult): string {
  return createHash("sha256")
    .update(`${block.id}\0${block.code}\0${result.stderr}`)
    .digest("hex");
}

class AnthropicHttpClient implements ClaudeClient {
  /**
   * Calls Anthropic's Messages API with fixed cost controls.
   * @param prompt Structured DocRunner fix prompt.
   * @param apiKey Anthropic API key.
   * @returns Claude's text response.
   */
  async request(prompt: string, apiKey: string): Promise<string> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed with HTTP ${response.status}.`);
    }

    const parsed = anthropicResponseSchema.parse(await response.json());
    return parsed.content.map((content) => content.text).join("\n");
  }
}
