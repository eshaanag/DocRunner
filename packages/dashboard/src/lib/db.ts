import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import Database from "better-sqlite3";

export type BadgeColor = "brightgreen" | "green" | "yellow" | "orange";

export interface LeaderboardWrite {
  owner: string;
  repo: string;
  stars: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  lastRunAt: string;
}

export interface LeaderboardEntry extends LeaderboardWrite {
  passRate: number;
  badgeColor: BadgeColor;
}

export interface RepositoryDetail {
  entry: LeaderboardEntry;
  history: LeaderboardEntry[];
}

let database: Database.Database | undefined;

/**
 * Lists repositories by pass rate and then stars.
 * @returns Latest aggregate entry for each registered repository.
 */
export function listLeaderboard(): LeaderboardEntry[] {
  return getDatabase()
    .prepare(
      `SELECT
        repository.owner,
        repository.repo,
        repository.stars,
        run.pass_count AS passCount,
        run.fail_count AS failCount,
        run.skip_count AS skipCount,
        run.pass_rate AS passRate,
        run.badge_color AS badgeColor,
        run.run_at AS lastRunAt
      FROM repositories repository
      JOIN runs run ON run.id = (
        SELECT latest.id FROM runs latest
        WHERE latest.repository_id = repository.id
        ORDER BY latest.run_at DESC, latest.id DESC
        LIMIT 1
      )
      ORDER BY run.pass_rate DESC, repository.stars DESC, repository.owner, repository.repo`,
    )
    .all() as LeaderboardEntry[];
}

/**
 * Retrieves one repository and its aggregate run history.
 * @param owner Repository owner.
 * @param repo Repository name.
 * @returns Repository detail or null when not registered.
 */
export function getRepository(
  owner: string,
  repo: string,
): RepositoryDetail | null {
  const history = getDatabase()
    .prepare(
      `SELECT
        repository.owner,
        repository.repo,
        repository.stars,
        run.pass_count AS passCount,
        run.fail_count AS failCount,
        run.skip_count AS skipCount,
        run.pass_rate AS passRate,
        run.badge_color AS badgeColor,
        run.run_at AS lastRunAt
      FROM repositories repository
      JOIN runs run ON run.repository_id = repository.id
      WHERE repository.owner = ? AND repository.repo = ?
      ORDER BY run.run_at DESC, run.id DESC`,
    )
    .all(owner, repo) as LeaderboardEntry[];

  return history[0] === undefined ? null : { entry: history[0], history };
}

/**
 * Registers or updates a repository and appends one aggregate run.
 * @param input Validated aggregate-only leaderboard write.
 * @returns Stored latest entry.
 */
export function registerRepositoryRun(
  input: LeaderboardWrite,
): LeaderboardEntry {
  const executed = input.passCount + input.failCount;
  const passRate =
    executed === 0 ? 0 : Math.round((input.passCount / executed) * 100);
  const badgeColor = colorForPassRate(passRate);
  const db = getDatabase();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO repositories (owner, repo, stars, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner, repo) DO UPDATE SET
         stars = excluded.stars,
         updated_at = excluded.updated_at`,
    ).run(
      input.owner,
      input.repo,
      input.stars,
      input.lastRunAt,
      input.lastRunAt,
    );

    const repository = db
      .prepare("SELECT id FROM repositories WHERE owner = ? AND repo = ?")
      .get(input.owner, input.repo) as { id: number };

    db.prepare(
      `INSERT INTO runs (
        repository_id, pass_count, fail_count, skip_count, pass_rate, badge_color, run_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      repository.id,
      input.passCount,
      input.failCount,
      input.skipCount,
      passRate,
      badgeColor,
      input.lastRunAt,
    );
  })();

  return { ...input, passRate, badgeColor };
}

/**
 * Selects a shields.io badge color from pass rate.
 * @param passRate Integer pass percentage.
 * @returns Badge color.
 */
export function colorForPassRate(passRate: number): BadgeColor {
  if (passRate === 100) return "brightgreen";
  if (passRate >= 80) return "green";
  if (passRate >= 60) return "yellow";
  return "orange";
}

/**
 * Opens and initializes the SQLite database.
 * @returns Initialized database connection.
 */
function getDatabase(): Database.Database {
  if (database !== undefined) {
    return database;
  }

  const path =
    process.env.DATABASE_PATH ??
    join(process.cwd(), ".tmp", "leaderboard.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      repo TEXT NOT NULL,
      stars INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(owner, repo)
    );
    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repository_id INTEGER NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
      pass_count INTEGER NOT NULL,
      fail_count INTEGER NOT NULL,
      skip_count INTEGER NOT NULL,
      pass_rate REAL NOT NULL,
      badge_color TEXT NOT NULL,
      run_at TEXT NOT NULL
    );
  `);
  return database;
}
