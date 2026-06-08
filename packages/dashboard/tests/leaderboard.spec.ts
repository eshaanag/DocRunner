import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test("registers aggregate results and renders leaderboard, repo, and badge", async ({
  page,
  request,
}) => {
  const owner = "verified-org";
  const repo = `verified-repo-${Date.now()}`;
  const payload = {
    owner,
    repo,
    stars: 2400,
    passCount: 12,
    failCount: 0,
    skipCount: 3,
    lastRunAt: new Date().toISOString(),
  };

  const unauthorized = await request.post("/api/leaderboard", {
    data: payload,
  });
  expect(unauthorized.status()).toBe(401);

  const registered = await request.post("/api/leaderboard", {
    data: payload,
    headers: { authorization: "Bearer playwright-secret" },
  });
  expect(registered.status()).toBe(201);

  const badge = await request.get(`/api/badge/${owner}/${repo}`);
  expect(await badge.json()).toMatchObject({
    schemaVersion: 1,
    label: "docs tested",
    message: "12/12 passing",
    color: "brightgreen",
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "These projects test their documentation.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: `${owner}/${repo}` }),
  ).toBeVisible();
  await expect(page.getByText("DocRunner never stores code")).toBeVisible();

  await page.getByRole("link", { name: `${owner}/${repo}` }).click();
  await expect(
    page.getByRole("heading", { name: `${owner}/${repo}` }),
  ).toBeVisible();
  await expect(page.getByText("12", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Run history")).toBeVisible();
});

test("returns a neutral badge for unknown repositories", async ({
  request,
}) => {
  const badge = await request.get("/api/badge/unknown/not-registered");
  expect(await badge.json()).toMatchObject({
    message: "not registered",
    color: "lightgrey",
  });
});
