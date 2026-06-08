import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const repos = [
  "tiangolo/fastapi",
  "psf/requests",
  "encode/httpx",
  "Textualize/rich",
  "pallets/click",
  "fastapi/typer",
  "pydantic/pydantic",
  "sqlalchemy/sqlalchemy",
  "pallets/flask",
  "django/django",
  "expressjs/express",
  "axios/axios",
  "lodash/lodash",
  "moment/moment",
  "chalk/chalk",
  "tj/commander.js",
  "yargs/yargs",
  "sindresorhus/got",
  "sindresorhus/ky",
  "colinhacks/zod",
] as const;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cacheDir = join(root, "scripts", "cache", "popular-repos");
const cliPath = join(root, "packages", "cli", "dist", "index.js");
const reportPath = join(root, "docs", "ANALYSIS.md");
const githubRepoSchema = z.object({ stargazers_count: z.number().int() });
const reportSchema = z.object({
  summary: z.object({
    passed: z.number().int(),
    failed: z.number().int(),
    skipped: z.number().int(),
    error: z.number().int(),
    timeout: z.number().int(),
  }),
});

interface AnalysisRow {
  repo: string;
  stars: number;
  blocks: number;
  passed: number;
  failed: number;
  skipped: number;
  status: string;
}

/**
 * Runs the public repository analysis and writes docs/ANALYSIS.md.
 * @returns Promise that settles after the markdown report is written.
 */
async function main(): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  const rows: AnalysisRow[] = [];
  for (const repo of repos) {
    process.stdout.write(`Analyzing ${repo}\n`);
    rows.push(await analyzeRepo(repo));
  }
  rows.sort((left, right) => failureRate(right) - failureRate(left));
  await writeFile(reportPath, formatReport(rows), "utf8");
  process.stdout.write(`Wrote ${reportPath}\n`);
}

/**
 * Clones and runs DocRunner against one public repository README.
 * @param repo GitHub owner/repo identifier.
 * @returns Aggregate analysis row.
 */
async function analyzeRepo(repo: string): Promise<AnalysisRow> {
  const repoDir = join(cacheDir, repo.replace("/", "__"));
  const base: AnalysisRow = {
    repo,
    stars: await fetchStars(repo),
    blocks: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    status: "ok",
  };

  const clone = await runProcess("git", [
    "clone",
    "--depth",
    "1",
    `https://github.com/${repo}.git`,
    repoDir,
  ]);
  if (clone.code !== 0 && !clone.stderr.includes("already exists")) {
    return { ...base, status: `clone failed: ${trim(clone.stderr)}` };
  }

  const readme = await findReadme(repoDir);
  if (readme === null) {
    return { ...base, status: "README.md not found" };
  }

  await writeFile(
    join(repoDir, "docrunner.yml"),
    analysisConfig(readme),
    "utf8",
  );
  const run = await runProcess("node", [cliPath, "run", readme, "--json"], {
    cwd: repoDir,
    timeoutMs: 120_000,
  });
  if (run.code !== 0) {
    return { ...base, status: `docrunner failed: ${trim(run.stderr)}` };
  }

  const parsed = reportSchema.safeParse(parseJson(run.stdout));
  if (!parsed.success) {
    return { ...base, status: "invalid JSON report" };
  }
  const summary = parsed.data.summary;
  return {
    ...base,
    blocks:
      summary.passed +
      summary.failed +
      summary.skipped +
      summary.error +
      summary.timeout,
    passed: summary.passed,
    failed: summary.failed + summary.error + summary.timeout,
    skipped: summary.skipped,
  };
}

/**
 * Fetches public GitHub star count for sorting context.
 * @param repo GitHub owner/repo identifier.
 * @returns Star count, or zero when unauthenticated lookup fails.
 */
