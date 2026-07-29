import { test, expect, expectNoPageErrors, startBlankDiagram } from './fixtures';

// End-to-end smoke suite (spec/72). Small by design: it answers "does
// the app boot and take input without crashing", the layer the unit
// tests can't reach. Every test also fails on any uncaught page error
// (the `pageErrors` fixture).

test('the new-diagram wizard renders', async ({ page, pageErrors }) => {
  await page.goto('/new');
  await expect(page.getByText('New Diagram', { exact: false })).toBeVisible();
  // The Quick Start template grid is the client-rendered heart of the
  // wizard; its presence proves the picker mounted, not just the shell.
  await expect(page.getByText('Quick Start', { exact: false })).toBeVisible();
  await expect(page.getByText('Blank diagram', { exact: false })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('the explorer renders for a guest', async ({ page, pageErrors }) => {
  await page.goto('/explorer');
  // The sidebar's quick-find sections are always present for a guest.
  await expect(page.getByText('Recent', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Shared with you', { exact: false })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('create a blank diagram, add a shape, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await startBlankDiagram(page);
  // The wizard created a real diagram and routed to it.
  await expect(page).toHaveURL(/\/diagram\/[0-9a-f-]{36}/);

  // The palette is open by default on desktop; its shape tiles are
  // aria-labelled ("Add square"). Arm the Square, then drop it on the
  // canvas with a single click. Element views carry a role=img label
  // (spec/71), so the placed square is addressable without reaching
  // into canvas internals.
  const canvas = page.locator('[data-canvas-a11y-root]');
  const square = page.getByRole('img', { name: 'Square', exact: true });
  await page.getByRole('button', { name: 'Add square', exact: true }).click();
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

// The one mobile test (spec/72). Not a general phone suite: it guards a
// specific class of bug that a desktop-only run is structurally blind to —
// a popover that only OVERLAPS its host when the viewport is too narrow to
// put it alongside, and so only then has to win the stacking contest.
//
// The bug it is a tombstone for: the Collaborate flyout was z-overlay while
// the tab menu it opens from is z-modal. On desktop the flyout sits beside
// the menu and the z-order never matters; on a phone it clamps on top of the
// menu and rendered behind it, so tapping Collaborate did nothing at all.
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

  test('the tab menu opens the Collaborate flyout in front of the menu', async ({
    page,
    pageErrors,
  }) => {
    await startBlankDiagram(page);
    // A fresh guest gets the tour offer over a scrim that eats taps.
    const declineTour = page.getByRole('button', { name: /^no thanks$/i });
    if (await declineTour.count()) await declineTour.tap();

    await page.getByRole('button', { name: 'Tab menu' }).tap();
    const collaborate = page.getByRole('button', { name: /collaborate/i });
    await expect(collaborate).toBeVisible();
    await collaborate.tap();

    // Present in the DOM is not the assertion that matters — it was present
    // and painted behind the menu before the fix. Ask the browser what is
    // actually on top at the flyout's own centre.
    const flyout = page.locator('[data-menu-flyout]');
    await expect(flyout).toBeVisible();
    const onTop = await page.evaluate(() => {
      const panel = document.querySelector('[data-menu-flyout]');
      if (!panel) return false;
      const r = panel.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round(r.x + r.width / 2),
        Math.round(r.y + r.height / 2),
      );
      return !!hit && panel.contains(hit);
    });
    expect(onTop).toBe(true);

    // And the session tools are genuinely reachable, not just painted.
    await expect(page.getByRole('button', { name: /^timer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^poll$/i })).toBeVisible();

    // Covering the parent hides which row is open and the way back, so the
    // mobile panel carries its own header: the category name, and a Close
    // that returns to the menu underneath.
    await expect(flyout.getByText('COLLABORATE')).toBeVisible();
    const close = flyout.getByRole('button', { name: /close collaborate/i });
    await expect(close).toBeVisible();

    // It sits ON the parent rather than beside it — the whole reason the
    // header is needed.
    const covers = await page.evaluate(() => {
      const panel = document.querySelector('[data-menu-flyout]');
      const host = document.querySelector('[data-tour-id="tab-menu"]');
      if (!panel || !host) return null;
      const p = panel.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      return {
        sameLeft: Math.abs(p.left - h.left) <= 1,
        sameWidth: Math.abs(p.width - h.width) <= 1,
      };
    });
    expect(covers).toEqual({ sameLeft: true, sameWidth: true });

    // Close returns to the parent menu.
    await close.tap();
    await expect(flyout).toHaveCount(0);
    await expect(page.getByRole('button', { name: /collaborate/i })).toBeVisible();

    expectNoPageErrors(pageErrors);
  });
});
