import { defineConfig } from "@playwright/test";

const PORT = 8123;

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.mjs$/,
  globalSetup: "./tests/generate-fixtures.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: "node tests/server.mjs",
    url: `http://localhost:${PORT}/ok`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
  },
});
