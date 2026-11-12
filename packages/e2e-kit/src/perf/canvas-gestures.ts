// The canvas probe's gestures (canvas-probe.ts; each product's docs/specs/008-canvas/canvas-performance.md
// "Measuring"): at one zoom, the still board's work from a trace, then every gesture run REPEATS times untraced,
// read from the page, and once more traced for attribution, not counted.

import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import type { CDPSession, Page } from '@playwright/test';
import { medianOfRuns, type Gesture, type Measurement } from './budget';
import { mainThreadTasks, type TraceEvent } from './trace-tasks';

export const PROBE_OUT = 'test-results/perf';
export const PROBE_VIEW = { width: 1440, height: 900 };
const CATEGORIES = 'devtools.timeline,disabled-by-default-devtools.timeline';

// Each gesture's runs: this many, untraced, read from the page; one more traced for attribution, not counted.
export const REPEATS = 5;

type Point = { x: number; y: number };

/** What the gestures need from the product: its board's shapes, its canvas chrome, and its pen key. */
export type GestureSettings<Tab extends string> = {
  /** The ids of the reference board's shapes, one of which the gestures select and drag. */
  shapeIds: readonly string[];
  /** What a bare-canvas point must not land on (an element, a floating panel, the product's docks). */
  bareExclude: string;
  /** The key that picks the pen on a tab for the stroke gesture; null runs no stroke. */
  strokeKey: ((tab: Tab) => string) | null;
};

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
  writeFileSync(`${PROBE_OUT}/traces/${label}.json.gz`, gzipSync(JSON.stringify(events)));
  return { tasks: mainThreadTasks(events), frameMs };
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

// A shape near the middle of the view, and a spot of bare canvas, for the gestures to use.
async function targets(
  page: Page,
  shapeIds: readonly string[],
  bareExclude: string,
): Promise<{ shape: Point; bare: Point }> {
  return page.evaluate(
    ({ w, h, shapeIds, bareExclude }) => {
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
        return !!hit && !!hit.closest('[data-canvas-a11y-root]') && !hit.closest(bareExclude);
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
    { w: PROBE_VIEW.width, h: PROBE_VIEW.height, shapeIds: [...shapeIds], bareExclude },
  );
}

async function moves(page: Page, from: Point, n: number, step: (i: number) => Point) {
  for (let i = 1; i <= n; i++) {
    const d = step(i);
    await page.mouse.move(from.x + d.x, from.y + d.y);
    await page.waitForTimeout(16);
  }
}

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

export async function measureZoom<Tab extends string>(
  cdp: CDPSession,
  page: Page,
  tab: Tab,
  zoom: Measurement<Tab>['zoom'],
  settings: GestureSettings<Tab>,
): Promise<Measurement<Tab>[]> {
  // Fit first, which centres the board; 100% then zooms in on that centre (Mod+0, never a bare 0, which may be a
  // tool's key).
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
  await page.screenshot({ path: `${PROBE_OUT}/${tab}-${zoom}.png` });
  const { shape, bare } = await targets(page, settings.shapeIds, settings.bareExclude);
  const settleUndo = async () => {
    await page.keyboard.press('ControlOrMeta+z');
    // Let the undo land before the next run's window opens.
    await page.waitForTimeout(1000);
  };
  const strokeKey = settings.strokeKey;
  const stroke: Step[] = strokeKey
    ? [
        {
          gesture: 'stroke',
          setup: () => page.keyboard.press(strokeKey(tab)),
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
      ]
    : [];
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
    ...stroke,
    {
      gesture: 'hover',
      act: () => moves(page, { x: 300, y: 300 }, 40, (k) => ({ x: k * 20, y: (k % 8) * 30 })),
    },
    {
      gesture: 'pan',
      act: async () => {
        await page.mouse.move(PROBE_VIEW.width / 2, PROBE_VIEW.height / 2);
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
        await page.mouse.move(PROBE_VIEW.width / 2, PROBE_VIEW.height / 2);
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

  const out: Measurement<Tab>[] = [];
  // The still board: its total main-thread work, read from a trace (a task's length is the wrong
  // scale for a 5 ms limit).
  const idle: Measurement<Tab>[] = [];
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
    const runs: Measurement<Tab>[] = [];
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
