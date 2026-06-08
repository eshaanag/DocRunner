import { readFile } from "node:fs/promises";
import { z } from "zod";

export interface GitHubCommentContext {
  repository: string;
  issueNumber: number;
}

export interface PostGitHubCommentOptions {
  token: string;
  context: GitHubCommentContext;
  body: string;
  fetchImpl?: typeof fetch | undefined;
}

const eventSchema = z.object({
  pull_request: z.object({
    number: z.number().int().positive(),
  }),
  repository: z.object({
    full_name: z.string().min(1),
  }),
});

const commentSchema = z.object({
  id: z.number().int().positive(),
  body: z.string().nullable(),
});

const commentListSchema = z.array(commentSchema);

/**
 * Loads pull request comment context from a GitHub event payload.
 * @param eventPath Path to the GitHub event JSON file.
 * @returns Repository and pull request number.
 */
export async function loadGitHubCommentContext(
  eventPath: string,
): Promise<GitHubCommentContext> {
  const raw = await readFile(eventPath, "utf8");
  const event = eventSchema.parse(JSON.parse(raw));
  return {
    repository: event.repository.full_name,
    issueNumber: event.pull_request.number,
  };
}

/**
 * Creates or updates the single DocRunner pull request comment.
 * @param options Token, context, body, and optional fetch implementation.
 * @returns Created or updated comment identifier.
 */
export async function postOrUpdateGitHubComment(
  options: PostGitHubCommentOptions,
): Promise<number> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const comments = await listComments(fetchImpl, options);
  const existing = comments.find((comment) =>
    comment.body?.includes("<!-- docrunner-comment -->"),
  );

  if (existing !== undefined) {
    await requestGitHub(fetchImpl, {
      token: options.token,
      method: "PATCH",
      url: `https://api.github.com/repos/${options.context.repository}/issues/comments/${existing.id}`,
      body: { body: options.body },
    });
    return existing.id;
  }

  const created = await requestGitHub(fetchImpl, {
    token: options.token,
    method: "POST",
    url: `https://api.github.com/repos/${options.context.repository}/issues/${options.context.issueNumber}/comments`,
    body: { body: options.body },
  });
  const parsed = commentSchema.parse(created);
  return parsed.id;
}

/**
 * Lists issue comments for a pull request.
 * @param fetchImpl Fetch implementation.
 * @param options Token and PR context.
 * @returns Validated issue comments.
 */
async function listComments(
  fetchImpl: typeof fetch,
  options: PostGitHubCommentOptions,
): Promise<z.infer<typeof commentListSchema>> {
  const payload = await requestGitHub(fetchImpl, {
    token: options.token,
    method: "GET",
    url: `https://api.github.com/repos/${options.context.repository}/issues/${options.context.issueNumber}/comments`,
  });
  return commentListSchema.parse(payload);
}

interface GitHubRequest {
  token: string;
  method: "GET" | "PATCH" | "POST";
  url: string;
  body?: { body: string } | undefined;
}

/**
 * Sends a validated GitHub API request.
 * @param fetchImpl Fetch implementation.
 * @param request GitHub API request fields.
 * @returns Parsed JSON response.
 */
async function requestGitHub(
  fetchImpl: typeof fetch,
  request: GitHubRequest,
): Promise<unknown> {
  const init: RequestInit = {
    method: request.method,
    headers: {
      authorization: `Bearer ${request.token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
  };
  if (request.body !== undefined) {
    init.body = JSON.stringify(request.body);
  }
  const response = await fetchImpl(request.url, init);

  if (!response.ok) {
    const reset = response.headers.get("x-ratelimit-reset");
    const rateLimit =
      response.status === 403 && reset !== null
        ? ` Rate limit resets at ${reset}.`
        : "";
    throw new Error(
      `GitHub API ${request.method} ${request.url} failed with HTTP ${response.status}.${rateLimit}`,
    );
  }

  return response.json();
}
