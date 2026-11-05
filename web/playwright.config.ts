import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
  use: {
    baseURL: "http://localhost:4173",
    ...devices["Desktop Edge"],
    channel: process.env.CI ? "chromium" : "msedge",
  },
  webServer: {
    command: "npm run build && node e2e/serve.mjs",
    env: { NEXT_PUBLIC_API_URL: "http://api.test" },
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
