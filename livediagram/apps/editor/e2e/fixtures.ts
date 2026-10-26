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
  // The photo-import e2e blocks model downloads (nothing may pull weights over
  // the wire in a test), so a blocked fetch surfaces as a pageerror there. That
  // is the setup working, not an app bug.
  /huggingface|onnxruntime|transformers/i,
];

function isIgnored(text: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((re) => re.test(text));
}

// The editor's debug flag (docs/specs/003-system-architecture/console-logging.md): the suite drives
// the production build, which writes its trace lines only with it set, and specs wait for some of
// them. Set before any page of the context loads.
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

// The Draw, Avatar and element tours (docs/specs/023-draw-mode/draw-tour.md, docs/specs/008-canvas/avatar-tour.md,
// docs/specs/007-editor/element-tours.md) offer themselves 800 ms into their modes and their overlays would take the presses of every spec there; they have
// their own unit tests. Marked seen for every page of the context.
async function markModeToursSeen(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const key = 'livediagram:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (
        prefs.drawTourSeen !== true ||
        prefs.avatarTourSeen !== true ||
        !Array.isArray(prefs.elementTourKinds)
      )
        localStorage.setItem(
          key,
          JSON.stringify({
            ...prefs,
            drawTourSeen: true,
            avatarTourSeen: true,
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
              'mind-node',
              'flowchart',
              'org-chart',
              'sequence',
              'chart',
              'stack',
              'entity',
              'lane',
              'boundary',
              'diagram-key',
              'portal',
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

// The wizard is a static export: its buttons are in the HTML before React attaches their handlers. A mode
// card clicked in that gap is kept and acted on at hydration (new-document-route.md "A choice before
// hydration"), but every other control's click in that gap does nothing, more often the busier the
// machine. React tags every element it has hydrated with a `__reactProps$` key; wait for it on the
// element about to be used.
export async function untilHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith('__reactProps$'))),
    )
    .toBe(true);
}

// The wizard asks only for a mode (docs/specs/007-editor/new-document-route.md "One-step wizard"): choosing one
// creates the document there and then, and lands on the editor with the mode's start screen over the canvas
// (docs/specs/007-editor/start-diagramming.md).
// Resolves to the new document's id; `url` carries a `/new?folder=` / `?team=` context. Without one the document is
// made on livediagram (serverNewUrl), so a spec can seed it, share it or watch its saves; pass `'/new'` for a guest's
// own create, which keeps it in This Browser.
export async function createInMode(page: Page, mode: string, url?: string): Promise<string> {
  await page.goto(url ?? (await serverNewUrl(page)));
  await page.getByText('New Canvas', { exact: false }).waitFor();
  const card = page.locator(`[data-new-mode="${mode}"]`);
  await untilHydrated(card);
  await card.click();
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  return new URL(page.url()).pathname.split('/').pop()!;
}

// The start screen over a new tab, by its mode's title (Start Diagramming, ...).
const startScreen = (page: Page, title: RegExp = /^Start /) =>
  page.getByRole('region', { name: title });

// Start a document from a named TEMPLATE in a named group of Start Diagramming: a Diagram document from the
// wizard, then the template picked on its start screen, so template creation (builders, layers, per-template
// canvas overrides, the tab kind) is its own path, as a person takes it.
export async function startTemplateDocument(
  page: Page,
  group: string,
  template: RegExp,
): Promise<void> {
  await createInMode(page, 'diagram');
  const start = startScreen(page, /^Start Diagramming$/);
  const rail = start.locator(`[data-rail]`).filter({ hasText: group }).first();
  await untilHydrated(rail);
  await rail.click();
  await start.getByRole('button', { name: template }).first().click();
  await start.waitFor({ state: 'detached' });
}

