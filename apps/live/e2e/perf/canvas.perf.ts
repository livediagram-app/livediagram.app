import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { Browser, CDPSession, Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  test,
} from '../fixtures';
import {
  REFERENCE_BENCH_MS,
  TARGET_SLOWDOWN,
  benchmarkInPage,
  calibratedThrottle,
  type Calibration,
} from './calibrate';
import {
  budgetTable,
  evaluateBudget,
  medianOfRuns,
  type Gesture,
  type Measurement,
} from './budget';
import { interactiveMs, OPEN_QUIET_MS } from './interactive';
import { buildReferenceBoard } from './reference-board';
import { mainThreadTasks, type TraceEvent } from './trace-tasks';

// The canvas performance probe (docs/specs/008-canvas/canvas-performance.md "Measuring";
// docs/instructions/trace-a-canvas-gesture.md): the reference board on a whiteboard and a diagram, at
// fit and at 100%, every gesture traced with the CPU slowed to the reference speed (calibrate.ts),
// judged against the budget. It reports and never
// fails on a budget miss; a harness error (seeding, the stack, a missing element) does fail it.
// Run with `pnpm --filter @livediagram/live perf:canvas`.

const OUT = 'test-results/perf';
const CATEGORIES = 'devtools.timeline,disabled-by-default-devtools.timeline';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const VIEW = { width: 1440, height: 900 };
const SHAPE_IDS = buildReferenceBoard()
  .filter((el) => el.type === 'shape')
  .map((el) => el.id);

type Tab = Measurement['tab'];
type Point = { x: number; y: number };

