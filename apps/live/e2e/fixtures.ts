import { test as base, expect, type Page } from '@playwright/test';

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

export const test = base.extend<{ pageErrors: string[] }>({
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
  await page.getByRole('button', { name: category }).first().click();
  await page.getByRole('button', { name: template }).first().click();
  await page.getByRole('button', { name: /^next$/i }).click();
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
  await page.evaluate(async (base: string) => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const headers = { 'X-Owner-Id': owner, 'Content-Type': 'application/json' };
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
  }, apiBase);
  await page.reload();
  await notes.nth(2).waitFor();
}

// Dismiss the quick-tour dialog (docs/specs/008-canvas/layout-cleanup.md) if this profile is offered one.
// It lands a BEAT AFTER the canvas does, and its modal overlay swallows
// pointer events — so a test that merely checks whether it is showing YET
// races it and then finds its drags going nowhere, silently. Wait for it,
// but tolerate its absence: whether it is offered depends on what this
// browser profile has already seen.
export async function dismissQuickTour(page: Page): Promise<void> {
  const decline = page.getByRole('button', { name: /^no thanks$/i }).first();
  try {
    await decline.waitFor({ state: 'visible', timeout: 5_000 });
  } catch {
    return;
  }
  await decline.click();
  await decline.waitFor({ state: 'detached' });
}

// Opens /new and takes "Just Draw" to the editor. Retried, because on a cold server the first click can
// land before hydration; but only clicks while the wizard is still up: a click that already worked leaves
// /new, and hunting for the button again would fail every retry while the editor loads under load.
export async function openJustDraw(page: Page): Promise<void> {
  await page.goto('/new');
  const canvas = page.locator('[data-canvas-a11y-root]');
  await expect(async () => {
    if (new URL(page.url()).pathname.replace(/\/$/, '') === '/new') {
      await page.getByRole('button', { name: /^just draw$/i }).click({ timeout: 2_000 });
    }
    await canvas.waitFor({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await dismissQuickTour(page);
}

export async function startBlankDocument(page: Page): Promise<void> {
  await page.goto('/new');
  await page.getByText('New Document', { exact: false }).waitFor();
  // Step 1: pick the Blank template. Single-click advances to the theme
  // step (docs/specs/006-document/offline-mode.md), so no explicit Next is needed here.
  await page.getByText('Blank diagram', { exact: false }).click();
  // Step 2 (theme) -> step 3 (settings). ANCHORED name: a bare /next/i
  // also matches the Next.js DevTools button on dev servers.
  await page.getByRole('button', { name: /^next$/i }).click();
  // Step 3 (settings): the footer's primary action finishes the wizard.
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
  await page.evaluate(
    async ({ base, elements }) => {
      const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
      const id = location.pathname.split('/').filter(Boolean).pop()!;
      const headers = { 'X-Owner-Id': owner, 'Content-Type': 'application/json' };
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
    { base: apiBase, elements },
  );
  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
}