// An event-storming board with a ROW of three domain events on it, one gutter
// apart (docs/specs/021-event-storming/event-storming.md). The template seeds a single "Board Created" note; the lane,
// rhythm and insertion tests need neighbours to place against, so this writes
// a row around that note through the api and reloads. The three are copies of
// the seeded note (so they carry exactly its stationery), one rhythm step apart.
export async function startEventStormingRow(page: Page): Promise<void> {
  await startTemplateDocument(page, 'Technical', /^Event storming/i);
  const notes = page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ });
  await notes.first().waitFor();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  const documentId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' }, documentId);
  await page.evaluate(
    async ({ base, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      // Wait for the new board's first save to land (its seeded note on the
      // server), so the row is not written over by it.
      type Seed = { width: number; x: number };
      let tab: (Record<string, unknown> & { elements: Seed[] }) | null = null;
      let tabId = '';
      for (let i = 0; i < 50 && !tab; i += 1) {
        const liveDoc = (await (
          await fetch(`${base}/documents/${id}`, { headers })
        ).json()) as StoredDocument;
        tabId = liveDoc.document?.tabs?.[0]?.id ?? '';
        if (tabId) {
          const got = (await (
            await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })
          ).json()) as StoredTab<Seed>;
          if (got.tab?.elements?.length === 1) tab = { ...got.tab, elements: got.tab.elements };
        }
        if (!tab) await new Promise((r) => setTimeout(r, 100));
      }
      if (!tab) throw new Error('the new board never saved its seed note');
      const seed = tab.elements[0]!;
      const step = seed.width + 16;
      const labels = ['Order placed', 'Payment received', 'Order shipped'];
      const elements = labels.map((label, i) => ({
        ...seed,
        id: crypto.randomUUID(),
        label,
        x: seed.x + (i - 1) * step,
        rotation: i % 2 === 0 ? -1.1 : 1.1,
      }));
      const res = await fetch(`${base}/documents/${id}/tabs/${tabId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ ...tab, elements }),
      });
      if (!res.ok) throw new Error(`seeding the row failed: ${res.status}`);
    },
    { base: apiBase, headers },
  );
  await page.reload();
  await notes.nth(2).waitFor();
}

// Tours never start or offer themselves (docs/specs/007-editor/editor-tour.md "Where it appears": the footer's
// Start Tour button is the one way in), so there is nothing to dismiss: kept so the specs that call it need not change.
export async function dismissQuickTour(_page: Page): Promise<void> {}

// A blank canvas straight away: /new?blank=1, the wizard bypass Start Blank
// links to (docs/specs/007-editor/new-document-route.md), made on livediagram (serverNewUrl) so seedTab can write it.
export async function openStartBlank(page: Page): Promise<void> {
  await page.goto(await serverNewUrl(page, '/new?blank=1'));
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

// A blank tab in Workshop mode straight away: /new?template=blank-session creates it with no wizard
// (docs/specs/012-collaboration/workshop-mode.md "Templates"). Where the session kit lives: the
// Collaborate and Stickers categories and the Session strip.
export async function openBlankSession(page: Page): Promise<void> {
  await page.goto(await serverNewUrl(page, '/new?template=blank-session'));
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

// A blank Diagram document through the wizard: Diagram on the Mode step, Create, then the start screen's × (a blank
// canvas, docs/specs/007-editor/start-diagramming.md "Bringing it back").
export async function startBlankDocument(page: Page): Promise<void> {
  await createInMode(page, 'diagram');
  const start = startScreen(page, /^Start Diagramming$/);
  await start.getByRole('button', { name: 'Close' }).click();
  await start.waitFor({ state: 'detached' });
}

// A /new address that makes the document on livediagram. A guest's own /new makes it in This Browser
// (docs/specs/006-document/save-locations.md "The default depends on who is creating"), where the index holds no item
// and so gives no grant (seedTab's grant request answers 404). A `?folder=` context names a place on the server, so
// /new makes it there whoever is creating. The page becomes a minted guest (its token where the app keeps it, so /new
// never leaves for the guest handoff), or keeps the guest a spec already gave it or its context (adoptGuest), and the
// folder is one of theirs, made at the index.
export async function serverNewUrl(page: Page, url = '/new'): Promise<string> {
  let owner = adoptedGuests.get(page) ?? adoptedGuests.get(page.context());
  if (!owner) {
    owner = await mintGuest(page.request);
    await adoptGuest(page, owner);
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

// A guest as production makes one: liveworkspace's guest token (docs/specs/014-identity/auth-and-guest-access.md),
// here from the e2e stack's accounts stand-in, which signs it with the key the api verifies against. The id is
// the token's own `guest_<uuid>`.
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

// Whom each page or context opens as, so serverNewUrl keeps a spec's own guest rather than minting a second.
const adoptedGuests = new WeakMap<Page | BrowserContext, string>();

// The page (or every page of a context) opens as this guest: its token is where the app keeps it.
export async function adoptGuest(target: Page | BrowserContext, owner: string): Promise<void> {
  const token = guestTokens.get(owner);
  if (!token) throw new Error(`no guest token for ${owner}: mint it with mintGuest`);
  adoptedGuests.set(target, owner);
  await target.addInitScript((t) => {
    try {
      localStorage.setItem('livediagram:v2:guest-token', t);
    } catch {
      // A page with no storage keeps none.
    }
  }, token);
}

// A guest's request headers: their guest token as the Bearer.
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
    data: { id: data.id, app: 'livediagram', title: data.name },
  });
  expect(made.ok(), `index create: ${made.status()}`).toBe(true);
  const { grant } = (await made.json()) as { grant: { grant: string } };
  return request.post('/api/documents', {
    headers: { ...headers, 'X-Index-Grant': grant.grant, 'Content-Type': 'application/json' },
    data,
  });
}

// The page's OWN guest identity as request headers, for api calls a spec makes from inside the page
// (`page.evaluate`, which cannot import this module): the guest token the app keeps, and with `documentId` the grant
// on that document. Read once, before the evaluate, and passed in as an argument.
export async function pageOwnerHeaders(
  page: Page,
  extra: Record<string, string> = {},
  documentId?: string,
): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('livediagram:v2:guest-token'));
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
