export type SupportedLanguage = "python" | "javascript" | "typescript" | "bash";

export type ExecutionStatus = "pass" | "fail" | "error" | "skipped" | "timeout";

export type FailureMode = "error" | "warn";

export interface ParsedBlock {
  id: string;
  file: string;
  language: SupportedLanguage;
  code: string;
  startLine: number;
  heading: string | null;
  name: string | null;
  isSetup: boolean;
  skipReason: string | null;
}

export interface ExecutionResult {
  blockId: string;
  status: ExecutionStatus;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  skipReason: string | null;
  errorMessage: string | null;
}

export interface AISuggestion {
  diagnosis: string;
  fixedCode: string;
  note: string | null;
}

export interface LeaderboardConfig {
  enabled: boolean;
  endpoint: string;
}

export interface DocRunnerConfig {
  version: 1;
  files: string[];
  languages: SupportedLanguage[] | undefined;
  timeout: number;
  setup: Partial<Record<SupportedLanguage, string>>;
  env: Record<string, string>;
  skip_patterns: string[];
  on_failure: FailureMode;
  ai_suggestions: boolean;
  leaderboard: LeaderboardConfig | undefined;
}

export interface LeaderboardEntry {
  owner: string;
  repo: string;
  stars: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  lastRunAt: string;
  badgeColor: "brightgreen" | "green" | "yellow" | "orange";
}

export interface PRComment {
  summary: string;
  markdown: string;
  hasFailures: boolean;
  aiSuggestionsIncluded: boolean;
}
