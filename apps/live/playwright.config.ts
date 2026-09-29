import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Chromium only; deliberately small. Runs
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
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // Needs its own build and stack (E2E_DRIVE=1); see the drive project.
      testIgnore: /drive-(mirror|shots)\.spec\.ts/,
    },
    // Opt-in (pnpm --filter @livediagram/live test:e2e:drive): the Google Drive
    // mirror against the fake Google, signed in through the test-only auth
    // bridge (docs/specs/022-drive-mirror/blueprints/drive-mirror.md, "Testing").
    // Kept out of CI's default run: it needs a build with NEXT_PUBLIC_E2E_AUTH.
    ...(process.env.E2E_DRIVE === '1'
      ? [
          {
            name: 'drive',
            use: { ...devices['Desktop Chrome'], colorScheme: 'dark' as const },
            testMatch: /drive-mirror\.spec\.ts/,
          },
          // Every Drive state as a screenshot, light and dark (drive-shots.spec.ts).
          {
            name: 'drive-shots',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /drive-shots\.spec\.ts/,
          },
        ]
      : []),
    // Opt-in (E2E_WEBKIT=1, after `playwright install webkit`): the image import
    // pipeline's Safari path (docs/specs/020-import-export/import-image-pipeline.md). Kept
    // out of CI's default run to spare its minutes; the same specs run in Chromium.
    ...(process.env.E2E_WEBKIT === '1'
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            testMatch: /import-images\.spec\.ts/,
          },
        ]
      : []),
  ],
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
