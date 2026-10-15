import { mkdirSync, writeFileSync } from 'node:fs';
import { firefox, webkit, type Browser, type CDPSession, type Page } from '@playwright/test';
import { expect, guestSigFor, mintSignedGuest, ownerHeaders, test } from '../fixtures';
import { benchmarkInPage, calibratedThrottle } from './calibrate';
import { buildReferenceBoard } from './reference-board';
import { mainThreadTasks, type TraceEvent } from './trace-tasks';

// The slide-transition probe (docs/specs/012-collaboration/presentation-mode.md "Motion"): a deck of small
// (1-element) and large (100-element) slides, moved through with Slide and Fade, the CPU slowed to the
// canvas probe's reference speed. Per move it reads the main thread (trace), the frame gaps (rAF), the
// key's input-to-paint (Event Timing) and what the move leaves behind (stray snapshots, DOM, heap).
// It reports and never judges; SLIDE_VARIANT names the build under test in the report.
// Run with `E2E_PERF=1 pnpm --filter @livediagram/live exec playwright test --project=perf slide-transition`.

const OUT = 'test-results/perf';
const CATEGORIES = 'devtools.timeline,disabled-by-default-devtools.timeline';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const VARIANT = process.env.SLIDE_VARIANT ?? 'current';
const VIEW = { width: 1440, height: 900 };
const CANVAS = '[data-canvas-a11y-root]';
const SLIDE_SIZE = { small: 1, large: 100 } as const;
const SLIDES_PER_DECK = 6;
// Normal speed (lib/presentation-config.ts SLIDE_SPEEDS) plus room for the move to settle.
const MOVE_SETTLE_MS = 380 + 400;
const RAPID_GAP_MS = 80;
// One throttle for every variant, so two builds measured at different times compare (SLIDE_THROTTLE).
const FIXED_THROTTLE = Number(process.env.SLIDE_THROTTLE ?? 0);
// Seven moves a row, forward and back, read as medians: one move swings too much to compare on.
const MOVES = [
  'ArrowRight',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
];

type Size = keyof typeof SLIDE_SIZE;
type Transition = 'slide' | 'fade';

type MoveReading = {
  mainThreadMs: number;
  longestTaskMs: number;
  maxFrameGapMs: number;
  framesOver25Ms: number;
  keyToPaintMs: number | null;
};

async function seedDeck(page: Page, baseURL: string, owner: string, size: Size): Promise<string> {
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const per = SLIDE_SIZE[size];
  // Shapes only, and enough of them that every slide is full (the reference board mixes in arrows and text).
  const board = buildReferenceBoard(1, per * SLIDES_PER_DECK * 3)
    .filter((el) => el.type === 'shape')
    .slice(0, per * SLIDES_PER_DECK);
  expect(board.length, 'a full deck of shapes').toBe(per * SLIDES_PER_DECK);
  const slides = Array.from({ length: SLIDES_PER_DECK }, (_, i) => ({
    id: `s${i}`,
    tabId,
    elementIds: board.slice(i * per, (i + 1) * per).map((el) => el.id),
  })).filter((s) => s.elementIds.length > 0);
  const res = await page.request.post(`${apiBase}/documents`, {
    headers: ownerHeaders(owner, { Origin: new URL(baseURL).origin }),
    data: {
      id,
      name: `Slide probe (${size})`,
      tabs: [{ id: tabId, name: 'Slides', elements: board }],
      presentation: JSON.stringify({ decks: [{ slides }] }),
    },
  });
  expect(res.ok(), `seeding the ${size} deck`).toBe(true);
  return id;
}

async function openDeck(
  browser: Browser,
  owner: string,
  id: string,
  transition: Transition,
  throttle: number,
  reducedMotion: 'reduce' | 'no-preference' = 'no-preference',
) {
  const ctx = await browser.newContext({
    viewport: VIEW,
    colorScheme: 'dark',
    reducedMotion,
    baseURL: process.env.E2E_BASE_URL,
  });
  await ctx.addInitScript(
    ({ o, sig, transition }) => {
      localStorage.setItem('livediagram:v2:self-id', o);
      if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
      localStorage.setItem(
        'livediagram:v2:presentation-config',
        JSON.stringify({ transition, speed: 'normal', hidePointer: false, advanceOnClick: false }),
      );
      const w = window as unknown as { __keys: number[]; __errors: string[] };
      w.__keys = [];
      w.__errors = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (e.name === 'keydown') w.__keys.push(e.duration);
      }).observe({
        type: 'event',
        durationThreshold: 16,
        buffered: true,
      } as PerformanceObserverInit);
      addEventListener('error', (e) => w.__errors.push(String(e.message)));
      addEventListener('unhandledrejection', (e) => w.__errors.push(String(e.reason)));
    },
    { o: owner, sig: guestSigFor(owner), transition },
  );
  const page = await ctx.newPage();
  // Chromium only: the trace and the CPU throttle (throttle 0 is another engine, untraced).
  const cdp = throttle > 0 ? await ctx.newCDPSession(page) : null;
  await page.goto(`/document/${id}`);
  await page.locator(CANVAS).waitFor({ timeout: 60_000 });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Selection mode' }).click();
  await page.getByText('Slide Deck', { exact: true }).first().click();
  await page.getByRole('button', { name: /^Present(\s*\d+)?$/ }).click();
  await page.waitForTimeout(1500);
  await cdp?.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  return { ctx, page, cdp: cdp! };
}

