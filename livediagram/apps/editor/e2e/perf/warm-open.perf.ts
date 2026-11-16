import type { Browser, BrowserContext, Page } from '@playwright/test';
import { E2E_SESSION_KEY } from '../../lib/workbench-keys';
import { expect, test } from '../fixtures';
import { buildReferenceBoard } from './reference-board';

// The warm open measured (docs/specs/006-document/blueprints/last-seen-copy.md "Measured on production builds"): the
// same server-stored document opened cold (no last seen copy in this browser) and warm (the copy the previous open
// kept), signed in at the document's own address and as a guest by an edit link's own address, with the network held
// at a realistic latency. Each open is a fresh navigation in one browser context, so the app's files come from the
// HTTP cache in both, as they do for a returning person; the only difference is the copy.
//
// Runs against the signed-in export (`.next/out-signed-in`, from build-signed-in.mjs), whose E2E auth bridge signs
// the account in from local storage. Run with the stack up on it:
//   E2E_PERF=1 E2E_BASE_URL=http://localhost:<editor port> pnpm exec playwright test --project=perf warm-open
// WARM_OPEN_RUNS sets the runs per mode (default 12). It reports and never fails on a number. Beside content and
// editable it reports how long after auth answered the ordinary load's first request (the participant) went out: the
// e2e auth bridge answers as it reads the test's session, so that read is when auth answered.

const RUNS = Number(process.env.WARM_OPEN_RUNS ?? 12);
// A realistic connection: 100 ms round trip, 10 Mbps down, 5 Mbps up (every request, the api's included).
const NETWORK = {
  offline: false,
  latency: 100,
  downloadThroughput: (10 * 1024 * 1024) / 8,
  uploadThroughput: (5 * 1024 * 1024) / 8,
};
const LAST_SEEN_DB = 'livediagram-last-seen';
// A board of the mix real boards have, small enough to be typical (the probe's 1,000 is the stress case).
const ELEMENTS = 200;

type Mode = 'cold' | 'warm';
type Run = {
  mode: Mode;
  paint: number;
  interactive: number;
  authAnswered: number | null;
  participantAfterAuth: number | null;
};

