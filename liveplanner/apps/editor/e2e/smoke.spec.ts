import {
  test,
  expect,
  dismissQuickTour,
  expectNoPageErrors,
  openTeamRetro,
  startBlankProject,
  paletteTile,
} from './fixtures';

// End-to-end smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Small by design: it answers "does
// the app boot and take input without crashing", the layer the unit
// tests can't reach. Every test also fails on any uncaught page error
// (the `pageErrors` fixture).

test('the new-project wizard renders', async ({ page, pageErrors }) => {
  await page.goto('/new');
  await expect(page.getByText('New Plan', { exact: false })).toBeVisible();
  // The Mode step is the client-rendered heart of the wizard (docs/specs/007-editor/new-project-route.md
  // "Choosing a mode"); its five mode cards prove the picker mounted, not just the shell.
  const modes = page.getByRole('group', { name: 'What are you making?' });
  await expect(modes).toBeVisible();
  await expect(modes.locator('[data-new-mode]')).toHaveCount(5);
  expectNoPageErrors(pageErrors);
});

// The editor header carries no apps menu over the new-project wizard: the product's links live in the Explorer
// panel's footer (docs/specs/013-workspace/explorer-structure.md "Layout").
test('the new-project wizard shows with no apps menu in the header', async ({
  page,
  pageErrors,
}) => {
  await page.goto('/new');
  await expect(page.locator('[data-new-mode="diagram"]')).toBeVisible();
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

test('create a blank project, add a shape, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await startBlankProject(page);
  // The wizard created a real project and routed to it.
  await expect(page).toHaveURL(/\/project\/[0-9a-f-]{36}/);
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
// The bug it guards: the bottom-right cluster gained the Session strip (Timer, Vote), and at
// phone width one row could no longer hold it beside Undo, Redo, Layers, the brush and Fit, so Undo
// was pushed off the left edge. On a phone the cluster's buttons now share the row's width, so the
// strip fits beside Undo (docs/specs/012-collaboration/session-tools.md "The Session strip"), and the
// empty-canvas hint rides just above that one row, clear of the strip's popovers. A desktop run is
// blind to both.
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

  test('the Session strip keeps Undo on screen and opens its tools on top', async ({
    page,
    pageErrors,
  }) => {
    // The strip shows where cards take votes (docs/specs/012-collaboration/session-tools.md), so a Team Retro.
    await openTeamRetro(page);

    // Every cluster button is inside the viewport: nothing pushed off the left edge.
    const undo = page.getByRole('button', { name: /^undo/i });
    await expect(undo).toBeVisible();
    const undoBox = await undo.boundingBox();
    expect(undoBox && undoBox.x >= 0).toBe(true);
    // And the whole cluster is one row at phone width, the Session strip beside Undo
    // (docs/specs/012-collaboration/session-tools.md "The Session strip").
    const rows = await page.locator('[data-zoom-cluster] button').evaluateAll((buttons) => [
      ...new Set(
        buttons
          .map((b) => b.getBoundingClientRect())
          .filter((r) => r.width > 0)
          .map((r) => Math.round((r.top + r.bottom) / 2 / 10)),
      ),
    ]);
    expect(rows).toHaveLength(1);

    // The Timer opens its set-up as a popover that is genuinely on top, not just present.
    await page.getByRole('button', { name: 'Open Timer' }).tap();
    const start = page.getByRole('button', { name: /Start 5 min countdown/ });
    await expect(start).toBeVisible();
    const onTop = await start.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        Math.round(r.x + r.width / 2),
        Math.round(r.y + r.height / 2),
      );
      return !!hit && el.contains(hit);
    });
    expect(onTop).toBe(true);

    // Starting it puts the clock on the button.
    await start.tap();
    await expect(page.getByRole('button', { name: /^Timer \d+:\d\d$/ })).toBeVisible();

    expectNoPageErrors(pageErrors);
  });
});
