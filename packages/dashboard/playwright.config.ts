import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:3199",
  },
  webServer: {
    command: "npm run dev -- --port 3199",
    port: 3199,
    reuseExistingServer: false,
    env: {
      DATABASE_PATH: ".tmp/playwright.sqlite",
      LEADERBOARD_SECRET: "playwright-secret",
    },
  },
});
