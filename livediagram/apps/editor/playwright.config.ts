import { defineConfig, devices } from '@playwright/test';

// E2E smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Chromium only; deliberately small. Runs
// against the real production build + api worker + liveworkspace's local index (scripts/e2e-stack.mjs; the
// default stack's index on :8119),
// or a developer's already-running `pnpm dev` stack when one is up
// (reuseExistingServer below).
const isCI = !!process.env.CI;
const CI_WORKERS = 4;
// The signed-in specs (e2e/signed-in/, docs/specs/003-system-architecture/e2e-smoke.md) need
// the signed-in export (`pnpm build:signed-in`). They run as their own invocation
// (`pnpm test:e2e:signed-in`) on their own ports, so a guest stack already up on :3102 is never
// mistaken for it.
const signedIn = process.env.E2E_SIGNED_IN === '1';
const SIGNED_IN_PORTS = { live: '3115', api: '8115', marketing: '3116', index: '8117' };
// The workbench embed e2e (docs/specs/013-workspace/blueprints/workbench-embeds.md "Testing") needs the
// NEXT_PUBLIC_E2E_AUTH export and the stack acting as the accounts Worker, so it runs as its own invocation
// (`pnpm test:e2e:workbench`) on its own ports.
const workbench = process.env.E2E_WORKBENCH === '1';
const WORKBENCH_PORTS = { live: '3121', api: '8121', marketing: '3122', index: '8118' };
const BASE_URL =
  process.env.E2E_BASE_URL ??
  (signedIn
    ? `http://localhost:${SIGNED_IN_PORTS.live}`
    : workbench
      ? `http://localhost:${WORKBENCH_PORTS.live}`
      : 'http://localhost:3102');
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
      // The Drive, signed-in and sites suites need their own builds and stacks; see below.
      testIgnore: [
        /drive-(mirror|shots)\.spec\.ts/,
        /signed-in\//,
        /perf\//,
        /optical-audit-sites\.spec\.ts/,
        /workbench-(embed|workspace)\.spec\.ts/,
      ],
    },
    // The optical audit of the help centre, telemetry dashboard, Community and marketing site: the one suite
    // that needs their builds, so CI gives it its own job and the shards build only live
    // (docs/specs/003-system-architecture/e2e-smoke.md "When it runs").
    {
      name: 'sites',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /optical-audit-sites\.spec\.ts/,
    },
    // Opt-in (pnpm --filter @livediagram/editor test:e2e:drive): the Google Drive
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
