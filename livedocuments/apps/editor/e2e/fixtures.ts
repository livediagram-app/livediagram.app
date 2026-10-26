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

// The Pages and element tours (docs/specs/007-editor/pages-tour.md) offer themselves 800 ms into a tab and their
// overlays would take the presses of every spec there; they have their own unit tests. Marked seen for every page of
// the context.
export async function markModeToursSeen(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const key = 'livedocuments:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      // The Pages tour offers each page kind once (lib/tour-tracks.ts): every kind answered.
      if (!Array.isArray(prefs.pagesTourKinds) || !Array.isArray(prefs.elementTourKinds))
        localStorage.setItem(
          key,
          JSON.stringify({
            ...prefs,
            pagesTourSeen: true,
            pagesTourKinds: ['slide', 'infographic', 'article'],
            // Element tours (docs/specs/007-editor/element-tours.md): the offer beside a Sankey's toolbar.
            elementTourKinds: [
              'sankey',
              'layer-stack',
              'pyramid',
              'funnel',
              'cycle',
              'hub',
              'onion',
              'chevrons',
              'chart',
              'stack',
              'tab-window',
            ],
          }),
        );
    } catch {
      // No storage: nothing to mark.
    }
  });
}

export const test = base.extend<{ pageErrors: string[] }>({
  context: async ({ context }, use) => {
    await enableDebugLogs(context);
    await markModeToursSeen(context);
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

/**
 * Opens a focused control's context menu from the keyboard. Chromium turns Shift+F10 into a `contextmenu` event on
 * Windows and Linux only: macOS has no such key (VoiceOver's VO+Shift+M sends the event itself), so there the test
 * sends the event the platform would.
 */
export async function openContextMenuFromKeyboard(target: Locator): Promise<void> {
  await target.focus();
  if (process.platform === 'darwin') await target.dispatchEvent('contextmenu');
  else await target.page().keyboard.press('Shift+F10');
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

// `/new` makes a document as it mounts and opens it on its start, Start Making Pages
// (docs/specs/007-editor/new-document-route.md). Resolves to the new document's id once the editor is up; `url`
// carries a `/new?folder=` / `?team=` / `?blank=1` context. A guest's plain `/new` makes it in This Browser;
// `serverNewUrl` makes it on livedocuments.
export async function createDocument(page: Page, url = '/new'): Promise<string> {
  await page.goto(url);
  await page.waitForURL(/\/document\//, { timeout: 30_000 });
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  return new URL(page.url()).pathname.split('/').pop()!;
}

// Tours never start or offer themselves (docs/specs/007-editor/pages-tour.md "Where it appears": the footer's
// Start Tour button is the one way in), so there is nothing to dismiss: kept so the specs that call it need not change.
export async function dismissQuickTour(_page: Page): Promise<void> {}

// A blank document straight away: /new?blank=1, the document Start Blank links to
// (docs/specs/007-editor/new-document-route.md). Its one page is still unchosen, asking What Is This Page For?
// (docs/specs/007-editor/pages-mode.md "Page kinds"): right for a spec that seeds its own elements. `url` is a
// `serverNewUrl` one for a document on livedocuments.
export async function openStartBlank(page: Page, url = '/new?blank=1'): Promise<void> {
  await page.goto(url);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
}

// A blank document on livedocuments whose page is chosen as an Infographic, so the page's choice is put away and the
// page takes elements: for a spec that places elements by hand (onPage). On the server, because the choice's own
// autosave is what it waits for, and a spec's seedTab writes after it.
export async function openBlankPage(page: Page): Promise<void> {
  await openStartBlank(page, await serverNewUrl(page, '/new?blank=1'));
  const choice = page.locator('[data-first-page-choice]');
  const infographic = choice.getByRole('button', { name: /^Infographic/ });
  await untilHydrated(infographic);
  // The choice is an edit: wait for its autosave, or a spec's own write (seedTab) races it and loses.
  const saved = page.waitForResponse(
    (r) => r.request().method() === 'PUT' && /\/api\/documents\/[^/]+\/tabs\//.test(r.url()),
  );
  await infographic.click();
  await choice.waitFor({ state: 'detached' });
  await saved;
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
// "start a blank document"), on livedocuments (serverNewUrl) so seedTab can write it through the api.
export async function startBlankDocument(page: Page): Promise<void> {
  await openStartBlank(page, await serverNewUrl(page, '/new?blank=1'));
}

// A /new address that makes the document on livedocuments. A guest's own /new makes it in This Browser
// (docs/specs/006-document/save-locations.md "The default depends on who is creating"), but a `?folder=` context
// names a place on the server, so /new makes it there whoever is creating. The page becomes a minted guest (its token
// where the app keeps it, so /new never leaves for the guest handoff) and the folder is one of theirs, made at the
// index. For a spec that writes the document through the api (seedTab), watches the api's saves, or shares it.
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

// Write the seed into the new document's first tab through the api, reload.
export async function seedTab(page: Page, elements: Seed): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  const documentId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' }, documentId);
  await page.evaluate(
    async ({ base, elements, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      let tab: Record<string, unknown> | null = null;
      let tabId = '';
      for (let i = 0; i < 50 && !tab; i += 1) {
        const liveDoc = (await (
          await fetch(`${base}/documents/${id}`, { headers })
        ).json()) as StoredDocument;
        tabId = liveDoc.document?.tabs?.[0]?.id ?? '';
        if (tabId) {
          const got = (await (
            await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })
          ).json()) as StoredTab;
          tab = got.tab ?? null;
        }
        if (!tab) await new Promise((r) => setTimeout(r, 100));
      }
      if (!tab) throw new Error('the new document never saved its first tab');
      const res = await fetch(`${base}/documents/${id}/tabs/${tabId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ...tab, elements }),
      });
      if (!res.ok) throw new Error(`seeding failed: ${res.status}`);
    },
    { base: apiBase, elements, headers },
  );
  await page.reload();
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

export function guestTokenFor(owner: string): string | null {
  return guestTokens.get(owner) ?? null;
}

// The page (or every page of a context) opens as this guest: its token is where the app keeps it.
export async function adoptGuest(target: Page | BrowserContext, owner: string): Promise<void> {
  const token = guestTokens.get(owner);
  if (!token) throw new Error(`no guest token for ${owner}: mint it with mintGuest`);
  await target.addInitScript((t) => {
    try {
      localStorage.setItem('livedocuments:v2:guest-token', t);
    } catch {
      // A page with no storage keeps none.
    }
  }, token);
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
    data: { id: data.id, app: 'livedocuments', title: data.name },
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
    () => localStorage.getItem('livedocuments:v2:guest-token') ?? '',
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

/** A palette tile, from its category's flyout on the category bar (docs/specs/007-editor/toolbar-layout.md "The
 *  category bar"): opens the category (a press, so it stays open whatever the pointer does next) unless its flyout is
 *  already showing, and returns the tile. */
export async function paletteTile(page: Page, name: string, category = 'Shapes'): Promise<Locator> {
  const flyout = page.locator('[data-category-flyout]');
  const button = page.locator(`[data-category-bar-button][aria-label="${category}"]`);
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  const tile = flyout.getByRole('button', { name, exact: true }).first();
  await tile.waitFor();
  return tile;
}
