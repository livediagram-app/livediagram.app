import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite (spec/72). Chromium only; deliberately small. Runs
// against the real production build + api worker (scripts/e2e-stack.mjs),
// or a developer's already-running `pnpm dev` stack when one is up
// (reuseExistingServer below).
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3002';
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  // The whole point is the smoke alarm, not a slow exhaustive suite:
  // fail fast rather than burn CI minutes on a hung run.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Parallel locally for authoring speed; serialized in CI so one
  // worker's api-worker + D1 state can't race another's.
  fullyParallel: !isCI,
  workers: isCI ? 1 : undefined,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ../../scripts/e2e-stack.mjs',
    url: BASE_URL,
    // Locally: reuse a running `pnpm dev`. In CI: always boot the stack
    // script fresh (there is no dev to reuse).
    reuseExistingServer: !isCI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