async function seed(page: Page, baseURL: string, owner: string, tab: Tab): Promise<string> {
  const id = crypto.randomUUID();
  const elements = buildReferenceBoard();
  const res = await page.request.post(`${apiBase}/documents`, {
    headers: ownerHeaders(owner, { Origin: new URL(baseURL).origin }),
    data: {
      id,
      name: `Reference board (${tab})`,
      // The whiteboard series is a general tab opening in Draw mode (docs/specs/007-editor/editor-modes.md).
      tabs: [
        {
          id: crypto.randomUUID(),
          name: 'Board',
          ...(tab === 'whiteboard' ? { opensIn: 'draw' } : {}),
          elements,
        },
      ],
    },
  });
  expect(res.ok(), `seeding the ${tab} board`).toBe(true);
  return id;
}

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
async function openBoard(browser: Browser, owner: string, id: string, throttle: number) {
  const ctx = await browser.newContext({ viewport: VIEW, colorScheme: 'dark' });
  await ctx.addInitScript(
    ({ o, sig }) => {
      localStorage.setItem('livediagram:v2:self-id', o);
      if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
      // Every long task and long animation frame from the very start, for the open row: long tasks
      // alone miss a frame that only renders.
      const w = window as unknown as { __busy: { start: number; end: number }[] };
      w.__busy = [];
      for (const type of ['longtask', 'long-animation-frame'])
        new PerformanceObserver((list) => {
          for (const e of list.getEntries())
            w.__busy.push({ start: e.startTime, end: e.startTime + e.duration });
        }).observe({ type, buffered: true });
    },
    { o: owner, sig: guestSigFor(owner) },
  );
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.goto(`/document/${id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 60_000 });
  await page.locator('[data-element-id="ref-0"]').first().waitFor({ timeout: 60_000 });
  const ms = await settledOpenMs(page);
  await dismissQuickTour(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await page.waitForTimeout(2000);
  return { ctx, page, cdp, openMs: ms };
}

// Polls until the quiet window interactiveMs found has actually elapsed, then returns it.
async function settledOpenMs(page: Page): Promise<number> {
  const deadline = Date.now() + OPEN_SETTLE_TIMEOUT_MS;
  for (;;) {
    await page.waitForTimeout(OPEN_POLL_MS);
    const { from, busy, now } = await page.evaluate(() => {
      const tab = performance
        .getEntriesByType('resource')
        .filter((e) => /\/documents\/[^/]+\/tabs\/[^/?]+$/.test(new URL(e.name).pathname))
        .map((e) => (e as PerformanceResourceTiming).responseEnd)
        .sort((a, b) => a - b)[0];
      return {
        from: tab ?? null,
        busy: (window as unknown as { __busy: { start: number; end: number }[] }).__busy,
        now: performance.now(),
      };
    });
    if (from === null) throw new Error('no tab response');
    const ms = interactiveMs(from, busy);
    if (now - (from + ms) >= OPEN_QUIET_MS) return ms;
    if (Date.now() > deadline)
      throw new Error(
        `opening never went quiet for ${OPEN_QUIET_MS} ms within ${OPEN_SETTLE_TIMEOUT_MS} ms`,
      );
  }
}

async function traced(
  cdp: CDPSession,
  page: Page,
  label: string,
  run: () => Promise<void>,
  frames = true,
): Promise<{ tasks: number[]; frameMs: number[] }> {
  const events: TraceEvent[] = [];
  const onData = (d: { value: object[] }) => {
    events.push(...(d.value as TraceEvent[]));
  };
  cdp.on('Tracing.dataCollected', onData);
  const done = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
  await cdp.send('Tracing.start', { categories: CATEGORIES, transferMode: 'ReportEvents' });
  if (frames) {
    await page.evaluate(() => {
      const w = window as unknown as { __frames: number[]; __recording: boolean };
      w.__frames = [];
      w.__recording = true;
      let last = performance.now();
      const tick = (t: number) => {
        w.__frames.push(t - last);
        last = t;
        if (w.__recording) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
  await run();
  const frameMs = frames
    ? await page.evaluate(() => {
        const w = window as unknown as { __frames: number[]; __recording: boolean };
        w.__recording = false;
        return w.__frames.slice(1);
      })
    : [];
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  writeFileSync(`${OUT}/traces/${label}.json.gz`, gzipSync(JSON.stringify(events)));
  return { tasks: mainThreadTasks(events), frameMs };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

// A shape near the middle of the view, and a spot of bare canvas, for the gestures to use.
async function targets(page: Page): Promise<{ shape: Point; bare: Point }> {
  return page.evaluate(
    ({ w, h, shapeIds }) => {
      const centre = { x: w / 2, y: h / 2 };
      const all = shapeIds
        .map((id) => document.querySelector<HTMLElement>(`[data-element-id="${id}"]`))
        .filter((el): el is HTMLElement => el !== null)
        .map((el) => ({ el, r: el.getBoundingClientRect() }));
      const shapes = all.filter(
        ({ r }) =>
          r.width > 8 && r.left > 280 && r.right < w - 280 && r.top > 140 && r.bottom < h - 140,
      );
      const near = shapes.sort(
        (a, b) =>
          Math.hypot(a.r.x - centre.x, a.r.y - centre.y) -
          Math.hypot(b.r.x - centre.x, b.r.y - centre.y),
      )[0];
      if (!near) throw new Error(`no shape in view (${all.length} shapes in the DOM)`);
      const isBare = (x: number, y: number) => {
        const hit = document.elementFromPoint(x, y);
        return (
          !!hit &&
          !!hit.closest('[data-canvas-a11y-root]') &&
          !hit.closest(
            '[data-element-id], [data-floating-panel], [data-whiteboard-dock], header, nav',
          )
        );
      };
      for (let y = 220; y < h - 260; y += 37)
        for (let x = 320; x < w - 420; x += 41)
          if (isBare(x, y))
            return {
              shape: { x: near.r.x + near.r.width / 2, y: near.r.y + near.r.height / 2 },
              bare: { x, y },
            };
      throw new Error('no bare canvas in view');
    },
    { w: VIEW.width, h: VIEW.height, shapeIds: SHAPE_IDS },
  );
}

async function moves(page: Page, from: Point, n: number, step: (i: number) => Point) {
  for (let i = 1; i <= n; i++) {
    const d = step(i);
    await page.mouse.move(from.x + d.x, from.y + d.y);
    await page.waitForTimeout(16);
  }
}

// Each gesture's runs (docs/specs/008-canvas/canvas-performance.md "Measuring"): this many, untraced,
// read from the page; one more traced for attribution, not counted.
const REPEATS = 5;

// One untraced run of `act`, read from the page itself: its longest task (from the long-task entries
// recorded since load) and, when asked, its frame times.
async function timed(
  page: Page,
  act: () => Promise<void>,
  frames: boolean,
): Promise<{ longest: number; frameMs: number[] }> {
  const from = await page.evaluate((record) => {
    const w = window as unknown as { __frames: number[]; __recording: boolean };
    if (record) {
      w.__frames = [];
      w.__recording = true;
      let last = performance.now();
      const tick = (t: number) => {
        w.__frames.push(t - last);
        last = t;
        if (w.__recording) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
    return performance.now();
  }, frames);
  await act();
  return page.evaluate((t0) => {
    const w = window as unknown as {
      __frames: number[];
      __recording: boolean;
      __longTasks: { start: number; end: number }[];
    };
    w.__recording = false;
    const longest = w.__longTasks
      .filter((t) => t.end > t0)
      .reduce((max, t) => Math.max(max, t.end - Math.max(t.start, t0)), 0);
    return { longest, frameMs: (w.__frames ?? []).slice(1) };
  }, from);
}

type Step = {
  gesture: Exclude<Gesture, 'open' | 'idle'>;
  setup?: () => Promise<void>;
  act: () => Promise<void>;
  reset?: () => Promise<void>;
};

async function measureZoom(
  cdp: CDPSession,
  page: Page,
  tab: Tab,
  zoom: Measurement['zoom'],
): Promise<Measurement[]> {
  // Fit first, which centres the board; 100% then zooms in on that centre (Mod+0; a bare 0 is the eraser).
  const setView = async () => {
    await page.keyboard.press('Escape');
    await page.keyboard.press('v');
    await page.keyboard.press('Shift+1');
    if (zoom === '100%') await page.keyboard.press('ControlOrMeta+0');
    await page.waitForTimeout(1000);
  };
  await setView();
  await page.waitForTimeout(500);
  // What the gestures ran on, kept with the report.
  await page.screenshot({ path: `${OUT}/${tab}-${zoom}.png` });
  const { shape, bare } = await targets(page);
  const settleUndo = async () => {
    await page.keyboard.press('ControlOrMeta+z');
    // Let the undo land before the next run's window opens.
    await page.waitForTimeout(1000);
  };
  const steps: Step[] = [
    {
      gesture: 'select',
      setup: async () => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      },
      act: async () => {
        await page.mouse.click(shape.x, shape.y);
        await page.waitForTimeout(400);
      },
    },
    {
      gesture: 'drag',
      act: async () => {
        await page.mouse.move(shape.x, shape.y);
        await page.mouse.down();
        await moves(page, shape, 30, (k) => ({ x: k * 4, y: k * 2 }));
        await page.mouse.up();
        await page.waitForTimeout(400);
      },
      reset: settleUndo,
    },
    {
      gesture: 'deselect',
      setup: async () => {
        await page.mouse.click(shape.x, shape.y);
        await page.waitForTimeout(400);
      },
      act: async () => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      },
    },
    {
      gesture: 'marquee',
      act: async () => {
        await page.mouse.move(bare.x, bare.y);
        await page.mouse.down();
        await moves(page, bare, 25, (k) => ({ x: k * 10, y: k * 8 }));
        await page.mouse.up();
        await page.waitForTimeout(400);
      },
      reset: async () => {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      },
    },
    {
      gesture: 'stroke',
      setup: () => page.keyboard.press(tab === 'whiteboard' ? '1' : 'p'),
      act: async () => {
        await page.mouse.move(bare.x, bare.y);
        await page.mouse.down();
        await moves(page, bare, 30, (k) => ({ x: k * 3, y: Math.sin(k / 3) * 20 }));
        await page.mouse.up();
        await page.waitForTimeout(400);
      },
      reset: async () => {
        await page.keyboard.press('Escape');
        await page.keyboard.press('v');
        await settleUndo();
      },
    },
    {
      gesture: 'hover',
      act: () => moves(page, { x: 300, y: 300 }, 40, (k) => ({ x: k * 20, y: (k % 8) * 30 })),
    },
    {
      gesture: 'pan',
      act: async () => {
        await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
        for (let k = 0; k < 30; k++) {
          await page.mouse.wheel(30, 20);
          await page.waitForTimeout(16);
        }
        await page.waitForTimeout(300);
      },
      reset: setView,
    },
    {
      gesture: 'zoom',
      act: async () => {
        await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
        await page.keyboard.down('Control');
        for (let k = 0; k < 16; k++) {
          await page.mouse.wheel(0, k < 8 ? -40 : 40);
          await page.waitForTimeout(16);
        }
        await page.keyboard.up('Control');
        await page.waitForTimeout(300);
      },
      reset: setView,
    },
  ];

  const out: Measurement[] = [];
  // The still board: its total main-thread work, read from a trace (a task's length is the wrong
  // scale for a 5 ms limit).
  const idle: Measurement[] = [];
  for (let r = 0; r < REPEATS; r++) {
    const { tasks } = await traced(
      cdp,
      page,
      `${tab}-${zoom}-idle-${r}`,
      () => page.waitForTimeout(2000),
      false,
    );
    idle.push({
      tab,
      zoom,
      gesture: 'idle',
      longestTaskMs: Math.max(0, ...tasks),
      idleWorkMs: tasks.reduce((a, b) => a + b, 0),
    });
  }
  out.push(medianOfRuns(idle));
  for (const step of steps) {
    const runs: Measurement[] = [];
    for (let r = 0; r < REPEATS; r++) {
      await step.setup?.();
      const { longest, frameMs } = await timed(page, step.act, step.gesture === 'drag');
      await step.reset?.();
      runs.push({
        tab,
        zoom,
        gesture: step.gesture,
        longestTaskMs: longest,
        ...(step.gesture === 'drag' ? { medianFrameMs: median(frameMs) } : {}),
      });
    }
    out.push(medianOfRuns(runs));
    // One more, traced, for attribution; not counted.
    await step.setup?.();
    await traced(cdp, page, `${tab}-${zoom}-${step.gesture}`, step.act, false);
    await step.reset?.();
  }
  return out;
}

test('canvas performance budget', async ({ browser, baseURL, page }) => {
  // Five runs of each gesture: a fast desktop takes about 15 minutes, a hosted runner about an hour.
  test.setTimeout(100 * 60_000);
  mkdirSync(`${OUT}/traces`, { recursive: true });
  const benchMs = await benchmark(browser);
  const calibration: Calibration = calibratedThrottle(benchMs);
  const speed =
    `Throttled ${calibration.rate.toFixed(2)}× (benchmark ${benchMs.toFixed(1)} ms; the reference, ` +
    `${REFERENCE_BENCH_MS} ms, throttled ${TARGET_SLOWDOWN}×)` +
    (calibration.slowerThanTarget
      ? ': this machine is slower than the reference speed, so these numbers read harsher than the budget.'
      : '.');
  process.stdout.write(`[canvas-perf] ${speed}\n`);
  const owner = await mintSignedGuest(page.request);
  const measurements: Measurement[] = [];
  for (const tab of ['whiteboard', 'diagram'] as const) {
    const id = await seed(page, baseURL!, owner, tab);
    // Opened REPEATS times, each in a fresh context; the gestures run on the last.
    const opens: Measurement[] = [];
    let board!: Awaited<ReturnType<typeof openBoard>>;
    for (let r = 0; r < REPEATS; r++) {
      if (board) await board.ctx.close();
      board = await openBoard(browser, owner, id, calibration.rate);
      opens.push({ tab, zoom: 'fit', gesture: 'open', longestTaskMs: 0, openMs: board.openMs });
    }
    measurements.push(medianOfRuns(opens));
    for (const zoom of ['fit', '100%'] as const)
      measurements.push(...(await measureZoom(board.cdp, board.page, tab, zoom)));
    await board.ctx.close();
  }
  const rows = evaluateBudget(measurements);
  const table = budgetTable(rows);
  writeFileSync(`${OUT}/canvas-perf.json`, JSON.stringify(rows, null, 2));
  writeFileSync(`${OUT}/canvas-perf.md`, `${speed}\n\n${table}\n`);
  writeFileSync(`${OUT}/calibration.json`, JSON.stringify({ benchMs, ...calibration }, null, 2));
  process.stdout.write(
    `\n${speed}\n\n${table}\n\n${rows.filter((r) => !r.pass).length} of ${rows.length} rows over budget\n`,
  );
});
