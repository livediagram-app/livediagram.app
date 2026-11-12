// The canvas performance probe every editor runs (each product's docs/specs/008-canvas/canvas-performance.md
// "Measuring"; docs/instructions/trace-a-canvas-gesture.md): the reference board on each of the product's tabs, at fit
// and at 100%, every gesture traced with the CPU slowed to the reference speed (calibrate.ts), judged against the
// budget (budget.ts). It reports and never fails on a budget miss; a harness error (seeding, the stack, a missing
// element) does fail it. Each product's `e2e/perf/canvas.perf.ts` hands in how it seeds, signs in and opens a board.

import { mkdirSync, writeFileSync } from 'node:fs';
import type { APIRequestContext, Browser, BrowserContext, Page } from '@playwright/test';
import { budgetTable, evaluateBudget, medianOfRuns, type Measurement } from './budget';
import {
  REFERENCE_BENCH_MS,
  TARGET_SLOWDOWN,
  benchmarkInPage,
  calibratedThrottle,
  type Calibration,
} from './calibrate';
import {
  PROBE_OUT,
  PROBE_VIEW,
  REPEATS,
  measureZoom,
  type GestureSettings,
} from './canvas-gestures';
import { interactiveMs, OPEN_QUIET_MS } from './interactive';

export type CanvasProbeSettings<Tab extends string> = GestureSettings<Tab> & {
  /** The tabs the board is measured on, each seeded on its own item. */
  tabs: readonly Tab[];
  /** A guest owner for the seeded items. */
  mintGuest: (request: APIRequestContext) => Promise<string>;
  /** Seeds the reference board on a new item for `tab`, answering its id (and failing on a refused seed). */
  seed: (page: Page, baseURL: string, owner: string, tab: Tab) => Promise<string>;
  /** Signs a fresh context in as `owner`, with the name already confirmed, before any page opens. */
  signIn: (ctx: BrowserContext, owner: string) => Promise<unknown>;
  /** The editor's path for an item. */
  itemPath: (id: string) => string;
  /** The tab GET whose response an open is timed from, as a pathname pattern (RegExp source). */
  tabResponsePath: string;
  /** Closes the product's first-run tour, if it has one. */
  dismissQuickTour: (page: Page) => Promise<void>;
};

// The machine's speed: the fastest of five fresh blank pages' benchmark medians, unthrottled.
// Interference (other processes, a busy core, the first page's warm-up) only ever slows a run, so the
// fastest is the machine's own speed.
async function benchmark(browser: Browser): Promise<number> {
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const page = await browser.newPage();
    await page.goto('about:blank');
    runs.push(await page.evaluate(benchmarkInPage));
    await page.close();
  }
  return Math.min(...runs);
}

// Opening (D68, D80): the probe waits until the page has been quiet for OPEN_QUIET_MS before it reads
// the number, and touches the page (the tour check, keys) only after, so its own work stays out.
const OPEN_POLL_MS = 1000;
const OPEN_SETTLE_TIMEOUT_MS = 60_000;

// One open of the board in a fresh context: how long it took to become interactive, and the page,
// ready for gestures.
async function openBoard<Tab extends string>(
  browser: Browser,
  owner: string,
  id: string,
  throttle: number,
  settings: CanvasProbeSettings<Tab>,
) {
  const ctx = await browser.newContext({ viewport: PROBE_VIEW, colorScheme: 'dark' });
  await settings.signIn(ctx, owner);
  await ctx.addInitScript(() => {
    // The gesture rows read long tasks (`timed`); the open row reads long tasks and long animation
    // frames together, from the very start, since long tasks alone miss a frame that only renders.
    const w = window as unknown as {
      __longTasks: { start: number; end: number }[];
      __busy: { start: number; end: number }[];
    };
    w.__longTasks = [];
    w.__busy = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        const span = { start: e.startTime, end: e.startTime + e.duration };
        w.__longTasks.push(span);
        w.__busy.push(span);
      }
    }).observe({ type: 'longtask', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        w.__busy.push({ start: e.startTime, end: e.startTime + e.duration });
    }).observe({ type: 'long-animation-frame', buffered: true });
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto(settings.itemPath(id));
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 60_000 });
  await page.locator('[data-element-id="ref-0"]').first().waitFor({ timeout: 60_000 });
  const ms = await settledOpenMs(page, settings.tabResponsePath);
  await settings.dismissQuickTour(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await page.waitForTimeout(2000);
  return { ctx, page, cdp, openMs: ms };
}

