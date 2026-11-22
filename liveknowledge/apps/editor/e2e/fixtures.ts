import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import type { StoredDocument, StoredTab } from './stored';
import { DEBUG_STORAGE_KEY } from '../lib/workbench-keys';

// Shared fixture (docs/specs/003-system-architecture/e2e-smoke.md): every smoke test fails on an uncaught
// exception or unhandled rejection surfaced to the page — the class the
// "maximum update depth" pan-loop bug was in, which the per-test UI
// checks merely exercise. `pageErrors` collects them; assert it stays
// empty (directly, or via expectNoPageErrors in an afterEach-style
// check at the end of a test).
//
// Deliberately narrow: we listen to `pageerror` (real uncaught
// throws / rejections) and `console.error`. Expected-benign noise —
// a favicon 404, React's dev double-invoke notices — is filtered so a
// green run means "no real error", not "no output".
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  /favicon/i,
  /manifest\.webmanifest/i,
  // Next.js dev-only HMR / fast-refresh chatter (absent from the CI
  // production build, present when reusing a local `pnpm dev`).
  /\[Fast Refresh\]/i,
  /Download the React DevTools/i,
  // Chromium logs every non-2xx fetch/XHR to the console as a generic
  // "Failed to load resource" line — browser chrome, not app logic,
  // and never carries the URL. Expected app flows probe endpoints that
  // 404 (a fresh guest's participant is looked-up-then-created). Real
  // failures surface as uncaught throws via `pageerror`, which we do
  // catch; this generic line is noise.
  /Failed to load resource/i,
];

function isIgnored(text: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(text));
}

// The editor's debug flag (docs/specs/003-system-architecture/console-logging.md): the suite drives
// the production build, which writes its trace lines only with it set, and specs wait for some of
// them (`[arrow-rebind] trigger`). Set before any page of the context loads.
export async function enableDebugLogs(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ([key]) => {
      try {
        localStorage.setItem(key, '*');
      } catch {
        // A page with no storage (about:blank, a sandboxed frame) has no trace lines to show.
      }
    },
    [DEBUG_STORAGE_KEY] as const,
  );
}

// The Get Started tours (docs/specs/007-editor/knowledge-tours.md) put a Get Started button in the footer while any is
// untaken; they have their own unit tests. Marked taken for every page of the context, so the footer is as specs expect.
export async function markModeToursSeen(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const key = 'liveknowledge:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (prefs.knowledgeToursSeen === undefined)
        localStorage.setItem(key, JSON.stringify({ ...prefs, knowledgeToursSeen: true }));
    } catch {
      // No storage: nothing to mark.
    }
  });
}

// Signed-in and workbench runs sign their pages in (signed-in/session.ts, the workbench pairing): no guest for them.
const PAGES_SIGN_IN = process.env.E2E_SIGNED_IN === '1' || process.env.E2E_WORKBENCH === '1';

export const test = base.extend<{ pageErrors: string[]; freshVisitor: boolean }>({
  // A test of the first visit itself opts out of holdMintedGuest (docs/specs/003-system-architecture/e2e-smoke.md
  // "Every test opens as a returning guest"); e2e/guest-first.test.ts keeps it to that one test.
  freshVisitor: [false, { option: true }],
  context: async ({ context, freshVisitor }, use) => {
    await enableDebugLogs(context);
    await markModeToursSeen(context);
    if (!freshVisitor && !PAGES_SIGN_IN) await holdMintedGuest(context);
    await use(context);
  },
  pageErrors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      const text = `${err.name}: ${err.message}`;
      if (!isIgnored(text)) errors.push(text);
    });
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (!isIgnored(text)) errors.push(text);
    });
    await use(errors);
  },
});

export { expect };

