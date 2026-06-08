/**
 * Renders the leaderboard placeholder until Phase 6.
 * @returns Empty placeholder content.
 */
import Link from "next/link";
import { listLeaderboard } from "../lib/db";

export const dynamic = "force-dynamic";

/**
 * Renders the public verified-docs leaderboard.
 * @returns Leaderboard page.
 */
export default function Page(): React.ReactNode {
  const entries = listLeaderboard();

  return (
    <main className="page">
      <section className="intro">
        <p className="eyebrow">Verified documentation</p>
        <h1>These projects test their documentation.</h1>
        <p className="lede">
          DocRunner executes README examples in CI. This leaderboard stores
          aggregate pass counts only, giving developers a current signal without
          publishing code, output, errors, file names, or branch data.
        </p>
      </section>

      {entries.length === 0 ? (
        <p className="empty">
          No repositories registered yet. The leaderboard is opt-in.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="leaderboard">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Pass rate</th>
                <th>Passed</th>
                <th>Failed</th>
                <th>Skipped</th>
                <th>Stars</th>
                <th>Last checked</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={`${entry.owner}/${entry.repo}`}>
                  <td>
                    <Link
                      className="repo-link"
                      href={`/repo/${entry.owner}/${entry.repo}`}
                    >
                      {entry.owner}/{entry.repo}
                    </Link>
                  </td>
                  <td>
                    <span className={`status ${entry.badgeColor}`}>
                      {entry.passRate}%
                    </span>
                  </td>
                  <td>{entry.passCount}</td>
                  <td>{entry.failCount}</td>
                  <td>{entry.skipCount}</td>
                  <td>{entry.stars.toLocaleString()}</td>
                  <td>{formatDate(entry.lastRunAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="privacy">
        Registration is opt-in. DocRunner never stores code, output, error
        messages, file names, branches, or private repository data.
      </p>
    </main>
  );
}

/**
 * Formats an ISO timestamp for the leaderboard.
 * @param value ISO timestamp.
 * @returns Human-readable UTC date.
 */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
}
