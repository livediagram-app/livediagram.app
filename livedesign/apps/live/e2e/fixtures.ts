import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import type { StoredDesign, StoredTab } from './stored';
import { DEBUG_STORAGE_KEY } from '../lib/debug-log';

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
// overlays would take the presses of every spec there; they have their own unit tests. Marked seen (with the old
// Draw and Forms tour flags) for every page of the context.
async function markModeToursSeen(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const key = 'livedesign:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      // The Pages tour offers each page kind once (lib/tour-tracks.ts): every kind answered.
      if (
        prefs.drawTourSeen !== true ||
        prefs.formTourSeen !== true ||
        !Array.isArray(prefs.pagesTourKinds) ||
        !Array.isArray(prefs.elementTourKinds)
      )
        localStorage.setItem(
          key,
          JSON.stringify({
            ...prefs,
            drawTourSeen: true,
            formTourSeen: true,
            pagesTourSeen: true,
            pagesTourKinds: ['infographic', 'logo'],
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

// The wizard is a static export: its buttons are in the HTML before React attaches their handlers. A mode
// card clicked in that gap is kept and acted on at hydration (new-design-route.md "A choice before
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

// The wizard asks only for a mode (docs/specs/007-editor/new-design-route.md "One-step wizard"): choosing one
// creates the design there and then, and lands on the editor with the mode's start screen over the canvas
// (docs/specs/007-editor/start-diagramming.md).
// Resolves to the new design's id; `url` carries a `/new?folder=` / `?team=` context.
export async function createInMode(page: Page, mode: string, url = '/new'): Promise<string> {
  await page.goto(url);
  await page.getByText('New Design', { exact: false }).waitFor();
  const card = page.locator(`[data-new-mode="${mode}"]`);
  await untilHydrated(card);
  await card.click();
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  return new URL(page.url()).pathname.split('/').pop()!;
}

// The start screen over a new tab, by its mode's title (Start Diagramming, ...).
const startScreen = (page: Page, title: RegExp = /^Start /) =>
  page.getByRole('region', { name: title });

// Start a design from a named TEMPLATE in a named group of Start Diagramming: a Diagram design from the
// wizard, then the template picked on its start screen, so template creation (builders, layers, per-template
// canvas overrides, the tab kind) is its own path, as a person takes it.
export async function startTemplateDesign(
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

// Skip the Pages tour when it offers itself. It lands a BEAT AFTER the canvas does, and its card swallows pointer
// events, so wait a short settle for it rather than checking once; a page whose tour is seen (pagesTourSeen) never
// shows one, and this returns after the settle.
export async function dismissQuickTour(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: /^skip tour$/i }).first();
  const shown = await skip
    .waitFor({ state: 'visible', timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (!shown) return;
  await skip.click();
  await skip.waitFor({ state: 'detached' });
}

// A blank canvas straight away: /new?blank=1, the wizard bypass Start Blank
// links to (docs/specs/007-editor/new-design-route.md).
export async function openStartBlank(page: Page): Promise<void> {
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

// A blank session tab straight away: /new?template=blank-session creates it with no wizard.
export async function openBlankSession(page: Page): Promise<void> {
  // The Workshop tour offers itself 800 ms into Workshop (WorkshopTourHost OFFER_DELAY_MS) and its
  // overlay would take these specs' presses; it has its own unit tests.
  await page.addInitScript(() => {
    const key = 'livedesign:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (prefs.workshopTourSeen !== true)
        localStorage.setItem(key, JSON.stringify({ ...prefs, workshopTourSeen: true }));
    } catch {
      // No storage: nothing to mark.
    }
  });
  await page.goto('/new?template=blank-session');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

// A blank design with its start closed: the same /new?blank=1 (kept as its own name for the specs that read as
// "start a blank design"). livedesign has one mode, Pages, so there is no Mode step to pass.
export async function startBlankDesign(page: Page): Promise<void> {
  await openStartBlank(page);
}

export type Seed = Record<string, unknown>[];

// Write the seed into the new design's first tab through the api, reload.
export async function seedTab(page: Page, elements: Seed): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  const designId = new URL(page.url()).pathname.split('/').filter(Boolean).pop()!;
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' }, designId);
  await page.evaluate(
    async ({ base, elements, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      let tab: Record<string, unknown> | null = null;
      let tabId = '';
      for (let i = 0; i < 50 && !tab; i += 1) {
        const liveDoc = (await (
          await fetch(`${base}/designs/${id}`, { headers })
        ).json()) as StoredDesign;
        tabId = liveDoc.design?.tabs?.[0]?.id ?? '';
        if (tabId) {
          const got = (await (
            await fetch(`${base}/designs/${id}/tabs/${tabId}`, { headers })
          ).json()) as StoredTab;
          tab = got.tab ?? null;
        }
        if (!tab) await new Promise((r) => setTimeout(r, 100));
      }
      if (!tab) throw new Error('the new design never saved its first tab');
      const res = await fetch(`${base}/designs/${id}/tabs/${tabId}`, {
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

// A guest as production makes one: a guest token from liveworkspace (liveworkspace/docs/accounts.md "Guests"), here
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
      localStorage.setItem('livedesign:v2:guest-token', t);
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

// The index's grant on a design for whoever `headers` names (liveworkspace/docs/one-explorer-contracts.md "Grants"):
// every api request about one design carries it as X-Index-Grant.
export async function designGrant(
  request: import('@playwright/test').APIRequestContext,
  headers: Record<string, string>,
  designId: string,
): Promise<string> {
  const res = await request.post(`/api/index/items/${encodeURIComponent(designId)}/grant`, {
    headers,
  });
  expect(res.ok(), `grant on ${designId}: ${res.status()}`).toBe(true);
  return ((await res.json()) as { grant: string }).grant;
}

// ownerHeaders plus the grant on one design.
export async function designHeaders(
  request: import('@playwright/test').APIRequestContext,
  owner: string,
  designId: string,
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers = ownerHeaders(owner);
  return { ...headers, 'X-Index-Grant': await designGrant(request, headers, designId), ...extra };
}

// A design made as the app makes one: the item at the index first, then its content with the grant the create
// answers (liveworkspace/docs/one-explorer-contracts.md "Items"). `data` is the api's create body ({ id, name,
// tabs, ... }). Answers the content create's response.
export async function seedDesign(
  request: import('@playwright/test').APIRequestContext,
  owner: string | Record<string, string>,
  data: { id: string; name: string } & Record<string, unknown>,
): Promise<import('@playwright/test').APIResponse> {
  const headers = typeof owner === 'string' ? ownerHeaders(owner) : owner;
  const made = await request.post('/api/index/items', {
    headers,
    data: { id: data.id, app: 'livedesign', title: data.name },
  });
  expect(made.ok(), `index create: ${made.status()}`).toBe(true);
  const { grant } = (await made.json()) as { grant: { grant: string } };
  return request.post('/api/designs', {
    headers: { ...headers, 'X-Index-Grant': grant.grant, 'Content-Type': 'application/json' },
    data,
  });
}

// The page's OWN guest identity as request headers, for api calls a spec makes from inside the page
// (`page.evaluate`, which cannot import this module): its guest token, and with `designId` the grant on that design.
// Read once, before the evaluate, and passed in as an argument.
export async function pageOwnerHeaders(
  page: Page,
  extra: Record<string, string> = {},
  designId?: string,
): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('livedesign:v2:guest-token') ?? '');
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (designId) headers['X-Index-Grant'] = await designGrant(page.request, headers, designId);
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