async function traced(cdp: CDPSession, page: Page, run: () => Promise<void>) {
  const events: TraceEvent[] = [];
  const onData = (d: { value: object[] }) => events.push(...(d.value as TraceEvent[]));
  cdp.on('Tracing.dataCollected', onData);
  const done = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
  await cdp.send('Tracing.start', { categories: CATEGORIES, transferMode: 'ReportEvents' });
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __recording: boolean; __keys: number[] };
    w.__frames = [];
    w.__keys = [];
    w.__recording = true;
    let last = performance.now();
    const tick = (t: number) => {
      w.__frames.push(t - last);
      last = t;
      if (w.__recording) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await run();
  const { frames, keys } = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __recording: boolean; __keys: number[] };
    w.__recording = false;
    return { frames: w.__frames.slice(1), keys: w.__keys };
  });
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  return { tasks: mainThreadTasks(events), frames, keys };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const round = (n: number) => Math.round(n * 10) / 10;

function reading(t: { tasks: number[]; frames: number[]; keys: number[] }): MoveReading {
  return {
    mainThreadMs: round(sum(t.tasks)),
    longestTaskMs: round(Math.max(0, ...t.tasks)),
    maxFrameGapMs: round(Math.max(0, ...t.frames)),
    framesOver25Ms: t.frames.filter((f) => f > 25).length,
    keyToPaintMs: t.keys.length ? Math.max(...t.keys) : null,
  };
}

// The HUD's "n / total", or null when it is not drawn.
async function position(page: Page): Promise<string | null> {
  const hud = page.getByText(/^\s*\d+ \/ \d+\s*$/).first();
  return (await hud.count()) ? ((await hud.textContent())?.trim() ?? null) : null;
}

const med = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

function medianReading(ms: MoveReading[]) {
  const pick = (k: keyof MoveReading) => ms.map((m) => m[k] ?? 0) as number[];
  return {
    mainThreadMs: med(pick('mainThreadMs')),
    longestTaskMs: med(pick('longestTaskMs')),
    longestTaskMaxMs: Math.max(...pick('longestTaskMs')),
    maxFrameGapMs: med(pick('maxFrameGapMs')),
    framesOver25Ms: med(pick('framesOver25Ms')),
    keyToPaintMs: med(pick('keyToPaintMs')),
    keyToPaintMaxMs: Math.max(...pick('keyToPaintMs')),
  };
}

