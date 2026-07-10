import { test as base, expect, type Page } from '@playwright/test';

// Shared fixture (spec/72): every smoke test fails on an uncaught
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

// Complete the /new template wizard into a blank diagram and land on
// the editor canvas. Shared by the create-flow tests; resilient to the
// wizard's step count by clicking whatever advances it.
export async function startBlankDiagram(page: Page): Promise<void> {
  await page.goto('/new');
  await page.getByText('New Diagram', { exact: false }).waitFor();
  // Step 1: pick the Blank template. Single-click advances to the theme
  // step (spec/76), so no explicit Next is needed here.
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
  // The editor is up once the canvas surface (the a11y root, spec/71)
  // is in the DOM.
  await page.locator('[data-canvas-a11y-root]').waitFor();
}