// Assert the collected errors are empty with a readable failure that
// names what leaked.
export function expectNoPageErrors(pageErrors: string[]): void {
  expect(pageErrors, `unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
}

// The app is a static export: its buttons are in the HTML before React attaches their handlers, and a click in that
// gap does nothing, more often the busier the machine. React tags every element it has hydrated with a
// `__reactProps$` key; wait for it on the element about to be used.
export async function untilHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith('__reactProps$'))),
    )
    .toBe(true);
}

// Tours never start or offer themselves (docs/specs/007-editor/knowledge-tours.md "Where it appears": the footer's
// Get Started button is the one way in), so there is nothing to dismiss: kept so the specs that call it need not change.
export async function dismissQuickTour(_page: Page): Promise<void> {}

// A blank document straight away: /new?blank=1, the document Start Blank links to
// (docs/specs/007-editor/new-document-route.md). Its one page is still unchosen, asking What Is This Page For?
// (docs/specs/007-editor/pages-mode.md "Page kinds"): right for a spec that seeds its own elements. `url` is a
// `serverNewUrl` one for a document on liveknowledge.
export async function openStartBlank(page: Page, url = '/new?blank=1'): Promise<void> {
  await page.goto(url);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
}

// A point on the first page as a fraction of its width and height (0..1), relative to the canvas: what a canvas
// click's `position` takes. Elements are placed only on a page, which sits small in the middle of a blank tab.
export async function onPage(
  page: Page,
  fx: number,
  fy: number,
): Promise<{ x: number; y: number }> {
  const sheet = await settledBox(page.locator('[data-page-id]').first());
  const canvas = (await page.locator('[data-canvas-a11y-root]').boundingBox())!;
  return {
    x: Math.round(sheet.x + sheet.width * fx - canvas.x),
    y: Math.round(sheet.y + sheet.height * fy - canvas.y),
  };
}

// A blank document with its start closed: the same /new?blank=1 (kept as its own name for the specs that read as
// "start a blank document"), on liveknowledge (serverNewUrl) so seedTab can write it through the api.
export async function startBlankDocument(page: Page): Promise<void> {
  await openStartBlank(page, await serverNewUrl(page, '/new?blank=1'));
}

// A /new address that makes the document on liveknowledge. A guest's own /new makes it Offline
// (docs/specs/006-document/save-locations.md "The default depends on who is creating"), but a `?folder=` context
// names a place on the server, so /new makes it there whoever is creating. The page becomes a minted guest (its token
// where the app keeps it, so /new never leaves for the guest handoff), or keeps the account it is signed in as
// (adoptAccount), and the folder is one of theirs, made at the index. For a spec that writes the document through the api (seedTab), watches the api's saves, or shares it.
// One guest per page, so a spec that makes a second document (or comes back to the first) stays its owner.
const serverGuests = new WeakMap<Page, string>();

export async function serverNewUrl(page: Page, url = '/new'): Promise<string> {
  let owner = serverGuests.get(page);
  if (!owner) {
    owner = await mintGuest(page.request);
    await adoptGuest(page, owner);
    serverGuests.set(page, owner);
  }
  const res = await page.request.post('/api/index/folders', {
    headers: ownerHeaders(owner),
    data: { name: 'e2e' },
  });
  expect(res.ok(), `folder create: ${res.status()}`).toBe(true);
  const { folder } = (await res.json()) as { folder: { id: string } };
  const at = new URL(url, 'http://e2e.invalid');
  at.searchParams.set('folder', folder.id);
  return `${at.pathname}${at.search}`;
}

export type Seed = Record<string, unknown>[];

// Write the seed into the new document's first tab through the api, then open the document again. The editor is
// closed first and its last write waited out: a new knowledgebase opens Start Here in edit mode, and a save of that
// page landing after the seed wrote the tab back without it (CI, under load).
export async function seedTab(page: Page, elements: Seed): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  const address = page.url();
  const id = new URL(address).pathname.split('/').filter(Boolean).pop()!;
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' }, id);
  await page.goto('about:blank');
  const read = async (): Promise<{ tabId: string; tab: StoredTab['tab'] | null }> => {
    const doc = await page.request.get(`${apiBase}/documents/${id}`, { headers });
    const tabId = doc.ok()
      ? (((await doc.json()) as StoredDocument).document?.tabs?.[0]?.id ?? '')
      : '';
    if (!tabId) return { tabId, tab: null };
    const got = await page.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, { headers });
    return { tabId, tab: got.ok() ? (((await got.json()) as StoredTab).tab ?? null) : null };
  };
  // The first tab saved, and no write still on its way: the same tab read twice, half a second apart.
  let last = '';
  let seen: { tabId: string; tab: StoredTab['tab'] | null } = { tabId: '', tab: null };
  await expect
    .poll(
      async () => {
        seen = await read();
        const now = JSON.stringify(seen.tab);
        const settled = seen.tab !== null && now === last;
        last = now;
        return settled;
      },
      { message: 'the new document saved its first tab', timeout: 15_000, intervals: [500] },
    )
    .toBe(true);
  const res = await page.request.put(`${apiBase}/documents/${id}/tabs/${seen.tabId}`, {
    headers,
    data: { ...seen.tab, elements },
  });
  expect(res.ok(), `seeding: ${res.status()}`).toBe(true);
  await page.goto(address);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
  // The seeded elements pop in (a short scale animation) after the canvas mounts: a test that
  // measures or drags one before it settles works from a box that is still changing.
  const first = elements.find((el) => typeof el.id === 'string');
  if (first) await settledBox(page.locator(`[data-element-id="${String(first.id)}"]`).first());
}

// A guest as production makes one: a guest token from liveworkspace (liveworkspace/docs/specs/003-accounts/accounts.md "Guests"), here
// from the e2e stack's accounts stand-in (scripts/e2e-stack.mjs, /e2e/guest-token). Answers the guest id
// (`guest_<uuid>`); ownerHeaders sends its token.
const guestTokens = new Map<string, string>();

export async function mintGuest(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.get('/e2e/guest-token');
  expect(res.ok()).toBe(true);
  const { token, guestId } = (await res.json()) as { token: string; guestId: string };
  guestTokens.set(guestId, token);
  return guestId;
}

// The page (or every page of a context) opens as this guest: its token is where the app keeps it.
export async function adoptGuest(target: Page | BrowserContext, owner: string): Promise<void> {
  const token = guestTokens.get(owner);
  if (!token) throw new Error(`no guest token for ${owner}: mint it with mintGuest`);
  await target.addInitScript((t) => {
    try {
      localStorage.setItem('liveknowledge:v2:guest-token', t);
    } catch {
      // A page with no storage keeps none.
    }
  }, token);
}

// Every test's context opens as a returning guest (docs/specs/003-system-architecture/e2e-smoke.md "Every test opens as
// a returning guest"): a browser with no token leaves /new, the Explorer and the canvas for the guest handoff and comes
// back, and a check that lands during that round trip loses its page ("Execution context was destroyed"). Kept only
// while the page holds no token, so a spec's own adoptGuest wins whichever init script runs first.
async function holdMintedGuest(context: BrowserContext): Promise<void> {
  const owner = await mintGuest(context.request);
  await context.addInitScript((t) => {
    try {
      if (!localStorage.getItem('liveknowledge:v2:guest-token'))
        localStorage.setItem('liveknowledge:v2:guest-token', t);
    } catch {
      // A page with no storage keeps none.
    }
  }, guestTokens.get(owner));
}

// The page opens signed in as this account (signed-in/session.ts installSession puts the session where the app reads
// it): serverNewUrl then makes its folder as the account, never as a guest it would mint, so the document is the
// account's, on the server, rather than a guest's.
export function adoptAccount(page: Page, userId: string, token: string): void {
  guestTokens.set(userId, token);
  serverGuests.set(page, userId);
}

export function ownerHeaders(
  owner: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = guestTokens.get(owner);
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

// The index's grant on a document for whoever `headers` names (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants"):
// every api request about one document carries it as X-Index-Grant.
export async function documentGrant(
  request: import('@playwright/test').APIRequestContext,
  headers: Record<string, string>,
  documentId: string,
): Promise<string> {
  const res = await request.post(`/api/index/items/${encodeURIComponent(documentId)}/grant`, {
    headers,
  });
  expect(res.ok(), `grant on ${documentId}: ${res.status()}`).toBe(true);
  return ((await res.json()) as { grant: string }).grant;
}

// ownerHeaders plus the grant on one document.
export async function documentHeaders(
  request: import('@playwright/test').APIRequestContext,
  owner: string,
  documentId: string,
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers = ownerHeaders(owner);
  return {
    ...headers,
    'X-Index-Grant': await documentGrant(request, headers, documentId),
    ...extra,
  };
}

// A document made as the app makes one: the item at the index first, then its content with the grant the create
// answers (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Items"). `data` is the api's create body ({ id, name,
// tabs, ... }). Answers the content create's response.
export async function seedDocumentItem(
  request: import('@playwright/test').APIRequestContext,
  owner: string | Record<string, string>,
  data: { id: string; name: string } & Record<string, unknown>,
): Promise<import('@playwright/test').APIResponse> {
  const headers = typeof owner === 'string' ? ownerHeaders(owner) : owner;
  const made = await request.post('/api/index/items', {
    headers,
    data: { id: data.id, app: 'liveknowledge', title: data.name },
  });
  expect(made.ok(), `index create: ${made.status()}`).toBe(true);
  const { grant } = (await made.json()) as { grant: { grant: string } };
  return request.post('/api/documents', {
    headers: { ...headers, 'X-Index-Grant': grant.grant, 'Content-Type': 'application/json' },
    data,
  });
}

// The page's OWN guest identity as request headers, for api calls a spec makes from inside the page
// (`page.evaluate`, which cannot import this module): its guest token, and with `documentId` the grant on that document.
// Read once, before the evaluate, and passed in as an argument.
export async function pageOwnerHeaders(
  page: Page,
  extra: Record<string, string> = {},
  documentId?: string,
): Promise<Record<string, string>> {
  const token = await page.evaluate(
    () => localStorage.getItem('liveknowledge:v2:guest-token') ?? '',
  );
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (documentId) headers['X-Index-Grant'] = await documentGrant(page.request, headers, documentId);
  return { ...headers, ...extra };
}

// A box once it has stopped moving: a surface that pops in (the `pop-in` scale animation) reports a
// smaller, then overshooting, box until it settles, so one measurement mid-animation, or two from
// different frames, misplaces its edges.
export async function settledBox(
  locator: Locator,
): Promise<{ x: number; y: number; width: number; height: number }> {
  let last = '';
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect
    .poll(async () => {
      box = await locator.boundingBox();
      const now = JSON.stringify(box);
      const still = box !== null && now === last;
      last = now;
      return still;
    })
    .toBe(true);
  return box!;
}
