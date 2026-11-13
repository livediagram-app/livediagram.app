import { mkdirSync, writeFileSync } from 'node:fs';
import {
  countElementRenders,
  describeReading,
  probeThrottle,
  type MainThreadReading,
} from '@liveworkspace/e2e-kit/perf/main-thread-probe';
import { measureThemePick } from '@liveworkspace/e2e-kit/perf/theme-pick-probe';
import {
  adoptGuest,
  dismissQuickTour,
  expect,
  mintGuest,
  ownerHeaders,
  seedPlan,
  test,
} from '../fixtures';
import { buildReferenceBoard } from './reference-board';

// A theme pick on a big board (docs/specs/008-canvas/canvas-performance.md "A theme pick on a big board"): the
// reference board's mix at n elements on a Plan tab, one theme picked in the Tab Style dialog, at the reference
// speed. Reports the longest task and frame gap (@liveworkspace/e2e-kit/perf/theme-pick-probe); never fails on a
// number. Run against a production build: `E2E_PERF=1 pnpm exec playwright test --project=perf theme-pick`.
// THEME_PERF_SIZES (400,1000), THEME_PERF_THROTTLE (a fixed rate), THEME_PERF_COUNT=1 (count the element views
// rendered, untimed), THEME_PERF_TRACE=1 (a Chromium trace in test-results/perf).

const OUT = 'test-results/perf';
const CANVAS = '[data-canvas-a11y-root]';
const SIZES = (process.env.THEME_PERF_SIZES ?? '400,1000').split(',').map(Number);
const results: Record<string, MainThreadReading> = {};

for (const n of SIZES) {
  test(`a theme pick on a ${n}-element board`, async ({ page, browser, baseURL }) => {
    test.setTimeout(240_000);
    const rate = await probeThrottle(browser, process.env.THEME_PERF_THROTTLE);
    const owner = await mintGuest(page.request);
    const id = crypto.randomUUID();
    const seeded = await seedPlan(
      page.request,
      ownerHeaders(owner, { Origin: new URL(baseURL!).origin }),
      {
        id,
        name: 'Board',
        tabs: [{ id: crypto.randomUUID(), name: 'Board', elements: buildReferenceBoard(1, n) }],
      },
    );
    expect(seeded.ok()).toBe(true);
    const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
    await adoptGuest(ctx, owner);
    await ctx.addInitScript(() => localStorage.setItem('liveplanner:v2:name-confirmed', '1'));
    if (process.env.THEME_PERF_COUNT === '1') await countElementRenders(ctx);
    const p = await ctx.newPage();
    await p.goto(`/project/${id}`);
    await p.locator(CANVAS).waitFor();
    await dismissQuickTour(p);
    await expect(p.locator(`${CANVAS} [data-element-id]`).first()).toBeAttached();
    await p.waitForTimeout(1500);

    const reading = await measureThemePick(
      browser,
      p,
      rate,
      process.env.THEME_PERF_TRACE === '1'
        ? { path: `${OUT}/theme-pick-${n}.trace.json`, invalidations: false }
        : undefined,
    );
    results[`${n}`] = reading;
    console.log(`${describeReading(`theme pick ${n}`, rate, reading)}; picked ${reading.picked}`);
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/theme-pick.json`, JSON.stringify(results, null, 2));
    await ctx.close();
  });
}
