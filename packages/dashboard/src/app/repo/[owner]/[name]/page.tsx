/**
 * Renders the repository detail placeholder until Phase 6.
 * @returns Empty placeholder content.
 */
import { notFound } from "next/navigation";
import { getRepository } from "../../../../lib/db";

export const dynamic = "force-dynamic";

interface RepoPageProps {
  params: Promise<{ owner: string; name: string }>;
}

/**
 * Renders one repository's latest status and run history.
 * @param props Dynamic repository route parameters.
 * @returns Repository detail page.
 */
export default async function RepoPage({
  params,
}: RepoPageProps): Promise<React.ReactNode> {
  const { owner, name } = await params;
  const detail = getRepository(owner, name);
  if (detail === null) {
    notFound();
  }

  const entry = detail.entry;
  const badge = `[![docs tested](https://docrunner.dev/api/badge/${owner}/${name})](https://docrunner.dev/repo/${owner}/${name})`;

  return (
    <main className="page">
      <section className="intro">
        <p className="eyebrow">Repository status</p>
        <h1>
          {owner}/{name}
        </h1>
        <p className="lede">
          Latest aggregate documentation test result. No snippets, errors,
          paths, or branch information are stored.
        </p>
      </section>

      <section className="stats" aria-label="Latest run summary">
        <div className="stat">
          <span>Pass rate</span>
          <strong>{entry.passRate}%</strong>
        </div>
        <div className="stat">
          <span>Passed</span>
          <strong>{entry.passCount}</strong>
        </div>
        <div className="stat">
          <span>Failed</span>
          <strong>{entry.failCount}</strong>
        </div>
        <div className="stat">
          <span>Skipped</span>
          <strong>{entry.skipCount}</strong>
        </div>
      </section>

      <h2>Badge</h2>
      <pre className="code">{badge}</pre>

      <h2>Run history</h2>
      <div className="table-wrap">
        <table className="leaderboard">
          <thead>
            <tr>
              <th>Checked</th>
              <th>Pass rate</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Skipped</th>
            </tr>
          </thead>
          <tbody>
            {detail.history.map((run, index) => (
              <tr key={`${run.lastRunAt}-${index}`}>
                <td>
                  {new Date(run.lastRunAt).toLocaleString("en", {
                    timeZone: "UTC",
                  })}
                </td>
                <td>{run.passRate}%</td>
                <td>{run.passCount}</td>
                <td>{run.failCount}</td>
                <td>{run.skipCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
