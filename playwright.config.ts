import { defineConfig } from "@playwright/test";

const PORT = 3300;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chromium", use: { browserName: "chromium" } }],
  webServer: {
    // Runs against the production build. `npm run build` first.
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    // No key: the Chef must fall back to the local engine.
    env: { GEMINI_API_KEY: "", GEMINI_MODEL: "" },
  },
});
