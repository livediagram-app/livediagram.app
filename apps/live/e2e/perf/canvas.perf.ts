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
import { budgetTable, evaluateBudget, type Gesture, type Measurement } from './budget';
import { buildReferenceBoard } from './reference-board';
import { mainThreadTasks, type TraceEvent } from './trace-tasks';

// The canvas performance probe (docs/specs/008-canvas/canvas-performance.md "Measuring";
// docs/instructions/trace-a-canvas-gesture.md): the reference board on a whiteboard and a diagram, at
// fit and at 100%, every gesture traced at 4x CPU, judged against the budget. It reports and never
// fails on a budget miss; a harness error (seeding, the stack, a missing element) does fail it.
// Run with `pnpm --filter @livediagram/live perf:canvas`.

const OUT = 'test-results/perf';
const THROTTLE = 4;
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
      tabs: [{ id: crypto.randomUUID(), name: 'Board', kind: tab, elements }],
    },
  });
  expect(res.ok(), `seeding the ${tab} board`).toBe(true);
  return id;
}

async function openBoard(browser: Browser, owner: string, id: string) {
  const ctx = await browser.newContext({ viewport: VIEW, colorScheme: 'dark' });
  await ctx.addInitScript(
    ({ o, sig }) => {
      localStorage.setItem('livediagram:v2:self-id', o);
      if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
      // Long tasks from the very start, for the open row.
      const w = window as unknown as { __longTasks: { start: number; end: number }[] };
      w.__longTasks = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          w.__longTasks.push({ start: e.startTime, end: e.startTime + e.duration });
      }).observe({ type: 'longtask', buffered: true });
    },
    { o: owner, sig: guestSigFor(owner) },
  );
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  await page.goto(`/document/${id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 60_000 });
  await page.locator('[data-element-id="ref-0"]').first().waitFor({ timeout: 60_000 });
  await dismissQuickTour(page);
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  // Settle, and leave room for the open row's quiet window.
  await page.waitForTimeout(4000);
  return { ctx, page, cdp };
}

// Interactive: from the tab's response to the start of the first 500 ms with no long task
// (docs/specs/008-canvas/blueprints/DEFAULTS.md D68).
async function openMs(page: Page): Promise<number> {
  return page.evaluate(() => {
    const tab = performance
      .getEntriesByType('resource')
      .filter((e) => /\/documents\/[^/]+\/tabs\/[^/?]+$/.test(new URL(e.name).pathname))
      .map((e) => (e as PerformanceResourceTiming).responseEnd)
      .sort((a, b) => a - b)[0];
    if (tab === undefined) throw new Error('no tab response');
    const tasks = (
      window as unknown as { __longTasks: { start: number; end: number }[] }
    ).__longTasks
      .filter((t) => t.end > tab)
      .sort((a, b) => a.start - b.start);
    let quietFrom = tab;
    for (const t of tasks) {
      if (t.start - quietFrom >= 500) break;
      quietFrom = Math.max(quietFrom, t.end);
    }
    return quietFrom - tab;
  });
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

async function measureZoom(
  cdp: CDPSession,
  page: Page,
  tab: Tab,
  zoom: Measurement['zoom'],
): Promise<Measurement[]> {
  // Fit first, which centres the board; 100% then zooms in on that centre (Mod+0; a bare 0 is the eraser).
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await page.keyboard.press('Shift+1');
  if (zoom === '100%') await page.keyboard.press('ControlOrMeta+0');
  await page.waitForTimeout(1500);
  // What the gestures ran on, kept with the report.
  await page.screenshot({ path: `${OUT}/${tab}-${zoom}.png` });
  const { shape, bare } = await targets(page);
  const out: Measurement[] = [];
  const run = async (gesture: Gesture, fn: () => Promise<void>, frames = true) => {
    const { tasks, frameMs } = await traced(cdp, page, `${tab}-${zoom}-${gesture}`, fn, frames);
    out.push({
      tab,
      zoom,
      gesture,
      longestTaskMs: Math.max(0, ...tasks),
      ...(gesture === 'drag' ? { medianFrameMs: median(frameMs) } : {}),
      ...(gesture === 'idle' ? { idleWorkMs: tasks.reduce((a, b) => a + b, 0) } : {}),
    });
  };

  await run('idle', () => page.waitForTimeout(2000), false);
  await run('select', async () => {
    await page.mouse.click(shape.x, shape.y);
    await page.waitForTimeout(400);
  });
  await run('drag', async () => {
    await page.mouse.move(shape.x, shape.y);
    await page.mouse.down();
    await moves(page, shape, 30, (i) => ({ x: i * 4, y: i * 2 }));
    await page.mouse.up();
    await page.waitForTimeout(400);
  });
  await page.keyboard.press('ControlOrMeta+z');
  // Let the undo land before the next gesture's window opens.
  await page.waitForTimeout(1000);
  await run('deselect', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  });
  await run('marquee', async () => {
    await page.mouse.move(bare.x, bare.y);
    await page.mouse.down();
    await moves(page, bare, 25, (i) => ({ x: i * 10, y: i * 8 }));
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
  });
  await page.keyboard.press(tab === 'whiteboard' ? '1' : 'p');
  await run('stroke', async () => {
    await page.mouse.move(bare.x, bare.y);
    await page.mouse.down();
    await moves(page, bare, 30, (i) => ({ x: i * 3, y: Math.sin(i / 3) * 20 }));
    await page.mouse.up();
    await page.waitForTimeout(400);
  });
  await page.keyboard.press('Escape');
  await page.keyboard.press('v');
  await page.keyboard.press('ControlOrMeta+z');
  // Let the undo land before the next gesture's window opens.
  await page.waitForTimeout(1000);
  await run('hover', () =>
    moves(page, { x: 300, y: 300 }, 40, (i) => ({ x: i * 20, y: (i % 8) * 30 })),
  );
  await run('pan', async () => {
    await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(30, 20);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(300);
  });
  await run('zoom', async () => {
    await page.mouse.move(VIEW.width / 2, VIEW.height / 2);
    await page.keyboard.down('Control');
    for (let i = 0; i < 16; i++) {
      await page.mouse.wheel(0, i < 8 ? -40 : 40);
      await page.waitForTimeout(16);
    }
    await page.keyboard.up('Control');
    await page.waitForTimeout(300);
  });
  return out;
}

test('canvas performance budget', async ({ browser, baseURL, page }) => {
  // A CI runner at 4x CPU takes about 17 minutes; a laptop about 4.
  test.setTimeout(40 * 60_000);
  mkdirSync(`${OUT}/traces`, { recursive: true });
  const owner = await mintSignedGuest(page.request);
  const measurements: Measurement[] = [];
  for (const tab of ['whiteboard', 'diagram'] as const) {
    const id = await seed(page, baseURL!, owner, tab);
    const board = await openBoard(browser, owner, id);
    measurements.push({
      tab,
      zoom: 'fit',
      gesture: 'open',
      longestTaskMs: 0,
      openMs: await openMs(board.page),
    });
    for (const zoom of ['fit', '100%'] as const)
      measurements.push(...(await measureZoom(board.cdp, board.page, tab, zoom)));
    await board.ctx.close();
  }
  const rows = evaluateBudget(measurements);
  const table = budgetTable(rows);
  writeFileSync(`${OUT}/canvas-perf.json`, JSON.stringify(rows, null, 2));
  writeFileSync(`${OUT}/canvas-perf.md`, `${table}\n`);
  process.stdout.write(
    `\n${table}\n\n${rows.filter((r) => !r.pass).length} of ${rows.length} rows over budget\n`,
  );
});
