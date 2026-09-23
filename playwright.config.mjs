import { defineConfig } from "@playwright/test";

const PORTA = 8123;

export default defineConfig({
  testDir: "tests",
  testMatch: /.*\.spec\.mjs$/,
  globalSetup: "./tests/gerar-fixtures.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORTA}` },
  webServer: {
    command: "node tests/servidor.mjs",
    url: `http://localhost:${PORTA}/ok`,
    env: { PORTA: String(PORTA) },
    reuseExistingServer: false,
  },
});
