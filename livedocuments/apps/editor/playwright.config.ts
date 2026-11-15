import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Chromium only; deliberately small. Runs
// against the real production build + api worker (scripts/e2e-stack.mjs),
// or a developer's already-running `pnpm dev` stack when one is up
// (reuseExistingServer below).
const isCI = !!process.env.CI;
const CI_WORKERS = 4;
// The signed-in specs (e2e/signed-in/, docs/specs/003-system-architecture/e2e-smoke.md) need
// the signed-in export (`pnpm build:signed-in`). They run as their own invocation
// (`pnpm test:e2e:signed-in`) on their own ports, so a guest stack already up on :3302 is never
// mistaken for it.
const signedIn = process.env.E2E_SIGNED_IN === '1';
const SIGNED_IN_PORTS = { live: '3315', api: '8315', marketing: '3316', index: '8317' };
// The workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md "Testing") needs the
// NEXT_PUBLIC_E2E_AUTH export and the stack acting as the accounts Worker, so it runs as its own invocation
// (`pnpm test:e2e:workbench`) on its own ports. Pairing, tickets and sessions are liveworkspace's now
// (liveworkspace/docs/specs/011-workbench/workbench.md), so the suite also needs liveworkspace's accounts Worker and site, which the
// stack does not start yet: until it does, the suite stops at its first mint.
const workbench = process.env.E2E_WORKBENCH === '1';
const WORKBENCH_PORTS = { live: '3321', api: '8321', marketing: '3322', index: '8318' };
const BASE_URL =
  process.env.E2E_BASE_URL ??
  (signedIn
    ? `http://localhost:${SIGNED_IN_PORTS.live}`
    : workbench
      ? `http://localhost:${WORKBENCH_PORTS.live}`
      : 'http://localhost:3302');
const runName = signedIn ? '-signed-in' : workbench ? '-workbench' : '';

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
        /signed-in\//,
        /perf\//,
        /optical-audit-sites\.spec\.ts/,
        /marketing-header-fit\.spec\.ts/,
        /workbench-(embed|workspace)\.spec\.ts/,
      ],
    },
    // The optical audit of the help centre, telemetry dashboard and marketing site, and the marketing
    // header's phone fit: the suites that need their builds, so CI gives them their own job and the
    // shards build only live (docs/specs/003-system-architecture/e2e-smoke.md "When it runs").
    {
      name: 'sites',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /(optical-audit-sites|marketing-header-fit)\.spec\.ts/,
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
    ...(signedIn
      ? [
          {
            name: 'signed-in',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /signed-in\/.*\.spec\.ts/,
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
    env: signedIn
      ? {
          E2E_EDITOR_OUT: '.next/out-signed-in',
          E2E_EDITOR_PORT: SIGNED_IN_PORTS.live,
          E2E_API_PORT: SIGNED_IN_PORTS.api,
          E2E_MARKETING_PORT: SIGNED_IN_PORTS.marketing,
          E2E_INDEX_PORT: SIGNED_IN_PORTS.index,
        }
      : workbench
        ? {
            E2E_EDITOR_PORT: WORKBENCH_PORTS.live,
            E2E_API_PORT: WORKBENCH_PORTS.api,
            E2E_MARKETING_PORT: WORKBENCH_PORTS.marketing,
            E2E_INDEX_PORT: WORKBENCH_PORTS.index,
          }
        : {},
  },
});
