// The main thread during one gesture, for the editors' one-gesture probes (a theme pick, a big board's open or
// import, a collaborator's view of a big drag; each product's docs/specs/008-canvas/canvas-performance.md): the
// long tasks and the longest gap between frames from a start to a read, at the reference speed (calibrate.ts), with
// an optional Chromium trace and a count of the element views React rendered. They report and never fail on a number.

import { mkdirSync, writeFileSync } from 'node:fs';
import type { Browser, BrowserContext, CDPSession, Page } from '@playwright/test';
import { benchmarkInPage, calibratedThrottle } from './calibrate';

// The machine's speed: the fastest of five fresh blank pages' benchmark medians, unthrottled.
// Interference (other processes, a busy core, the first page's warm-up) only ever slows a run, so the
// fastest is the machine's own speed.
export async function benchmark(browser: Browser): Promise<number> {
  const runs: number[] = [];
  for (let i = 0; i < 5; i++) {
    const page = await browser.newPage();
    await page.goto('about:blank');
    runs.push(await page.evaluate(benchmarkInPage));
    await page.close();
  }
  return Math.min(...runs);
}

let calibrated: number | null = null;

/** The CPU throttle a probe runs at: `override` (an env var's text) when it names one, else the reference speed,
 *  calibrated once per worker. One decimal. */
export async function probeThrottle(browser: Browser, override?: string): Promise<number> {
  if (override) return Number(override);
  calibrated ??= calibratedThrottle(await benchmark(browser)).rate;
  return Math.round(calibrated * 10) / 10;
}

export async function throttleCpu(page: Page, rate: number): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return cdp;
}

export type MainThreadReading = {
  longestTaskMs: number;
  longTasks: number[];
  longestGapMs: number;
  /** With countElementRenders installed: the elements whose views rendered, by id. */
  elementsRendered?: number;
  /** ... every layer of their views counted. */
  viewRenders?: number;
};

type ProbeWindow = {
  __probe: { longestTaskMs: number; longTasks: number[]; longestGapMs: number; stop?: boolean };
  __renders?: { ids: Set<unknown>; views: number };
};

/** Starts watching the page's long tasks and frame gaps (and zeroes the render count, when counting). */
export const startMainThreadProbe = (page: Page): Promise<void> =>
  page.evaluate(() => {
    const w = window as unknown as ProbeWindow;
    if (w.__renders) w.__renders = { ids: new Set(), views: 0 };
    w.__probe = { longestTaskMs: 0, longTasks: [], longestGapMs: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        w.__probe.longTasks.push(Math.round(e.duration));
        w.__probe.longestTaskMs = Math.max(w.__probe.longestTaskMs, e.duration);
      }
    }).observe({ type: 'longtask' });
    let last = performance.now();
    const frame = (t: number) => {
      w.__probe.longestGapMs = Math.max(w.__probe.longestGapMs, t - last);
      last = t;
      if (!w.__probe.stop) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

/** Stops the probe and reads it. */
export const readMainThreadProbe = (page: Page): Promise<MainThreadReading> =>
  page.evaluate(() => {
    const w = window as unknown as ProbeWindow;
    w.__probe.stop = true;
    return {
      longestTaskMs: Math.round(w.__probe.longestTaskMs),
      longTasks: w.__probe.longTasks,
      longestGapMs: Math.round(w.__probe.longestGapMs),
      ...(w.__renders
        ? { elementsRendered: w.__renders.ids.size, viewRenders: w.__renders.views }
        : {}),
    };
  });

/** One line for the report. */
export const describeReading = (what: string, rate: number, r: MainThreadReading): string =>
  `${what} @${rate}x: longest task ${r.longestTaskMs} ms, longest frame gap ${r.longestGapMs} ms` +
  (r.elementsRendered === undefined
    ? ''
    : `, elements rendered ${r.elementsRendered} (${r.viewRenders} view renders)`) +
  `, long tasks [${r.longTasks.join(', ')}]`;

/** Counts the element views React renders, from the next page load: through React's devtools hook, which a production
 *  build still calls on every commit. A component whose props carry an `element`, an `arrow` or an `item` with an id
 *  counts as that element's view. Walking the tree on every commit costs time, so a timed run leaves it out. */
export const countElementRenders = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(() => {
    type Fiber = {
      flags: number;
      child: Fiber | null;
      sibling: Fiber | null;
      memoizedProps: {
        element?: { id?: unknown };
        arrow?: { id?: unknown };
        item?: { id?: unknown };
      } | null;
    };
    const w = window as unknown as ProbeWindow & { __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown };
    w.__renders = { ids: new Set(), views: 0 };
    // A fiber that rendered is a new object in the tree (React swaps in its alternate) carrying React's PerformedWork
    // flag (1). A fiber left alone is the same object as in the commit before (its flags can be stale); one React
    // cloned under a parent that rendered, then bailed out of (a memo whose props were equal), is new but unflagged.
    let before = new WeakSet<Fiber>();
    w.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject: () => 1,
      checkDCE: () => {},
      onScheduleFiberRoot: () => {},
      onCommitFiberUnmount: () => {},
      onPostCommitFiberRoot: () => {},
      onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
        const now = new WeakSet<Fiber>();
        const stack: Fiber[] = root.current.child ? [root.current.child] : [];
        while (stack.length) {
          const f = stack.pop()!;
          now.add(f);
          const p = f.memoizedProps;
          const id = p?.element?.id ?? p?.arrow?.id ?? p?.item?.id;
          if (id !== undefined && !before.has(f) && (f.flags & 1) !== 0 && w.__renders) {
            w.__renders.ids.add(id);
            w.__renders.views++;
          }
          if (f.sibling) stack.push(f.sibling);
          if (f.child) stack.push(f.child);
        }
        before = now;
      },
    };
  });
};

/** Starts a Chromium trace of the page (with JS stacks on forced style and layout), to name what a long task is;
 *  `invalidations` adds why each node was restyled. Stop it with `browser.stopTracing()`. */
export async function startProbeTrace(
  browser: Browser,
  page: Page,
  path: string,
  invalidations = false,
): Promise<void> {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  await browser.startTracing(page, {
    path,
    categories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.stack',
      ...(invalidations ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []),
      'blink',
      'cc',
      // JS samples in the trace, so a long task's functions can be named by its time window.
      'disabled-by-default-v8.cpu_profiler',
    ],
  });
}

/** Starts V8's sampling profiler on the page (through its CDP session), to name the functions a long task spends its
 *  time in. */
export async function startCpuProfile(cdp: CDPSession): Promise<void> {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
}

/** Stops the profiler, writes the profile to `path` (it opens in DevTools' Performance panel) and returns the `top`
 *  functions by self time, as `ms name url:line:column`. */
export async function stopCpuProfile(cdp: CDPSession, path: string, top = 25): Promise<string[]> {
  const { profile } = await cdp.send('Profiler.stop');
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  writeFileSync(path, JSON.stringify(profile));
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<string, number>();
  const { samples = [], timeDeltas = [] } = profile;
  samples.forEach((id, i) => {
    const f = byId.get(id)!.callFrame;
    const key = `${f.functionName || '(anonymous)'} ${f.url.slice(f.url.lastIndexOf('/') + 1)}:${f.lineNumber + 1}:${f.columnNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (timeDeltas[i + 1] ?? 0) / 1000);
  });
  return [...self]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([key, ms]) => `${ms.toFixed(1).padStart(7)} ${key}`);
}
