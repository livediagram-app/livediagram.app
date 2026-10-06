import {
  test as base,
  expect,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { DEBUG_STORAGE_KEY } from '../lib/debug-log';
import { TOUR_PENDING_KEY } from '../lib/tour-pending';

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

// The Toolbar layout (docs/specs/007-editor/toolbar-layout.md), for a spec about Draw mode's
// floating dock, which only that layout shows (the Floating layout puts Draw's tools in the
// Palette panel, docs/specs/023-draw-mode/draw-mode.md). Only when no layout is stored yet, so a
// reload keeps the preferences the spec changed.
export async function chooseToolbarLayout(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'livediagram:user-preferences:v1';
    try {
      const prefs = JSON.parse(localStorage.getItem(key) ?? '{}') as Record<string, unknown>;
      if (prefs.panelLayout) return;
      localStorage.setItem(key, JSON.stringify({ ...prefs, panelLayout: 'toolbar' }));
    } catch {
      // No storage, no layout to choose.
    }
  });
}

// The editor's debug flag (docs/specs/003-system-architecture/console-logging.md): the suite drives
// the production build, which writes its trace lines only with it set, and specs wait for some of
// them (`[drive-mirror] pass-end`). Set before any page of the context loads.
export async function enableDebugLogs(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ([key]) => {
      try {
        localStorage.setItem(key as string, '*');
      } catch {
        // A page with no storage (about:blank, a sandboxed frame) has no trace lines to show.
      }
    },
    [DEBUG_STORAGE_KEY] as const,
  );
}

export const test = base.extend<{ pageErrors: string[] }>({
  context: async ({ context }, use) => {
    await enableDebugLogs(context);
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

// The wizard is a static export: its buttons are in the HTML before React attaches their handlers, and
// a click in that gap does nothing, more often the busier the machine. React tags every element it
// has hydrated with a `__reactProps$` key; wait for it on the element about to be used.
export async function untilHydrated(locator: Locator): Promise<void> {
  await expect
    .poll(() =>
      locator.evaluate((el) => Object.keys(el).some((key) => key.startsWith('__reactProps$'))),
    )
    .toBe(true);
}

// Complete the /new template wizard into a blank document and land on
// the editor canvas. Shared by the create-flow tests; resilient to the
// wizard's step count by clicking whatever advances it.
// Start a document from a named TEMPLATE in a named category. The blank
// helper below skips the category step entirely (Blank is on the first
// screen), so template creation — builders, layers, per-template canvas
// overrides, the tab kind — is a genuinely different path through the
// wizard and needs its own way in.
export async function startTemplateDocument(
  page: Page,
  category: RegExp,
  template: RegExp,
): Promise<void> {
  await page.goto('/new');
  await page.getByText('New Document', { exact: false }).waitFor();
  // Category tiles are aria-labelled "Browse <name> templates"; the
  // template tiles carry their title + description as the accessible name.
  const categoryTile = page.getByRole('button', { name: category }).first();
  await untilHydrated(categoryTile);
  await categoryTile.click();
  // Picking a template moves straight on to the Location step.
  await page.getByRole('button', { name: template }).first().click();
  await page
    .getByRole('button', { name: /^(create|start|use this|done|finish)$/i })
    .first()
    .click();
  await page.locator('[data-canvas-a11y-root]').waitFor();
}

// An event-storming board with a ROW of three domain events on it, one gutter
// apart (docs/specs/021-event-storming/event-storming.md). The template seeds a single "Board Created" note; the lane,
// rhythm and insertion tests need neighbours to place against, so this writes
// a row around that note through the api and reloads. The three are copies of
// the seeded note (so they carry exactly its stationery), one rhythm step apart.
export async function startEventStormingRow(page: Page): Promise<void> {
  await startTemplateDocument(page, /Browse Technical templates/, /^Event storming/i);
  const notes = page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ });
  await notes.first().waitFor();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' });
  await page.evaluate(
    async ({ base, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      // Wait for the new board's first save to land (its seeded note on the
      // server), so the row is not written over by it.
      let tab: { elements: { width: number; x: number }[] } | null = null;
      let tabId = '';
      for (let i = 0; i < 50 && !tab; i += 1) {
        const liveDoc = await (await fetch(`${base}/documents/${id}`, { headers })).json();
        tabId = liveDoc.document?.tabs?.[0]?.id ?? '';
        if (tabId) {
          const got = await (
            await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })
          ).json();
          if (got.tab?.elements?.length === 1) tab = got.tab;
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

// Dismiss the quick-tour offer (docs/specs/007-editor/editor-tour.md) when this page is owed one.
// It lands a BEAT AFTER the canvas does, and its modal overlay swallows pointer events, so a test that
// merely checks whether it is showing YET races it and then finds its drags going nowhere, silently.
// The offer comes only while /new's handoff flag is in sessionStorage (lib/tour-pending.ts): without
// the flag (a reload after declining it, a document opened by URL) nothing is owed, and this returns
// at once instead of waiting out a timeout. With it, wait until the offer shows, or until the flag
// clears without one (the tour already seen).
export async function dismissQuickTour(page: Page): Promise<void> {
  const decline = page.getByRole('button', { name: /^no thanks$/i }).first();
  const owed = () => page.evaluate((key) => sessionStorage.getItem(key) === '1', TOUR_PENDING_KEY);
  await expect
    .poll(async () => (await decline.isVisible()) || !(await owed()), {
      message: 'the owed tour offer never showed',
    })
    .toBe(true);
  if (!(await decline.isVisible())) return;
  await decline.click();
  await decline.waitFor({ state: 'detached' });
}

// A blank canvas straight away: /new?blank=1, the wizard bypass Start Blank
// links to (docs/specs/007-editor/new-document-route.md).
export async function openStartBlank(page: Page): Promise<void> {
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

export async function startBlankDocument(page: Page): Promise<void> {
  await page.goto('/new');
  await page.getByText('New Document', { exact: false }).waitFor();
  // Step 1: pick the Blank template. Single-click advances to the Location
  // step (docs/specs/007-editor/new-document-route.md), so no explicit Next is needed here.
  const blank = page.getByText('Blank Diagram', { exact: false }).first();
  await untilHydrated(blank);
  await blank.click();
  // Step 2 (Location): the footer's primary action finishes the wizard.
  // Anchored finish verbs: an unanchored /create/i also matched the
  // settings step's "New Folder ... Create here" tile (the CI breakage
  // this comment is the tombstone for).
  await page
    .getByRole('button', { name: /^(create|start|use this|done|finish)$/i })
    .first()
    .click();
  // The editor is up once the canvas surface (the a11y root, docs/specs/004-interface-design/canvas-accessibility.md)
  // is in the DOM.
  await page.locator('[data-canvas-a11y-root]').waitFor();
}

export type Seed = Record<string, unknown>[];

// Write the seed into the new document's first tab through the api, reload.
export async function seedTab(page: Page, elements: Seed): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' });
  await page.evaluate(
    async ({ base, elements, headers }) => {
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      let tab: Record<string, unknown> | null = null;
      let tabId = '';
      for (let i = 0; i < 50 && !tab; i += 1) {
        const liveDoc = await (await fetch(`${base}/documents/${id}`, { headers })).json();
        tabId = liveDoc.document?.tabs?.[0]?.id ?? '';
        if (tabId) {
          const got = await (
            await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })
          ).json();
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
    id: localStorage.getItem('livediagram:v2:self-id') ?? '',
    sig: localStorage.getItem('livediagram:v2:self-sig'),
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