// Polls until the quiet window interactiveMs found has actually elapsed, then returns it.
async function settledOpenMs(page: Page, tabResponsePath: string): Promise<number> {
  const deadline = Date.now() + OPEN_SETTLE_TIMEOUT_MS;
  for (;;) {
    await page.waitForTimeout(OPEN_POLL_MS);
    const { from, busy, now } = await page.evaluate((path) => {
      const tabPath = new RegExp(path);
      const tab = performance
        .getEntriesByType('resource')
        .filter((e) => tabPath.test(new URL(e.name).pathname))
        .map((e) => (e as PerformanceResourceTiming).responseEnd)
        .sort((a, b) => a - b)[0];
      return {
        from: tab ?? null,
        busy: (window as unknown as { __busy: { start: number; end: number }[] }).__busy,
        now: performance.now(),
      };
    }, tabResponsePath);
    if (from === null) throw new Error('no tab response');
    const ms = interactiveMs(from, busy);
    if (now - (from + ms) >= OPEN_QUIET_MS) return ms;
    if (Date.now() > deadline)
      throw new Error(
        `opening never went quiet for ${OPEN_QUIET_MS} ms within ${OPEN_SETTLE_TIMEOUT_MS} ms`,
      );
  }
}

/** The probe's test body: calibrate, then on each tab open the board REPEATS times and run the gestures. */
export async function runCanvasProbe<Tab extends string>(
  { browser, baseURL, page }: { browser: Browser; baseURL: string | undefined; page: Page },
  settings: CanvasProbeSettings<Tab>,
): Promise<void> {
  mkdirSync(`${PROBE_OUT}/traces`, { recursive: true });
  const benchMs = await benchmark(browser);
  const calibration: Calibration = calibratedThrottle(benchMs);
  const speed =
    `Throttled ${calibration.rate.toFixed(2)}× (benchmark ${benchMs.toFixed(1)} ms; the reference, ` +
    `${REFERENCE_BENCH_MS} ms, throttled ${TARGET_SLOWDOWN}×)` +
    (calibration.slowerThanTarget
      ? ': this machine is slower than the reference speed, so these numbers read harsher than the budget.'
      : '.');
  process.stdout.write(`[canvas-perf] ${speed}\n`);
  const owner = await settings.mintGuest(page.request);
  const measurements: Measurement<Tab>[] = [];
  for (const tab of settings.tabs) {
    const id = await settings.seed(page, baseURL!, owner, tab);
    // Opened REPEATS times, each in a fresh context; the gestures run on the last.
    const opens: Measurement<Tab>[] = [];
    let board!: Awaited<ReturnType<typeof openBoard>>;
    for (let r = 0; r < REPEATS; r++) {
      if (board) await board.ctx.close();
      board = await openBoard(browser, owner, id, calibration.rate, settings);
      opens.push({ tab, zoom: 'fit', gesture: 'open', longestTaskMs: 0, openMs: board.openMs });
    }
    measurements.push(medianOfRuns(opens));
    for (const zoom of ['fit', '100%'] as const)
      measurements.push(...(await measureZoom(board.cdp, board.page, tab, zoom, settings)));
    await board.ctx.close();
  }
  const rows = evaluateBudget(measurements);
  const table = budgetTable(rows);
  writeFileSync(`${PROBE_OUT}/canvas-perf.json`, JSON.stringify(rows, null, 2));
  writeFileSync(`${PROBE_OUT}/canvas-perf.md`, `${speed}\n\n${table}\n`);
  writeFileSync(
    `${PROBE_OUT}/calibration.json`,
    JSON.stringify({ benchMs, ...calibration }, null, 2),
  );
  process.stdout.write(
    `\n${speed}\n\n${table}\n\n${rows.filter((r) => !r.pass).length} of ${rows.length} rows over budget\n`,
  );
}
