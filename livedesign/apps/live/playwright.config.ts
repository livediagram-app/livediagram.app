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
const STUB_PORTS = { live: '3315', api: '8999', marketing: '3316' };
// The armed specs (e2e/armed/, docs/specs/003-system-architecture/e2e-smoke.md "Armed guest
// signatures") need guest signature enforcement on, so they run as their own invocation
// (`pnpm test:e2e:armed`) on their own ports, against the guest-mode export.
const armed = process.env.E2E_GUEST_SIG_ENFORCE === '1';
const ARMED_PORTS = { live: '3017', api: '8789', marketing: '3018' };
// The workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md "Testing") needs the
// NEXT_PUBLIC_E2E_AUTH export and the stack acting as Clerk, so it runs as its own invocation
// (`pnpm test:e2e:workbench`) on its own ports.
const workbench = process.env.E2E_WORKBENCH === '1';
const WORKBENCH_PORTS = { live: '3021', api: '8791', marketing: '3022' };
const BASE_URL =
  process.env.E2E_BASE_URL ??
  (clerkStub
    ? `http://localhost:${STUB_PORTS.live}`
    : armed
      ? `http://localhost:${ARMED_PORTS.live}`
      : workbench
        ? `http://localhost:${WORKBENCH_PORTS.live}`
        : 'http://localhost:3402');
const runName = clerkStub ? '-clerk-stub' : armed ? '-armed' : workbench ? '-workbench' : '';

export default defineConfig({
  testDir: './e2e',
  // Playwright runs the `.spec.ts` files; the `.test.ts` beside them are Vitest unit tests of pure helpers
  // (vitest.config.ts excludes `e2e/**/*.spec.ts`, the other half of this split).
  testMatch: /\.spec\.ts$/,
  // Each invocation keeps its own artefacts: a run clears its output folder when it starts.
  outputDir: `test-results${runName}`,
  // The whole point is the smoke alarm, not a slow exhaustive suite:
  // fail fast rather than burn CI minutes on a hung run.
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Every test opens a fresh browser context, so a fresh guest owner with its own designs; tests
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
            outputFolder: `playwright-report${runName}`,
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
      // The signed-in, sites and workbench suites need their own builds and stacks; see below.
      testIgnore: [
        /clerk-stub\//,
        /armed\//,
        /perf\//,
        /optical-audit-sites\.spec\.ts/,
        /workbench-(embed|workspace)\.spec\.ts/,
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
    ...(workbench
      ? [
          {
            name: 'workbench',
            use: { ...devices['Desktop Chrome'], colorScheme: 'dark' as const },
            testMatch: /workbench-(embed|workspace)\.spec\.ts/,
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
    ...(armed
      ? [
          {
            name: 'armed',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /armed\/.*\.spec\.ts/,
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
    // Opt-in (E2E_WEBKIT=1, after `playwright install webkit`): the quick style panel's swatch
    // rows, which fit or wrap by the engine's layout
    // (docs/specs/008-canvas/quick-style-panel.md). Kept out of CI's default run to spare its
    // minutes; the same specs run in Chromium.
    ...(process.env.E2E_WEBKIT === '1'
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            testMatch: /quick-style-swatch-rows\.spec\.ts/,
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
      : armed
        ? {
            E2E_LIVE_PORT: ARMED_PORTS.live,
            E2E_API_PORT: ARMED_PORTS.api,
            E2E_MARKETING_PORT: ARMED_PORTS.marketing,
            E2E_GUEST_SIG_ENFORCE: '1',
          }
        : workbench
          ? {
              E2E_LIVE_PORT: WORKBENCH_PORTS.live,
              E2E_API_PORT: WORKBENCH_PORTS.api,
              E2E_MARKETING_PORT: WORKBENCH_PORTS.marketing,
            }
          : {},
  },
});
