import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'
import { config } from 'dotenv'

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) })

/**
 * End-to-end suite.
 *
 * Runs against the apps already started by `pnpm dev`, rather than booting its own,
 * because the flows cross four services and starting them per-run would make the suite
 * slow enough that nobody would run it.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      // The scanner and the customer card are phone surfaces; test them as such.
      name: 'mobile',
      use: { ...devices['iPhone 14'] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
})
