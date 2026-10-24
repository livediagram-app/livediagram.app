import type { Page } from '@playwright/test';
import {
  test,
  expect,
  dismissQuickTour,
  expectNoPageErrors,
  openStartBlank,
  startBlankDesign,
  paletteTile,
} from './fixtures';

// End-to-end smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Small by design: it answers "does
// the app boot and take input without crashing", the layer the unit
// tests can't reach. Every test also fails on any uncaught page error
// (the `pageErrors` fixture).

// /new asks nothing (docs/specs/007-editor/new-design-route.md): it makes the design, lands on the editor under the
// design's own URL, and the empty tab shows its start (docs/specs/007-editor/start-diagramming.md) with template
// cards in it, proving the client-rendered start mounted, not just the shell.
const start = (page: Page) => page.getByRole('region', { name: /^Start Making Pages$/ });

test('/new makes a design and opens on its start', async ({ page, pageErrors }) => {
  await page.goto('/new');
  await expect(page).toHaveURL(/\/design\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(start(page)).toBeVisible();
  await expect(start(page).locator('[data-start-card]').first()).toBeVisible();
  expectNoPageErrors(pageErrors);
});

// The editor header carries no apps menu: the product's links live in the Explorer panel's footer
// (docs/specs/013-workspace/explorer-structure.md "Layout").
test('a new design shows with no apps menu in the header', async ({ page, pageErrors }) => {
  await page.goto('/new');
  await expect(start(page)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /^switch section/i })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('the explorer renders for a guest', async ({ page, pageErrors }) => {
  await page.goto('/explorer');
  // The sidebar's Overview rows are always present for a guest
  // (docs/specs/013-workspace/explorer-structure.md).
  await expect(page.getByRole('treeitem', { name: /^Home/ })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: /^Shared With Me/ })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('create a blank design, add a shape, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await startBlankDesign(page);
  // /new created a real design and routed to it.
  await expect(page).toHaveURL(/\/design\/[0-9a-f-]{36}/);
  // The tour offer opens 800 ms after the editor is ready and its backdrop takes every click
  // (TourHost): answer it first, or a slow runner's canvas click lands on the backdrop.
  await dismissQuickTour(page);

  // The palette is open by default on desktop; its shape tiles are
  // aria-labelled ("Add Square"). Arm the Square, then drop it on the
  // canvas with a single click. Element views carry a role=img label
  // (docs/specs/004-interface-design/canvas-accessibility.md), so the placed square is addressable without reaching
  // into canvas internals.
  const canvas = page.locator('[data-canvas-a11y-root]');
  const square = page.getByRole('img', { name: 'Square', exact: true });
  await (await paletteTile(page, 'Add Square')).click();
  await canvas.click({ position: { x: 420, y: 300 } });
  await expect(square).toHaveCount(1);

  // The autosave round-trip through the api + D1 is the part no unit
  // test covers: reload and the shape must still be on the tab.
  await page.waitForTimeout(1500); // let the debounced autosave flush
  await page.reload();
  await canvas.waitFor();
  await expect(square).toHaveCount(1);

  expectNoPageErrors(pageErrors);
});

// The one mobile test (docs/specs/003-system-architecture/e2e-smoke.md). Not a general phone suite: it guards a
// specific class of bug that a desktop-only run is structurally blind to —
// a popover that only OVERLAPS its host when the viewport is too narrow to
// put it alongside, and so only then has to win the stacking contest.
//
// The bottom-right cluster stays one row at phone width, with Undo on screen. A desktop run is blind to it.
test.describe('mobile', () => {
  // Only the properties that create the condition — a narrow viewport and a
  // real touch pointer. Spreading a whole `devices[...]` entry would also set
  // defaultBrowserType, which Playwright forbids inside a describe.
  test.use({
    viewport: { width: 390, height: 664 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 3,
  });

  test('the cluster keeps Undo on screen in one row', async ({ page, pageErrors }) => {
    await openStartBlank(page);

    // Every cluster button is inside the viewport: nothing pushed off the left edge.
    const undo = page.getByRole('button', { name: /^undo/i });
    await expect(undo).toBeVisible();
    const undoBox = await undo.boundingBox();
    expect(undoBox && undoBox.x >= 0).toBe(true);
    // And the whole cluster is one row at phone width.
    const rows = await page.locator('[data-zoom-cluster] button').evaluateAll((buttons) => [
      ...new Set(
        buttons
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0)
          .map((r) => Math.round((r.top + r.bottom) / 2 / 10)),
      ),
    ]);
    expect(rows).toHaveLength(1);

    expectNoPageErrors(pageErrors);
  });
});
