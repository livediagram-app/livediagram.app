import type { BrowserContext, Page } from '@playwright/test';
import { adoptGuest, expect, mintGuest, ownerHeaders, test } from '../fixtures';

// The warm open measured (docs/specs/006-project/blueprints/last-seen-copy.md "Measured on production builds"): the
// same server-stored plan, a Kanban board of cards as its first tab, opened cold (no last seen copy in this browser,
// the open as it was before Work Tracker 927) and warm (the copy the previous open kept), as a guest at the plan's own
// address, with the network held at a realistic latency. Each open is a fresh navigation in one browser context, so
// the app's files come from the HTTP cache in both, as they do for a returning person; the only difference is the copy.
//
// Run against the production export with the stack up on it:
//   E2E_PERF=1 E2E_BASE_URL=http://localhost:<editor port> pnpm exec playwright test --project=perf warm-open
// WARM_OPEN_RUNS sets the runs per mode (default 12). It reports and never fails on a number.

const RUNS = Number(process.env.WARM_OPEN_RUNS ?? 12);
// A realistic connection: 100 ms round trip, 10 Mbps down, 5 Mbps up (every request, the api's included).
const NETWORK = {
  offline: false,
  latency: 100,
  downloadThroughput: (10 * 1024 * 1024) / 8,
  uploadThroughput: (5 * 1024 * 1024) / 8,
};
const LAST_SEEN_DB = 'liveplanner-last-seen';

type Mode = 'cold' | 'warm';
type Run = { mode: Mode; paint: number; interactive: number };

// Before any page script: the first frame with a card on screen, on the performance clock.
function watchFirstPaint(): void {
  const w = window as unknown as { __warmOpen: { paint: number | null } };
  w.__warmOpen = { paint: null };
  const tick = () => {
    if (w.__warmOpen.paint === null && document.querySelector('[data-plan-card]')) {
      w.__warmOpen.paint = performance.now();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// The copy the last open kept, with its cards (the follow writes them once the board's first load landed).
async function cardsKept(page: Page): Promise<boolean> {
  return page.evaluate(async (name) => {
    if (!(await indexedDB.databases()).some((d) => d.name === name)) return false;
    return new Promise<boolean>((resolve) => {
      const open = indexedDB.open(name);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('copies')) return resolve(false);
        const all = db.transaction('copies').objectStore('copies').getAll();
        all.onsuccess = () => {
          const bodies = (all.result as { body?: string }[]).map((r) => r.body ?? '');
          resolve(bodies.some((b) => b.includes('"cards":{')));
          db.close();
        };
      };
      open.onerror = () => resolve(false);
    });
  }, LAST_SEEN_DB);
}

// A cold open: no copy in this browser. Deleted from a page with no editor holding the database open.
async function forgetCopies(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  await page.goto('/icon.svg');
  await page.evaluate(
    (name) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
    LAST_SEEN_DB,
  );
  await page.close();
}

// One open: the first frame with a card on screen, and when the plan could be edited (the catch-up's mark on a warm
// open; a cold open paints its cards only once it has loaded, so the two are the same frame).
async function openOnce(context: BrowserContext, url: string, mode: Mode): Promise<Run> {
  if (mode === 'cold') await forgetCopies(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await page.goto(url);
  const read = () =>
    page.evaluate(() => {
      const w = window as unknown as { __warmOpen: { paint: number | null } };
      const end = (name: string) => {
        const m = performance.getEntriesByName(name, 'measure')[0];
        return m ? m.startTime + m.duration : null;
      };
      return {
        paint: w.__warmOpen.paint,
        warmPaint: end('warm-paint'),
        catchUp: end('warm-catch-up'),
      };
    });
  await expect
    .poll(async () => {
      const r = await read();
      return r.paint !== null && (mode === 'cold' || r.catchUp !== null);
    })
    .toBe(true);
  const r = await read();
  // The open took the path it was meant to: a warm open painted the copy, a cold one did not.
  expect(r.warmPaint !== null, `${mode} open's warm-paint mark`).toBe(mode === 'warm');
  // The next open's copy, its cards included.
  await expect.poll(() => cardsKept(page), { timeout: 15_000 }).toBe(true);
  await page.close();
  return { mode, paint: r.paint!, interactive: mode === 'warm' ? r.catchUp! : r.paint! };
}

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!);
};

test.describe.configure({ mode: 'serial' });

test('warm open against cold, a guest at a Kanban plan of their own', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(30 * 60_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(watchFirstPaint);
  const owner = await mintGuest(context.request);
  await adoptGuest(context, owner);
  // A plan on liveplanner (a folder names a place on the server, fixtures.ts serverNewUrl): Kanban, a board of cards.
  const folder = await context.request.post('/api/index/folders', {
    headers: ownerHeaders(owner),
    data: { name: 'perf' },
  });
  expect(folder.ok(), `folder create: ${folder.status()}`).toBe(true);
  const { folder: made } = (await folder.json()) as { folder: { id: string } };
  const first = await context.newPage();
  await first.goto(`/new?template=kanban&folder=${made.id}`);
  await first.waitForURL(/\/project\/[^/?#]+/, { timeout: 30_000 });
  await first.locator('[data-plan-card]').first().waitFor({ timeout: 30_000 });
  const url = new URL(first.url()).pathname;
  await first.close();

  // The first open fills the HTTP cache and keeps the copy; it is not counted.
  await openOnce(context, url, 'cold');
  const runs: Run[] = [];
  // Interleaved, so drift on a shared machine reaches both modes alike.
  for (let i = 0; i < RUNS; i++) {
    runs.push(await openOnce(context, url, 'cold'));
    runs.push(await openOnce(context, url, 'warm'));
  }
  const results: Record<string, unknown> = {};
  for (const mode of ['cold', 'warm'] as const) {
    const of = runs.filter((r) => r.mode === mode);
    results[mode] = {
      runs: of.length,
      paintMedian: percentile(
        of.map((r) => r.paint),
        0.5,
      ),
      paintP90: percentile(
        of.map((r) => r.paint),
        0.9,
      ),
      interactiveMedian: percentile(
        of.map((r) => r.interactive),
        0.5,
      ),
      interactiveP90: percentile(
        of.map((r) => r.interactive),
        0.9,
      ),
    };
  }
  await context.close();
  const report = JSON.stringify({ runs: RUNS, network: NETWORK, results }, null, 2);
  console.log(`[warm-open] ${report}`);
  await test.info().attach('warm-open.json', { body: report, contentType: 'application/json' });
});
