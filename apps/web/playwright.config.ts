import { fileURLToPath } from "node:url"

import { defineConfig, devices } from "@playwright/test"

for (const envFile of [".env.local", ".env.e2e.local"]) {
  try {
    process.loadEnvFile(fileURLToPath(new URL(envFile, import.meta.url)))
  } catch {
    // CI can provide the same values directly without local env files.
  }
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
})
