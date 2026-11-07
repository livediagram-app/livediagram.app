import {
  test,
  expect,
  dismissQuickTour,
  expectNoPageErrors,
  openBlankSession,
  startBlankDocument,
  paletteTile,
} from './fixtures';

// End-to-end smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Small by design: it answers "does
// the app boot and take input without crashing", the layer the unit
// tests can't reach. Every test also fails on any uncaught page error
// (the `pageErrors` fixture).

test('/new opens a new Space on Start a Space', async ({ page, pageErrors }) => {
  await page.goto('/new');
  // No screen of its own (docs/specs/007-editor/new-document-route.md "No welcome screen"): the Space is made and the
  // client-rendered editor mounts with its start, not just the shell.
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: /^Start a Space$/ })).toBeVisible({
    timeout: 30_000,
  });
  expectNoPageErrors(pageErrors);
});

// The first visit itself (docs/specs/003-system-architecture/e2e-smoke.md "Every test opens as a returning guest"):
// every other test opens as a guest who holds a token, and a browser with none leaves /new for the guest handoff and
// comes back holding one. Nothing is checked on the page until the round trip is back.
test.describe('a first visit', () => {
  test.use({ freshVisitor: true });

  test('goes through the guest handoff, comes back with a guest token, and makes one Space', async ({
    page,
    pageErrors,
  }) => {
    const visited: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
    });
    await page.goto('/new');
    const cameBack = () => {
      const at = visited.findIndex((path) => path.startsWith('/auth/guest'));
      return at >= 0 && at < visited.length - 1;
    };
    await expect.poll(cameBack, { timeout: 15_000 }).toBe(true);
    // The Space is made after the round trip, never before it (new-document-route.md "No welcome screen").
    await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const back = visited.findIndex((path) => path.startsWith('/auth/guest'));
    expect(visited.slice(0, back).some((path) => path.startsWith('/document/'))).toBe(false);
    expect(
      await page.evaluate(() => localStorage.getItem('livehuddle:v2:guest-token')),
    ).toBeTruthy();
    expectNoPageErrors(pageErrors);
  });
});

// The editor header carries no apps menu over a new Space: the product's links live in the Explorer panel's footer
// (docs/specs/013-workspace/explorer-structure.md "Layout").
test('a new Space shows with no apps menu in the header', async ({ page, pageErrors }) => {
  await page.goto('/new');
  await expect(page.getByRole('region', { name: /^Start a Space$/ })).toBeVisible({
    timeout: 30_000,
  });
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

test('create a blank document, add a shape, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  // /new created a real document and routed to it.
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/);
  // The tour offer opens 800 ms after the editor is ready and its backdrop takes every click
  // (TourHost): answer it first, or a slow runner's canvas click lands on the backdrop.
  await dismissQuickTour(page);

  // The palette is open by default on desktop; its shape tiles are
  // aria-labelled ("Add Square"). Arm the Square, then drop it on the
  // canvas with a single click. Element views carry a role=img label
  // (docs/specs/004-interface-design/canvas-accessibility.md), so the placed square is addressable without reaching
  // into canvas internals.
  const canvas = page.locator('[data-canvas-a11y-root]');
  const square = page.getByRole('img', { name: 'Sticky note', exact: true });
  await (await paletteTile(page, 'Add Sticky Note')).click();
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
// The bug it guards: the bottom-right cluster once gained a Session strip (since retired,
// docs/specs/012-collaboration/session-tools.md), and at phone width one row could no longer hold it beside Undo,
// Redo, Layers, the brush and Fit, so Undo was pushed off the left edge. On a phone the cluster's buttons share the
// row's width (docs/specs/007-editor/editor-app.md), so a cluster that grows keeps Undo on screen. A desktop run is
// blind to it.
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

  test('the bottom-right cluster keeps Undo on screen in one row, and steps it aside while walking', async ({
    page,
    pageErrors,
  }) => {
    await openBlankSession(page);

    // Every cluster button is inside the viewport: nothing pushed off the left edge.
    const undo = page.getByRole('button', { name: /^undo/i });
    await expect(undo).toBeVisible();
    const undoBox = await undo.boundingBox();
    expect(undoBox && undoBox.x >= 0).toBe(true);
    // And the whole cluster is one row at phone width.
    const rows = () =>
      page.locator('[data-zoom-cluster] button').evaluateAll((buttons) => [
        ...new Set(
          buttons
            .map((b) => b.getBoundingClientRect())
            .filter((r) => r.width > 0)
            .map((r) => Math.round((r.top + r.bottom) / 2 / 10)),
        ),
      ]);
    expect(await rows()).toHaveLength(1);

    // Walking (docs/specs/008-canvas/avatar-mode.md "No editing chrome while walking"): Undo, Redo and Tab Style step
    // aside, the cluster still one row, and leaving the mode brings them back.
    const redo = page.getByRole('button', { name: /^redo/i });
    const style = page.getByRole('button', { name: 'Theme and canvas' });
    // The Edit | Walk toggle, first on the strip (docs/specs/008-canvas/avatar-mode.md "The Edit | Walk toggle").
    const toggle = page.getByRole('group', { name: 'Edit or Walk' });
    const walk = toggle.getByRole('button', { name: 'Walk', exact: true });
    const edit = toggle.getByRole('button', { name: 'Edit', exact: true });
    await expect(style).toBeVisible();
    // A blank Space opens on Start a Space (docs/specs/007-editor/new-document-route.md "No welcome screen"), and on a
    // phone that sheet lies over the canvas (docs/specs/007-editor/start-diagramming.md), so close it first.
    const start = page.getByRole('region', { name: /^Start a Space$/ });
    await start.getByRole('button', { name: 'Close' }).click();
    await start.waitFor({ state: 'detached' });
    await walk.click();
    await expect(walk).toHaveAttribute('aria-pressed', 'true');
    await expect(undo).toHaveCount(0);
    await expect(redo).toHaveCount(0);
    await expect(style).toHaveCount(0);
    expect(await rows()).toHaveLength(1);
    await edit.click();
    await expect(edit).toHaveAttribute('aria-pressed', 'true');
    await expect(walk).toHaveAttribute('aria-pressed', 'false');
    await expect(undo).toBeVisible();
    await expect(redo).toBeVisible();
    await expect(style).toBeVisible();

    expectNoPageErrors(pageErrors);
  });
});
