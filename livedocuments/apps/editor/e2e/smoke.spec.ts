import {
  onPage,
  test,
  expect,
  createDocument,
  dismissQuickTour,
  expectNoPageErrors,
  openStartBlank,
  openBlankPage,
  paletteTile,
} from './fixtures';

// End-to-end smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Small by design: it answers "does
// the app boot and take input without crashing", the layer the unit
// tests can't reach. Every test also fails on any uncaught page error
// (the `pageErrors` fixture).

// `/new` asks nothing: it makes a document as it mounts and opens it on its start, where the templates are
// (docs/specs/007-editor/new-document-route.md, start-diagramming.md). A guest's lives in This Browser
// (docs/specs/006-document/save-locations.md "The default depends on who is creating"): listed in this browser's
// list for the Explorer, and badged so in the header.
test('/new makes a guest’s document in This Browser and opens it on its start', async ({
  page,
  pageErrors,
}) => {
  const id = await createDocument(page);
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/);
  await expect(page.getByRole('region', { name: /^Start / })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          (
            (JSON.parse(localStorage.getItem(key) ?? '{}') as { items?: { id: string }[] }).items ??
            []
          ).map((i) => i.id),
        'liveworkspace:this-browser:livedocuments',
      ),
    )
    .toContain(id);
  await expect(page.getByLabel('This Browser', { exact: true }).first()).toBeVisible();
  expectNoPageErrors(pageErrors);
});

// The first visit itself (docs/specs/003-system-architecture/e2e-smoke.md "Every test opens as a returning guest"):
// every other test opens as a guest who holds a token, and a browser with none leaves /new for the guest handoff and
// comes back holding one, then makes its document. Nothing is checked on the page until the round trip is back.
test.describe('a first visit', () => {
  test.use({ freshVisitor: true });

  test('goes through the guest handoff and comes back to make a document with a guest token', async ({
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
    await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole('region', { name: /^Start / })).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem('livedocuments:v2:guest-token')),
    ).toBeTruthy();
    expectNoPageErrors(pageErrors);
  });
});

// The editor header carries no apps menu (docs/specs/007-editor/editor-app.md "Header"): its logo is a plain link with
// no site switcher (that stays on the Explorer and landing pages), and the product's own links (Home, Explorer, Help)
// live in the Explorer panel's footer (docs/specs/013-workspace/explorer-structure.md "Layout"), never in the header.
test('the editor header has a plain logo, with no site switcher or apps menu', async ({
  page,
  pageErrors,
}) => {
  await openStartBlank(page);
  const header = page.locator('header[data-region="header"]');
  await expect(header).toBeVisible();
  await expect(header.getByRole('link', { name: 'livedocuments' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Switch site' })).toHaveCount(0);
  // The product's links (ProductNavLinks, a "Go to" navigation) are the Explorer panel's, not the header's.
  await expect(header.getByRole('navigation', { name: 'Go to' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('create a blank document, add a shape, and it survives a reload', async ({
  page,
  pageErrors,
}) => {
  await openBlankPage(page);
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
  const square = page.getByRole('img', { name: 'Square', exact: true });
  await (await paletteTile(page, 'Add Square')).click();
  await canvas.click({ position: await onPage(page, 0.3, 0.25) });
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