async function leftovers(page: Page) {
  return page.evaluate(() => ({
    ghosts: document.querySelectorAll('[data-slide-ghost]').length,
    domNodes: document.getElementsByTagName('*').length,
    heapMb:
      Math.round(
        ((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize ?? 0) / 1e5,
      ) / 10,
    errors: (window as unknown as { __errors: string[] }).__errors,
    animations: document
      .getAnimations()
      .map((a) => (a as CSSAnimation).animationName ?? a.constructor.name),
  }));
}

test('slide transitions, measured', async ({ page, browser, baseURL }) => {
  test.setTimeout(15 * 60_000);
  mkdirSync(`${OUT}/slide-shots`, { recursive: true });
  const benches: number[] = [];
  for (let i = 0; i < 5; i++) {
    const p = await browser.newPage();
    await p.goto('about:blank');
    benches.push(await p.evaluate(benchmarkInPage));
    await p.close();
  }
  const rate = FIXED_THROTTLE || calibratedThrottle(Math.min(...benches)).rate;
  const owner = await mintSignedGuest(page.request);
  const decks = {
    small: await seedDeck(page, baseURL!, owner, 'small'),
    large: await seedDeck(page, baseURL!, owner, 'large'),
  };

  const report: Record<string, unknown> = { variant: VARIANT, throttle: round(rate) };
  for (const size of ['small', 'large'] as const) {
    for (const transition of ['slide', 'fade'] as const) {
      const { ctx, page: p, cdp } = await openDeck(browser, owner, decks[size], transition, rate);
      const moves: MoveReading[] = [];
      for (const key of MOVES) {
        const t = await traced(cdp, p, async () => {
          await p.keyboard.press(key);
          await p.waitForTimeout(MOVE_SETTLE_MS);
        });
        moves.push(reading(t));
      }
      // Mid-move capture: is the outgoing slide drawn where it stood, and the incoming one framed?
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(190);
      await p.screenshot({ path: `${OUT}/slide-shots/${VARIANT}-${size}-${transition}-mid.png` });
      await p.waitForTimeout(MOVE_SETTLE_MS);
      // Rapid presses: each key's input-to-paint, and where the deck lands.
      const rapid = await traced(cdp, p, async () => {
        for (let i = 0; i < 3; i++) {
          await p.keyboard.press('ArrowRight');
          await p.waitForTimeout(RAPID_GAP_MS);
        }
        await p.waitForTimeout(MOVE_SETTLE_MS);
      });
      const rapidLanded = await position(p);
      // The screen changing size mid-move: fullscreen leaving under it.
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(120);
      await p.evaluate(() => document.fullscreenElement && document.exitFullscreen());
      await p.waitForTimeout(MOVE_SETTLE_MS);
      await p.screenshot({
        path: `${OUT}/slide-shots/${VARIANT}-${size}-${transition}-resized.png`,
      });
      report[`${size}/${transition}`] = {
        moves: medianReading(moves),
        rapid: { ...reading(rapid), keys: rapid.keys, landedOn: rapidLanded },
        after: await leftovers(p),
      };
      await ctx.close();
    }
  }
  // Reduced motion: what animates on a move.
  const { ctx, page: p } = await openDeck(browser, owner, decks.large, 'slide', 1, 'reduce');
  await p.keyboard.press('ArrowRight');
  await p.waitForTimeout(60);
  report['reduced-motion'] = await leftovers(p);
  await ctx.close();

  writeFileSync(`${OUT}/slide-transition-${VARIANT}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});

// The other engines (SLIDE_ENGINES=webkit,firefox): no trace there, only whether a move animates, lands on the
// right slide and leaves nothing behind or broken.
for (const engine of (process.env.SLIDE_ENGINES ?? '').split(',').filter(Boolean)) {
  test(`slide moves land in ${engine}`, async ({ page, baseURL }) => {
    test.setTimeout(3 * 60_000);
    const launcher = engine === 'webkit' ? webkit : firefox;
    const owner = await mintSignedGuest(page.request);
    const id = await seedDeck(page, baseURL!, owner, 'large');
    const other = await launcher.launch();
    const report: Record<string, unknown> = { variant: VARIANT, engine };
    for (const transition of ['slide', 'fade'] as const) {
      const { ctx, page: p } = await openDeck(other, owner, id, transition, 0);
      const animated: string[][] = [];
      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowLeft']) {
        await p.keyboard.press(key);
        await p.waitForTimeout(120);
        animated.push(
          await p.evaluate(() =>
            document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? 'script'),
          ),
        );
        await p.waitForTimeout(MOVE_SETTLE_MS);
      }
      for (let i = 0; i < 3; i++) {
        await p.keyboard.press('ArrowRight');
        await p.waitForTimeout(RAPID_GAP_MS);
      }
      await p.waitForTimeout(MOVE_SETTLE_MS);
      await p.screenshot({ path: `${OUT}/slide-shots/${VARIANT}-${engine}-${transition}.png` });
      report[transition] = {
        animated: animated.map((names) => [...new Set(names)]),
        landedOn: await position(p),
        after: await leftovers(p),
      };
      await ctx.close();
    }
    await other.close();
    writeFileSync(
      `${OUT}/slide-transition-${VARIANT}-${engine}.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  });
}

// Editing never starts a View Transition: only a slide move may (the canvas's boundary animates nothing else).
test('editing starts no view transitions', async ({ page, browser, baseURL }) => {
  mkdirSync(OUT, { recursive: true });
  const owner = await mintSignedGuest(page.request);
  const id = await seedDeck(page, baseURL!, owner, 'small');
  const ctx = await browser.newContext({ viewport: VIEW, colorScheme: 'dark', baseURL });
  await ctx.addInitScript(
    ({ o, sig }) => {
      localStorage.setItem('livediagram:v2:self-id', o);
      if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
      const w = window as unknown as { __vt: number };
      w.__vt = 0;
      const start = Document.prototype.startViewTransition;
      if (start)
        Document.prototype.startViewTransition = function (this: Document, ...args) {
          w.__vt++;
          return start.apply(this, args as never);
        } as typeof start;
    },
    { o: owner, sig: guestSigFor(owner) },
  );
  const p = await ctx.newPage();
  await p.goto(`/document/${id}`);
  await p.locator(CANVAS).waitFor({ timeout: 60_000 });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(1500);
  const before = await p.evaluate(() => (window as unknown as { __vt: number }).__vt);
  const shape = p.locator('[data-element-id]').first();
  await shape.click();
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press('ArrowRight');
    await p.waitForTimeout(100);
  }
  const box = await shape.boundingBox();
  if (box) {
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await p.mouse.down();
    for (let i = 0; i < 10; i++) await p.mouse.move(box.x + 20 * i, box.y + 10 * i);
    await p.mouse.up();
  }
  await p.waitForTimeout(1000);
  const after = await p.evaluate(() => (window as unknown as { __vt: number }).__vt);
  console.log(JSON.stringify({ variant: VARIANT, viewTransitionsWhileEditing: after - before }));
  writeFileSync(
    `${OUT}/slide-transition-${VARIANT}-editing.json`,
    JSON.stringify({ viewTransitionsWhileEditing: after - before }),
  );
  await ctx.close();
});
