import { z } from "zod";

export const supportedLanguageSchema = z.enum([
  "python",
  "javascript",
  "typescript",
  "bash",
]);

export const docRunnerConfigSchema = z
  .object({
    version: z.literal(1).default(1),
    files: z.array(z.string().trim().min(1)).min(1).default(["README.md"]),
    languages: z.array(supportedLanguageSchema).min(1).optional(),
    timeout: z.number().int().min(1).max(300).default(10),
    setup: z.record(supportedLanguageSchema, z.string()).default({}),
    env: z.record(z.string(), z.string()).default({}),
    skip_patterns: z.array(z.string().min(1)).default([]),
    on_failure: z.enum(["error", "warn"]).default("error"),
    ai_suggestions: z.boolean().default(false),
    leaderboard: z
      .object({
        enabled: z.boolean().default(false),
        endpoint: z
          .string()
          .url()
          .default("https://docrunner.dev/api/leaderboard"),
      })
      .strict()
      .optional(),
  })
  .strict();

export type DocRunnerConfigInput = z.input<typeof docRunnerConfigSchema>;
