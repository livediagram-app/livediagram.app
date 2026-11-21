import { test, expect, expectNoPageErrors, openStartBlank } from './fixtures';
import {
  expectCaretInTitle,
  expectKeptOffline,
  newKnowledgebase,
  pageRow,
  paragraphs,
  titleOf,
  treeShape,
  writeLines,
} from './knowledgebase';

// End-to-end smoke suite (docs/specs/003-system-architecture/e2e-smoke.md). Small by design: it answers "does
// the app boot and take input without crashing", the layer the unit
// tests can't reach. Every test also fails on any uncaught page error
// (the `pageErrors` fixture).

// `/new` asks nothing: it makes a knowledgebase as it mounts and opens it on its one page, Start Here, the caret in
// its Title (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A knowledgebase"; new-document-route.md). A
// guest's is kept Offline (docs/specs/006-document/save-locations.md "The default depends on who is creating"):
// listed in this browser's list for the Explorer, and said on the Share button. `/new?blank=1` names the Blank Page
// template and opens the same way.
for (const url of ['/new', '/new?blank=1']) {
  test(`${url} makes a guest's knowledgebase kept Offline, open on Start Here with the caret in its Title`, async ({
    page,
    pageErrors,
  }) => {
    const id = await newKnowledgebase(page, url);
    expect(await treeShape(page)).toEqual(['1 Start Here']);
    await expect(pageRow(page, 'Start Here')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-knowledgebase-name]')).toHaveText('Untitled Knowledgebase');
    await expect(page.getByRole('button', { name: 'Share, Offline' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            (
              (JSON.parse(localStorage.getItem(key) ?? '{}') as { items?: { id: string }[] })
                .items ?? []
            ).map((i) => i.id),
          'liveworkspace:this-browser:liveknowledge',
        ),
      )
      .toContain(id);
    // No header bar, so no badge in one.
    await expect(page.locator('header[data-region="header"]')).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
}

// A page's Title names that page, never the knowledgebase ("A knowledgebase", "Name"): what is typed first is the
// page's name, the tree follows once the typing stops, and the knowledgebase keeps "Untitled Knowledgebase". What is
// written is kept in this browser, so it is there after a reload.
test('typing the Title renames the page, not the knowledgebase, and the writing survives a reload', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await page.keyboard.type('Release Process');
  await expect(pageRow(page, 'Release Process')).toBeVisible();
  expect(await treeShape(page)).toEqual(['1 Release Process']);
  await expect(page.locator('[data-knowledgebase-name]')).toHaveText('Untitled Knowledgebase');
  await expect(page).toHaveTitle(/^Untitled Knowledgebase \| Release Process \| /);

  // Enter leaves the Title for the first paragraph.
  await page.keyboard.press('Enter');
  await page.keyboard.type('Cut the branch on Tuesday.');
  await writeLines(page, 'Ship on Thursday.');
  await expect(paragraphs(page)).toHaveText(['Cut the branch on Tuesday.', 'Ship on Thursday.']);

  // Kept in this browser: the reload reads back what the store holds.
  await expectKeptOffline(page, 'Release Process', 'Ship on Thursday.');
  await page.reload();
  await titleOf(page).waitFor();
  await expect(paragraphs(page)).toHaveText(['Cut the branch on Tuesday.', 'Ship on Thursday.']);
  await expect(titleOf(page)).toHaveText('Release Process');
  await expect(pageRow(page, 'Release Process')).toBeVisible();
  await expect(page.locator('[data-knowledgebase-name]')).toHaveText('Untitled Knowledgebase');
  expectNoPageErrors(pageErrors);
});

// The first visit itself (docs/specs/003-system-architecture/e2e-smoke.md "Every test opens as a returning guest"):
// every other test opens as a guest who holds a token, and a browser with none leaves /new for the guest handoff and
// comes back holding one, then makes its document. Nothing is checked on the page until the round trip is back.
test.describe('a first visit', () => {
  test.use({ freshVisitor: true });

  test('goes through the guest handoff and comes back to make a knowledgebase with a guest token', async ({
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
    await expectCaretInTitle(page);
    expect(
      await page.evaluate(() => localStorage.getItem('liveknowledge:v2:guest-token')),
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
  // No header bar (experiment): the logo has a card of its own beside the menu card (MenuCardLogo).
  await expect(page.locator('header[data-region="header"]')).toHaveCount(0);
  const header = page.locator('[data-toolbar-menu]').locator('..');
  await expect(header.getByRole('link', { name: 'liveknowledge' })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Switch site' })).toHaveCount(0);
  // The product's links (ProductNavLinks, a "Go to" navigation) are the Explorer panel's, not the header's.
  await expect(header.getByRole('navigation', { name: 'Go to' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

// The one mobile test (docs/specs/003-system-architecture/e2e-smoke.md). Not a general phone suite: it guards a
// specific class of bug that a desktop-only run is structurally blind to —
// a popover that only OVERLAPS its host when the viewport is too narrow to
// put it alongside, and so only then has to win the stacking contest.
//
// The top row holds its buttons on screen in one row at phone width (docs/specs/030-knowledgebase/page-surface.md
// "The top row"). A desktop run is blind to it.
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

  test('the top row keeps its buttons on screen in one row', async ({ page, pageErrors }) => {
    await openStartBlank(page);

    // Every button of the row is inside the viewport: nothing pushed off either edge.
    const row = page.locator('[data-knowledge-top-row]');
    await expect(row.getByRole('button').first()).toBeVisible();
    const width = page.viewportSize()!.width;
    const boxes = await row.getByRole('button').evaluateAll((buttons) =>
      buttons
        .map((b) => b.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => ({ left: r.left, right: r.right, middle: (r.top + r.bottom) / 2 })),
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    // And the whole row is one row at phone width.
    expect(new Set(boxes.map((box) => Math.round(box.middle / 10))).size).toBe(1);

    expectNoPageErrors(pageErrors);
  });
});
