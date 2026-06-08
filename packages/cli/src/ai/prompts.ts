import type { ParsedBlock } from "../types/index.js";

const MAX_ERROR_LENGTH = 4_000;
const MAX_CONTEXT_LENGTH = 6_000;

/**
 * Builds the bounded prompt sent to Claude for one failing README block.
 * @param block Failing parsed block.
 * @param error Captured runtime error.
 * @param surroundingText README text surrounding the block.
 * @returns Prompt requesting a minimal structured fix.
 */
export function buildFixPrompt(
  block: ParsedBlock,
  error: string,
  surroundingText: string,
): string {
  return `You are a code documentation assistant helping fix a broken README code example.

A README code block has failed execution. Your job is to suggest a minimal,
correct fix that makes the example work while keeping it readable.

## Context
File: ${block.file}
Section: ${block.name ?? block.heading ?? "Unlabeled block"}
Language: ${block.language}
Line: ${block.startLine}

## The failing code
\`\`\`${block.language}
${block.code}
\`\`\`

## The error
\`\`\`
${truncate(error, MAX_ERROR_LENGTH)}
\`\`\`

## Surrounding README context (for understanding intent)
${truncate(surroundingText, MAX_CONTEXT_LENGTH)}

## Instructions
1. Diagnose the root cause in one sentence.
2. Provide the corrected code block (minimal change, preserve the example's intent).
3. Add a one-line comment on the line you changed explaining why.
4. Do NOT add unnecessary imports or boilerplate.
5. If the fix requires an environment variable or external service, note this briefly.
6. If the code appears to be pseudocode or illustrative (not meant to run),
   say so and suggest adding <!-- docrunner: skip --> instead.

Respond in this exact format:
DIAGNOSIS: <one sentence>
FIXED_CODE:
\`\`\`${block.language}
<corrected code here>
\`\`\`
NOTE: <optional one-line note about requirements, or empty>`;
}

/**
 * Truncates prompt content to a fixed maximum length.
 * @param value Raw prompt content.
 * @param maximumLength Maximum number of characters.
 * @returns Original or truncated content.
 */
function truncate(value: string, maximumLength: number): string {
  return value.length <= maximumLength
    ? value
    : `${value.slice(0, maximumLength)}\n[truncated by DocRunner]`;
}
