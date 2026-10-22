import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import type { StoredProject, StoredTab } from './stored';
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

// The Plan and Forms tours (docs/specs/026-plan/plan-tour.md,
// docs/specs/030-forms/forms.md) offer themselves 800 ms into their modes and their overlays would take the presses of every spec there; they have
// their own unit tests. Marked seen for every page of the context.
async function markModeToursSeen(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const key = 'liveplanner:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (prefs.formTourSeen !== true || prefs.planTourSeen !== true)
        localStorage.setItem(
          key,
          JSON.stringify({
            ...prefs,
            formTourSeen: true,
            // The Plan tour is mounted on every tab now that Plan is the one mode.
            planTourSeen: true,
            planTourTracks: ['boards', 'sheets'],
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

// The wizard is a static export: its buttons are in the HTML before React attaches their handlers. A mode
// card clicked in that gap is kept and acted on at hydration (new-project-route.md "A choice before
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

// The wizard asks only for a mode (docs/specs/007-editor/new-project-route.md "One-step wizard"): choosing one
// creates the project there and then, and lands on the editor with the mode's start screen over the canvas
// (docs/specs/007-editor/start-panel.md).
// Resolves to the new project's id; `url` carries a `/new?folder=` / `?team=` context.
export async function createInMode(page: Page, mode: string, url = '/new'): Promise<string> {
  await page.goto(url);
  await page.getByText('New Project', { exact: false }).waitFor();
  const card = page.locator(`[data-new-mode="${mode}"]`);
  await untilHydrated(card);
  await card.click();
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  return new URL(page.url()).pathname.split('/').pop()!;
}

// The start screen over a new tab, by its mode's title (Start Diagramming, ...).
const startScreen = (page: Page, title: RegExp = /^Start /) =>
  page.getByRole('region', { name: title });

// Start a project from a named TEMPLATE in a named group of Start Diagramming: a Diagram project from the
// wizard, then the template picked on its start screen, so template creation (builders, layers, per-template
// canvas overrides, the tab kind) is its own path, as a person takes it.
export async function startTemplateProject(
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

// The Diagram tour and its /new handoff offer are gone (Plan is the only editor mode), so nothing is
// owed: kept so the specs that call it need not change.
export async function dismissQuickTour(_page: Page): Promise<void> {}

// A blank canvas straight away: /new?blank=1, the wizard bypass Start Blank
// links to (docs/specs/007-editor/new-project-route.md).
export async function openStartBlank(page: Page): Promise<void> {
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

// A Team Retro straight away: its retro board's cards take votes, so the tab offers the Session strip
// (docs/specs/012-collaboration/session-tools.md "The Session strip").
export async function openTeamRetro(page: Page): Promise<void> {
  await page.goto('/new?template=team-retro');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

// A blank Diagram project through the wizard: Diagram on the Mode step, Create, then the start screen's × (a blank
// canvas, docs/specs/007-editor/start-panel.md "Bringing it back").
export async function startBlankProject(page: Page): Promise<void> {
  await createInMode(page, 'diagram');
  const start = startScreen(page, /^Start Diagramming$/);
  await start.getByRole('button', { name: 'Close' }).click();
  await start.waitFor({ state: 'detached' });
}

export type Seed = Record<string, unknown>[];

// Write the seed into the new project's first tab through the api, reload.
export async function seedTab(page: Page, elements: Seed): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' });
  await page.evaluate(
    async ({ base, elements, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      let tab: Record<string, unknown> | null = null;
      let tabId = '';
      for (let i = 0; i < 50 && !tab; i += 1) {
        const liveDoc = (await (
          await fetch(`${base}/projects/${id}`, { headers })
        ).json()) as StoredProject;
        tabId = liveDoc.project?.tabs?.[0]?.id ?? '';
        if (tabId) {
          const got = (await (
            await fetch(`${base}/projects/${id}/tabs/${tabId}`, { headers })
          ).json()) as StoredTab;
          tab = got.tab ?? null;
        }
        if (!tab) await new Promise((r) => setTimeout(r, 100));
      }
      if (!tab) throw new Error('the new project never saved its first tab');
      const res = await fetch(`${base}/projects/${id}/tabs/${tabId}`, {
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

// A guest as production makes one: minted and signed by the api worker
// (docs/specs/014-identity/auth-and-guest-access.md). The e2e stack signs guest ids, so a hand-made
// unsigned id would be upgraded (and its data moved) the moment the app opens.
const guestSigs = new Map<string, string>();

export async function mintSignedGuest(
  request: import('@playwright/test').APIRequestContext,
): Promise<string> {
  const res = await request.post(`${process.env.NEXT_PUBLIC_API_BASE ?? '/api'}/guest-id`, {
    data: {},
  });
  expect(res.ok()).toBe(true);
  const { ownerId, ownerSig } = (await res.json()) as { ownerId: string; ownerSig: string | null };
  if (ownerSig) guestSigs.set(ownerId, ownerSig);
  return ownerId;
}

export function guestSigFor(owner: string): string | null {
  return guestSigs.get(owner) ?? null;
}

export function ownerHeaders(
  owner: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  const sig = guestSigs.get(owner);
  return { 'X-Owner-Id': owner, ...(sig ? { 'X-Owner-Sig': sig } : {}), ...extra };
}

// The page's OWN guest identity as request headers, for api calls a spec makes from inside the page
// (`page.evaluate`, which cannot import this module). The stack enforces guest signatures as
// production does, so the id travels with the signature the app stored beside it. Read once, before
// the evaluate, and passed in as an argument.
export async function pageOwnerHeaders(
  page: Page,
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const { id, sig } = await page.evaluate(() => ({
    id: localStorage.getItem('liveplanner:v2:self-id') ?? '',
    sig: localStorage.getItem('liveplanner:v2:self-sig'),
  }));
  return { 'X-Owner-Id': id, ...(sig ? { 'X-Owner-Sig': sig } : {}), ...extra };
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
