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

test('the new-document wizard renders', async ({ page, pageErrors }) => {
  await page.goto('/new');
  await expect(page.getByText('New Space', { exact: false })).toBeVisible();
  // Every board is Workshop (docs/specs/007-editor/editor-modes.md), so the wizard asks no question: its one
  // Create button proves the client-rendered wizard mounted, not just the shell.
  await expect(page.locator('[data-new-mode]')).toHaveCount(1);
  await expect(page.locator('[data-new-mode="workshop"]')).toBeVisible();
  expectNoPageErrors(pageErrors);
});

// The first visit itself (docs/specs/003-system-architecture/e2e-smoke.md "Every test opens as a returning guest"):
// every other test opens as a guest who holds a token, and a browser with none leaves /new for the guest handoff and
// comes back holding one. Nothing is checked on the page until the round trip is back.
test.describe('a first visit', () => {
  test.use({ freshVisitor: true });

  test('goes through the guest handoff and comes back to the wizard with a guest token', async ({
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
    await expect(page.locator('[data-new-mode="workshop"]')).toBeVisible();
    expect(visited.at(-1)).toMatch(/^\/new\/?$/);
    expect(
      await page.evaluate(() => localStorage.getItem('livehuddle:v2:guest-token')),
    ).toBeTruthy();
    expectNoPageErrors(pageErrors);
  });
});

// The editor header carries no apps menu over the new-document wizard: the product's links live in the Explorer
// panel's footer (docs/specs/013-workspace/explorer-structure.md "Layout").
test('the new-document wizard shows with no apps menu in the header', async ({
  page,
  pageErrors,
}) => {
  await page.goto('/new');
  await expect(page.locator('[data-new-mode="workshop"]')).toBeVisible();
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
  // The wizard created a real document and routed to it.
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
// The bug it guards: the bottom-right cluster gained the Session strip (Timer, Vote, Poll), and at
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
    // The strip is Workshop's (docs/specs/012-collaboration/workshop-mode.md), so a Blank Space.
    await openBlankSession(page);

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
