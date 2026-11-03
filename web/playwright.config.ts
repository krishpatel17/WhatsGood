import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:4173",
    ...devices["Desktop Edge"],
    channel: process.env.CI ? "chromium" : "msedge",
  },
  webServer: {
    command:
      "NEXT_PUBLIC_API_URL=http://api.test npm run build && node e2e/serve.mjs",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
