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
  // The local app intentionally uses shared file-backed repositories. Running
  // journey files concurrently lets otherwise isolated browsers overwrite the
  // same learner state and turns valid product behavior into cascading timeouts.
  workers: 1,
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
    // Exercise the optimized artifact judges receive. Dev-mode compilation and
    // Fast Refresh can stall interactions long enough to create false failures.
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
  },
})