// Before any page script: the first frame with an element of the document on screen, on the performance clock.
function watchFirstPaint(): void {
  const w = window as unknown as { __warmOpen: { paint: number | null; far: number | null } };
  w.__warmOpen = { paint: null, far: null };
  const tick = () => {
    const now = performance.now();
    if (w.__warmOpen.paint === null && document.querySelector('[data-element-id]')) {
      w.__warmOpen.paint = now;
    }
    if (w.__warmOpen.far === null && document.querySelector('[data-element-id="far"]')) {
      w.__warmOpen.far = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// Before any page script: when auth answered, the e2e auth bridge's first read of the test's session.
function watchAuth(sessionKey: string): void {
  const w = window as unknown as { __authAnswered: number | null };
  w.__authAnswered = null;
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = function (key: string) {
    if (key === sessionKey && w.__authAnswered === null) w.__authAnswered = performance.now();
    return getItem.call(this, key);
  };
}

async function newContext(browser: Browser, baseURL: string): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(watchFirstPaint);
  await context.addInitScript(watchAuth, E2E_SESSION_KEY);
  await context.addInitScript(() => localStorage.setItem('livediagram:v2:name-confirmed', '1'));
  return context;
}

// The copy the last open kept is in this browser (the arrival keeps it without holding the load).
async function copyKept(page: Page): Promise<boolean> {
  return page.evaluate(async (name) => {
    if (!(await indexedDB.databases()).some((d) => d.name === name)) return false;
    return new Promise<boolean>((resolve) => {
      const open = indexedDB.open(name);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('copies')) return resolve(false);
        const count = db.transaction('copies').objectStore('copies').count();
        count.onsuccess = () => {
          resolve(count.result > 0);
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

// One open: the first frame with the document on screen, and when it could be edited (the catch-up's mark on a warm
// open; a cold open paints only once it has loaded, so the two are the same frame).
async function openOnce(context: BrowserContext, url: string, mode: Mode): Promise<Run> {
  if (mode === 'cold') await forgetCopies(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', NETWORK);
  await page.goto(url);
  const read = () =>
    page.evaluate(() => {
      const w = window as unknown as {
        __warmOpen: { paint: number | null };
        __authAnswered: number | null;
      };
      const end = (name: string) => {
        const m = performance.getEntriesByName(name, 'measure')[0];
        return m ? m.startTime + m.duration : null;
      };
      const participant = performance
        .getEntriesByType('resource')
        .find((e) => new URL(e.name).pathname.startsWith('/api/participants/'));
      return {
        paint: w.__warmOpen.paint,
        authAnswered: w.__authAnswered,
        participantAfterAuth:
          participant && w.__authAnswered !== null
            ? participant.startTime - w.__authAnswered
            : null,
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
  // The next open's copy: the one this open kept.
  await expect.poll(() => copyKept(page)).toBe(true);
  await page.close();
  return {
    mode,
    paint: r.paint!,
    interactive: mode === 'warm' ? r.catchUp! : r.paint!,
    authAnswered: r.authAnswered,
    participantAfterAuth: r.participantAfterAuth,
  };
}

const percentile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]!);
};

// A timing the runs may lack (no session read, or no participant request), at percentile `p`; null when none had it.
const percentileOf = (
  runs: Run[],
  key: 'authAnswered' | 'participantAfterAuth',
  p: number,
): number | null => {
  const values = runs.flatMap((r) => (r[key] === null ? [] : [r[key]]));
  return values.length ? percentile(values, p) : null;
};

async function measure(context: BrowserContext, url: string): Promise<Record<string, unknown>> {
  // The first open fills the HTTP cache and keeps the copy; it is not counted.
  await openOnce(context, url, 'cold');
  const runs: Run[] = [];
  // Interleaved, so drift on a shared machine reaches both modes alike.
  for (let i = 0; i < RUNS; i++) {
    runs.push(await openOnce(context, url, 'cold'));
    runs.push(await openOnce(context, url, 'warm'));
  }
  const summary: Record<string, unknown> = {};
  for (const mode of ['cold', 'warm'] as const) {
    const of = runs.filter((r) => r.mode === mode);
    summary[mode] = {
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
      // Work Tracker 960: auth answers as early warm as cold, and the participant request goes out within 50 ms of it.
      authAnsweredMedian: percentileOf(of, 'authAnswered', 0.5),
      authAnsweredP90: percentileOf(of, 'authAnswered', 0.9),
      participantAfterAuthMedian: percentileOf(of, 'participantAfterAuth', 0.5),
      participantAfterAuthP90: percentileOf(of, 'participantAfterAuth', 0.9),
    };
  }
  return summary;
}

async function seed(
  context: BrowserContext,
  baseURL: string,
  token: string,
): Promise<{ id: string; tabId: string; headers: Record<string, string> }> {
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const headers = { Authorization: `Bearer ${token}`, Origin: new URL(baseURL).origin };
  const made = await context.request.post('/api/index/items', {
    headers,
    data: { id, app: 'livediagram', title: 'Warm open' },
  });
  expect(made.ok(), `index create: ${made.status()}`).toBe(true);
  const { grant } = (await made.json()) as { grant: { grant: string } };
  const res = await context.request.post('/api/documents', {
    headers: { ...headers, 'X-Index-Grant': grant.grant },
    data: {
      id,
      name: 'Warm open',
      tabs: [
        { id: tabId, name: 'Board', elements: buildReferenceBoard(1, ELEMENTS) },
        { id: crypto.randomUUID(), name: 'Notes', elements: buildReferenceBoard(2, 40) },
        { id: crypto.randomUUID(), name: 'Later', elements: [] },
      ],
    },
  });
  expect(res.ok(), `document create: ${res.status()}`).toBe(true);
  return { id, tabId, headers: { ...headers, 'X-Index-Grant': grant.grant } };
}

async function guestToken(context: BrowserContext): Promise<string> {
  const res = await context.request.get('/e2e/guest-token');
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { token: string }).token;
}

async function asGuest(context: BrowserContext, token: string): Promise<void> {
  await context.addInitScript((t) => localStorage.setItem('livediagram:v2:guest-token', t), token);
}

test.describe.configure({ mode: 'serial' });

test('warm open against cold, signed in and as a guest by share link', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(30 * 60_000);
  const results: Record<string, unknown> = {};

  // Signed in: the account's own document at its own address.
  const account = await newContext(browser, baseURL!);
  const userId = `user_warm${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const tokenRes = await account.request.get(`/e2e/token?sub=${userId}&email=warm%40example.com`);
  expect(tokenRes.ok()).toBe(true);
  const token = await tokenRes.text();
  const session = JSON.stringify({
    token,
    userId,
    email: 'warm@example.com',
    firstName: 'Warm',
    lastName: 'Open',
  });
  await account.addInitScript(([k, v]) => localStorage.setItem(k, v), [
    E2E_SESSION_KEY,
    session,
  ] as const);
  // The readable signed-in hint the api sets beside the session: the warm open reads the account's copies by it.
  await account.addCookies([{ name: 'ld_signed_in', value: '1', url: baseURL! }]);
  const own = await seed(account, baseURL!, token);
  results.signedIn = await measure(account, `/document/${own.id}`);
  await account.close();

  // A guest by an edit link's own address (the address the Share dialog gives).
  const owner = await newContext(browser, baseURL!);
  const ownerToken = await guestToken(owner);
  const shared = await seed(owner, baseURL!, ownerToken);
  const share = await owner.request.post(`/api/documents/${shared.id}/share`, {
    headers: shared.headers,
    data: { role: 'edit' },
  });
  expect(share.ok(), `share: ${share.status()}`).toBe(true);
  const code = ((await share.json()) as { link: { code: string } }).link.code;
  const visitor = await newContext(browser, baseURL!);
  await asGuest(visitor, await guestToken(visitor));
  results.guestShareLink = await measure(visitor, `/document/shared?s=${code}`);
  await visitor.close();
  await owner.close();

  const report = JSON.stringify({ runs: RUNS, network: NETWORK, results }, null, 2);
  console.log(`[warm-open] ${report}`);
  await test.info().attach('warm-open.json', { body: report, contentType: 'application/json' });
});

// The verifier's check (offline-mode.md "The warm open", the fit): a copy whose first tab changed on the server since
// it was kept paints as kept, then the catch-up brings the change and fits the tab once, so what the copy lacked is on
// screen, and the view then stays where it is.
test('a copy whose content changed since it was kept refits once at catch-up', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(5 * 60_000);
  const context = await newContext(browser, baseURL!);
  const token = await guestToken(context);
  await asGuest(context, token);
  const doc = await seed(context, baseURL!, token);
  const url = `/document/${doc.id}`;
  await openOnce(context, url, 'cold');

  // The first tab moves on: a shape outside the area the copy fitted (the board spans 5,760 by 2,700), near enough that
  // a fit of both stays above the smallest zoom.
  const tabUrl = `/api/documents/${doc.id}/tabs/${doc.tabId}`;
  const { tab } = (await (await context.request.get(tabUrl, { headers: doc.headers })).json()) as {
    tab: { elements: { id: string; type: string; x?: number; y?: number }[] };
  };
  const shape = tab.elements.find((el) => el.type === 'shape')!;
  const put = await context.request.put(tabUrl, {
    headers: doc.headers,
    data: { ...tab, elements: [...tab.elements, { ...shape, id: 'far', x: 7000, y: 3600 }] },
  });
  expect(put.ok(), `tab put: ${put.status()}`).toBe(true);

  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // A slower line, so the warm paint is on screen a while before the catch-up lands.
  await cdp.send('Network.emulateNetworkConditions', { ...NETWORK, latency: 400 });
  await page.goto(url);
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName('warm-catch-up').length))
    .toBe(1);
  const marks = await page.evaluate(() => {
    const w = window as unknown as { __warmOpen: { paint: number; far: number | null } };
    return { paint: w.__warmOpen.paint, far: w.__warmOpen.far };
  });
  // The copy painted without the far shape; the catch-up brought it.
  expect(marks.far).not.toBeNull();
  expect(marks.far!).toBeGreaterThan(marks.paint);
  const far = page.locator('[data-canvas-a11y-root] [data-element-id="far"]').first();
  const boxAt = async () => far.boundingBox();
  // Fitted once: on screen, and the view still a second later (no second fit, no drift).
  await expect
    .poll(async () => {
      const b = await boxAt();
      return b !== null && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1440 && b.y + b.height <= 900;
    })
    .toBe(true);
  const settled = await boxAt();
  await page.waitForTimeout(1500);
  expect(await boxAt()).toEqual(settled);
  await context.close();
});
