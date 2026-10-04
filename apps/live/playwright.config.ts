import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Chromium only; deliberately small. Runs
// against the real production build + api worker (scripts/e2e-stack.mjs),
// or a developer's already-running `pnpm dev` stack when one is up
// (reuseExistingServer below).
const isCI = !!process.env.CI;
const CI_WORKERS = 4;
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
  // Each invocation keeps its own artefacts: a run clears its output folder when it starts.
  outputDir: clerkStub ? 'test-results-clerk-stub' : 'test-results',
  // The whole point is the smoke alarm, not a slow exhaustive suite:
  // fail fast rather than burn CI minutes on a hung run.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Every test opens a fresh browser context, so a fresh guest owner with its own documents; tests
  // share the stack but never its data, and run in parallel everywhere. CI pins one worker per
  // vCPU of the GitHub runner.
  fullyParallel: true,
  workers: isCI ? CI_WORKERS : undefined,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Each invocation keeps its own report, so the signed-in run never overwrites the smoke suite's.
  reporter: isCI
    ? [
        ['github'],
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder: clerkStub ? 'playwright-report-clerk-stub' : 'playwright-report',
          },
        ],
      ]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: isCI ? 'retain-on-first-failure' : 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // The Drive, signed-in and sites suites need their own builds and stacks; see below.
      testIgnore: [
        /drive-(mirror|shots)\.spec\.ts/,
        /clerk-stub\//,
        /perf\//,
        /optical-audit-sites\.spec\.ts/,
      ],
    },
    // The optical audit of the help centre, telemetry dashboard and marketing site: the one suite
    // that needs their builds, so CI gives it its own job and the shards build only live
    // (docs/specs/003-system-architecture/e2e-smoke.md "When it runs").
    {
      name: 'sites',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /optical-audit-sites\.spec\.ts/,
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
    ...(clerkStub
      ? [
          {
            name: 'clerk-stub',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /clerk-stub\/.*\.spec\.ts/,
          },
        ]
      : []),
    // Opt-in (E2E_PERF=1, pnpm perf:canvas): the canvas performance probe
    // (docs/specs/008-canvas/canvas-performance.md "Measuring"). Reports against the budget and never
    // fails on a miss; it runs nightly (canvas-perf.yml), not on every push.
    ...(process.env.E2E_PERF === '1'
      ? [
          {
            name: 'perf',
            use: { ...devices['Desktop Chrome'], colorScheme: 'dark' as const },
            testMatch: /perf\/.*\.perf\.ts/,
            // One long measurement: a retry would only run it all again (and double the time).
            retries: 0,
          },
        ]
      : []),
    // Opt-in (E2E_WEBKIT=1, after `playwright install webkit`): the image import
    // pipeline's Safari path (docs/specs/020-import-export/import-image-pipeline.md) and the quick
    // style panel's swatch rows, which fit or wrap by the engine's layout
    // (docs/specs/008-canvas/quick-style-panel.md). Kept out of CI's default run to spare its
    // minutes; the same specs run in Chromium.
    ...(process.env.E2E_WEBKIT === '1'
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            testMatch: /(import-images|quick-style-swatch-rows)\.spec\.ts/,
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
          // The stack stands in for Clerk: it mints the stub's session tokens and the api verifies them.
          E2E_CLERK_JWKS: '1',
        }
      : {},
  },
});