async function fetchStars(repo: string): Promise<number> {
  const token = process.env.GITHUB_TOKEN;
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers:
        token === undefined || token.length === 0
          ? { "User-Agent": "DocRunner analysis" }
          : {
              "User-Agent": "DocRunner analysis",
              Authorization: `Bearer ${token}`,
            },
    });
    if (!response.ok) {
      return 0;
    }
    const parsed = githubRepoSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.stargazers_count : 0;
  } catch {
    return 0;
  }
}

/**
 * Finds a README markdown file in the repository root.
 * @param repoDir Cloned repository directory.
 * @returns README filename relative to repoDir, or null.
 */
async function findReadme(repoDir: string): Promise<string | null> {
  const files = await readdir(repoDir);
  return files.find((file) => file.toLowerCase() === "readme.md") ?? null;
}

/**
 * Builds conservative analysis config for public README runs.
 * @param readme README filename to analyze.
 * @returns YAML config string.
 */
function analysisConfig(readme: string): string {
  return `version: 1
files:
  - ${JSON.stringify(readme)}
timeout: 5
skip_patterns:
  - "npm install"
  - "pip install"
  - "yarn add"
  - "pnpm add"
  - "cargo add"
  - "go get"
on_failure: warn
ai_suggestions: false
`;
}

/**
 * Executes a command and captures bounded output.
 * @param command Executable name.
 * @param args Command arguments.
 * @param options Optional working directory and timeout.
 * @returns Exit code and captured output.
 */
function runProcess(
  command: string,
  args: readonly string[],
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolveResult) => {
    const child = spawn(command, args, { cwd: options.cwd ?? root });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(
      () => child.kill("SIGKILL"),
      options.timeoutMs ?? 60_000,
    );
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolveResult({ code: code ?? 1, stdout, stderr });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolveResult({ code: 1, stdout, stderr: error.message });
    });
  });
}

/**
 * Formats aggregate rows as launch-ready markdown.
 * @param rows Analysis rows.
 * @returns Markdown report.
 */
function formatReport(rows: readonly AnalysisRow[]): string {
  const analyzed = rows.filter((row) => row.blocks > 0);
  const failingRepos = analyzed.filter((row) => row.failed > 0).length;
  const totalBlocks = rows.reduce((total, row) => total + row.blocks, 0);
  const totalFailures = rows.reduce((total, row) => total + row.failed, 0);
  const lines = [
    "# README Snippet Analysis",
    "",
    "Generated by `npm run analyze:repos`. Results are aggregate-only; DocRunner does not store code, output, branch names, file names beyond README detection, or private repository data.",
    "",
    "Methodology: this is a raw zero-config run against each repository's root README. Failures include runtime errors, timeouts, and missing dependency setup. Treat the table as a launch investigation dataset, not a final claim that every failed block is a documentation bug.",
    "",
    `Summary: ${failingRepos}/${analyzed.length} repositories with executable README blocks had at least one failing block. ${totalFailures}/${totalBlocks} reportable blocks failed in this raw run.`,
    "",
    "| Repo | Stars | Blocks | Passed | Failed | Skipped | Failure Rate | Status |",
    "| ---- | -----: | -----: | -----: | -----: | ------: | -----------: | ------ |",
    ...rows.map(
      (row) =>
        `| ${row.repo} | ${row.stars} | ${row.blocks} | ${row.passed} | ${row.failed} | ${row.skipped} | ${(failureRate(row) * 100).toFixed(1)}% | ${row.status} |`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

/**
 * Calculates failed blocks divided by discovered reportable blocks.
 * @param row Aggregate analysis row.
 * @returns Failure rate from zero to one.
 */
function failureRate(row: AnalysisRow): number {
  return row.blocks === 0 ? 0 : row.failed / row.blocks;
}

/**
 * Keeps table status cells compact.
 * @param value Raw status text.
 * @returns Single-line truncated status.
 */
function trim(value: string): string {
  return value.replace(/\s+/gu, " ").trim().slice(0, 120) || "unknown";
}

/**
 * Parses unknown JSON without throwing into the repository loop.
 * @param value Raw JSON string.
 * @returns Parsed JSON value or null when malformed.
 */
function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

await main();
