import { defineConfig, devices } from '@playwright/test';

const PORT = 3311;

/**
 * End-to-end smoke tests.
 *
 * Chromium only and a short list of journeys on purpose: these exist to catch
 * a page that will not render or a flow that silently breaks, not to re-test
 * the physics, which 400+ unit tests already cover far faster.
 *
 * Everything runs against a production build in demo mode, which is exactly how
 * a beta tester will meet it: no backend, no account, localStorage only.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? 'list' : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // The primary target is a phone at the range.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm build && pnpm start --port ${String(PORT)}`,
    url: `http://127.0.0.1:${String(PORT)}`,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 180_000,
  },
});
