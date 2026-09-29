import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Chromium only; deliberately small. Runs
// against the real production build + api worker (scripts/e2e-stack.mjs),
// or a developer's already-running `pnpm dev` stack when one is up
// (reuseExistingServer below).
const isCI = !!process.env.CI;
// The signed-in specs (e2e/clerk-stub/, docs/specs/014-identity/blueprints/profile-picture.md) need
// the Clerk-enabled export (`pnpm build:clerk-stub`). They run as their own invocation
// (`pnpm test:e2e:clerk-stub`) on their own ports, so a guest stack already up on :3002 is never
// mistaken for it.
const clerkStub = process.env.E2E_CLERK_STUB === '1';
const STUB_PORTS = { live: '3015', api: '8788', marketing: '3016' };
const BASE_URL =
  process.env.E2E_BASE_URL ??
  (clerkStub ? `http://localhost:${STUB_PORTS.live}` : 'http://localhost:3002');

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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /clerk-stub\// },
    ...(clerkStub
      ? [
          {
            name: 'clerk-stub',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /clerk-stub\/.*\.spec\.ts/,
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
    env: clerkStub
      ? {
          E2E_LIVE_OUT: '.next/out-clerk-stub',
          E2E_LIVE_PORT: STUB_PORTS.live,
          E2E_API_PORT: STUB_PORTS.api,
          E2E_MARKETING_PORT: STUB_PORTS.marketing,
        }
      : {},
  },
});
