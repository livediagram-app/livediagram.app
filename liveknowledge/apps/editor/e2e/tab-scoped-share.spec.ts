import {
  test,
  expect,
  expectNoPageErrors,
  adoptGuest,
  mintGuest,
  seedDocumentItem,
} from './fixtures';
import { addPage, newServerKnowledgebase, pageTree } from './knowledgebase';

// Tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md), end to end: the owner scopes a
// pass to one page in the Share dialog; a visitor on it sees that page alone in the page tree, and not one byte of
// the other pages in any response or realtime frame; rescoping to All tabs reloads the visitor into every page.
//
// The Share dialog is the shared one, `@liveworkspace/explorer`'s ShareDialog (its roles and labels are pinned by
// packages/explorer/src/dialogs/ShareDialog.test.tsx): the composer's "Tabs this link opens" select and Create
// Pass, then each pass in the "Passes" region (an `li[data-share-link]`) with its "<Level> pass link" field and
// its "Tabs this pass opens" select, whose every-tab option reads "All tabs".

const SECRET = 'TOP SECRET PRICING';

test('a link scoped to one page opens that page and nothing else', async ({ page, browser }) => {
  const owner = await mintGuest(page.request);
  const liveDoc = crypto.randomUUID();
  const [pricing, roadmap, hiring] = [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  const box = (id: string, x: number, label: string) => ({
    id,
    type: 'shape',
    shape: 'rectangle',
    x,
    y: 160,
    width: 220,
    height: 110,
    label,
  });
  const seeded = await seedDocumentItem(page.request, owner, {
    id: liveDoc,
    name: 'Launch document',
    tabs: [
      { id: pricing, name: 'Pricing', elements: [box('p1', 200, SECRET)] },
      { id: roadmap, name: 'Roadmap', elements: [box('r1', 200, 'Q3 beta')] },
      { id: hiring, name: 'Hiring', elements: [] },
    ],
  });
  expect(seeded.ok()).toBe(true);

  // The owner scopes a new link to Roadmap.
  await adoptGuest(page, owner);
  await page.addInitScript(() => localStorage.setItem('liveknowledge:v2:name-confirmed', '1'));
  await page.goto(`/document/${liveDoc}`);
  await page.getByRole('button', { name: /^Share, / }).click();
  const dialog = page.getByRole('dialog', { name: 'Share Launch document' });
  await dialog
    .getByRole('region', { name: 'Issue a pass' })
    .getByRole('combobox', { name: 'Tabs this link opens' })
    .selectOption({ label: 'Roadmap' });
  await dialog.getByRole('button', { name: 'Create Pass' }).click();
  const link = dialog
    .getByRole('region', { name: /^Passes/ })
    .locator('[data-share-link]')
    .first();
  const scopeSelect = link.getByRole('combobox', { name: 'Tabs this pass opens' });
  await expect(scopeSelect).toHaveValue(roadmap);
  const url = (await link.getByRole('textbox', { name: /pass link$/ }).inputValue()).trim();

  // A visitor opens it, with every response and frame watched.
  const visitorContext = await browser.newContext();
  await visitorContext.addInitScript(() =>
    localStorage.setItem('liveknowledge:v2:name-confirmed', '1'),
  );
  const visitor = await visitorContext.newPage();
  const leaks: string[] = [];
  visitor.on('response', async (res) => {
    const body = await res.text().catch(() => '');
    // The app's own bundles are public and the same for everyone; the template catalogue in them writes "Pricing"
    // (a sitemap page, a sankey stage, a pricing layout), so only the tab's secret is looked for there.
    const bundle = new URL(res.url()).pathname.includes('/_next/static/');
    if (body.includes(SECRET) || (!bundle && body.includes('"Pricing"'))) leaks.push(res.url());
  });
  visitor.on('websocket', (ws) =>
    ws.on('framereceived', ({ payload }) => {
      const text = String(payload);
      if (text.includes(SECRET) || text.includes('"Pricing"'))
        leaks.push(`ws ${text.slice(0, 80)}`);
    }),
  );
  await visitor.goto(url);
  const canvas = visitor.locator('[data-canvas-a11y-root]');
  await expect(canvas.getByRole('img', { name: /Q3 beta/ })).toBeVisible();
  // The page tree names the one page the link opens, and no other.
  const tree = visitor.getByRole('tree', { name: 'Pages' });
  await expect(tree.getByRole('treeitem', { name: 'Roadmap', exact: true })).toBeVisible();
  await expect(visitor.getByText('Pricing')).toHaveCount(0);
  expect(leaks).toEqual([]);

  // Widening the link reloads the visitor into every page.
  await scopeSelect.selectOption({ label: 'All tabs' });
  await expect(tree.getByRole('treeitem', { name: 'Pricing', exact: true })).toBeVisible({
    timeout: 15_000,
  });

  await visitorContext.close();
});

test('the owner is never scoped', async ({ page, pageErrors }) => {
  // On liveknowledge: a knowledgebase kept Offline has no share links to scope.
  await newServerKnowledgebase(page);
  await addPage(page, 'Second');
  await expect(pageTree(page).getByRole('treeitem')).toHaveCount(2);
  expectNoPageErrors(pageErrors);
});
