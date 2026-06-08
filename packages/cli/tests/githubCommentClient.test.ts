import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  loadGitHubCommentContext,
  postOrUpdateGitHubComment,
} from "../src/github/commentClient.js";

interface RecordedRequest {
  url: string;
  method: string;
  body: string | null;
}

/**
 * Creates a sequential fetch mock and records requests.
 * @param payloads JSON payloads returned in order.
 * @param requests Mutable request recording array.
 * @returns Fetch-compatible mock.
 */
function createFetchMock(
  payloads: readonly unknown[],
  requests: RecordedRequest[],
): typeof fetch {
  let index = 0;
  return (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : null,
    });
    const payload = payloads[index];
    index += 1;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

describe("GitHub comment client", () => {
  test("creates a comment when no DocRunner marker exists", async () => {
    const requests: RecordedRequest[] = [];
    const id = await postOrUpdateGitHubComment({
      token: "token",
      context: { repository: "eshaanag/DocRunner", issueNumber: 7 },
      body: "<!-- docrunner-comment -->\nreport",
      fetchImpl: createFetchMock([[], { id: 42, body: "report" }], requests),
    });

    expect(id).toBe(42);
    expect(requests.map((request) => request.method)).toEqual(["GET", "POST"]);
    expect(requests[1]?.url).toContain("/issues/7/comments");
  });

  test("updates an existing marker comment", async () => {
    const requests: RecordedRequest[] = [];
    const id = await postOrUpdateGitHubComment({
      token: "token",
      context: { repository: "eshaanag/DocRunner", issueNumber: 7 },
      body: "<!-- docrunner-comment -->\nupdated",
      fetchImpl: createFetchMock(
        [
          [{ id: 9, body: "<!-- docrunner-comment -->\nold" }],
          { id: 9, body: "updated" },
        ],
        requests,
      ),
    });

    expect(id).toBe(9);
    expect(requests.map((request) => request.method)).toEqual(["GET", "PATCH"]);
    expect(requests[1]?.url).toContain("/issues/comments/9");
  });

  test("validates GitHub pull request event context", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "docrunner-github-"));
    const eventPath = join(cwd, "event.json");
    await writeFile(
      eventPath,
      JSON.stringify({
        pull_request: { number: 12 },
        repository: { full_name: "eshaanag/DocRunner" },
      }),
      "utf8",
    );

    await expect(loadGitHubCommentContext(eventPath)).resolves.toEqual({
      repository: "eshaanag/DocRunner",
      issueNumber: 12,
    });
  });

  test("rejects malformed event payloads", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "docrunner-github-"));
    const eventPath = join(cwd, "event.json");
    await writeFile(eventPath, JSON.stringify({ push: true }), "utf8");

    await expect(loadGitHubCommentContext(eventPath)).rejects.toThrow();
  });
});
