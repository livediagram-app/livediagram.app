import {
  test,
  expect,
  expectNoPageErrors,
  adoptGuest,
  mintGuest,
  seedDocumentItem,
} from './fixtures';

// Tab-scoped share links (docs/specs/013-workspace/tab-scoped-share-links.md), end to end: the owner scopes a
// link to one tab in the Share dialog; a visitor on it sees that tab, the rest
// as "Not shared" pills, and not one byte of the other tabs in any response or
// realtime frame; rescoping to All tabs reloads the visitor into every tab.

const SECRET = 'TOP SECRET PRICING';

test('a tab-scoped link opens its tab and nothing else', async ({ page, browser }) => {
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
    name: 'Launch plan',
    tabs: [
      { id: pricing, name: 'Pricing', elements: [box('p1', 200, SECRET)] },
      { id: roadmap, name: 'Roadmap', elements: [box('r1', 200, 'Q3 beta')] },
      { id: hiring, name: 'Hiring', elements: [] },
    ],
  });
  expect(seeded.ok()).toBe(true);

  // The owner scopes a new link to Roadmap.
  await adoptGuest(page, owner);
  await page.addInitScript(() => localStorage.setItem('livediagram:v2:name-confirmed', '1'));
  await page.goto(`/document/${liveDoc}`);
  await page.getByRole('button', { name: /^Share$/ }).click();
  // The shared Share dialog (@liveworkspace/explorer): issue a pass for one tab, then each pass with its own scope.
  const dialog = page.getByRole('dialog', { name: /^Share / });
  await dialog
    .getByRole('combobox', { name: 'Tabs this link opens' })
    .selectOption({ label: 'Roadmap' });
  await dialog.getByRole('button', { name: 'Create Pass' }).click();
  const pass = dialog.locator('[data-share-link]').first();
  const scopeSelect = pass.getByRole('combobox', { name: 'Tabs this pass opens' });
  await expect(scopeSelect).toHaveValue(roadmap);
  const url = await pass.getByRole('textbox', { name: 'Pass link' }).inputValue();

  // A visitor opens it, with every response and frame watched.
  const visitorContext = await browser.newContext();
  await visitorContext.addInitScript(() =>
    localStorage.setItem('livediagram:v2:name-confirmed', '1'),
  );
  const visitor = await visitorContext.newPage();
  const leaks: string[] = [];
  visitor.on('response', async (res) => {
    const body = await res.text().catch(() => '');
    // The app's own bundles are public and the same for everyone; the template catalogue in them writes "Pricing"
    // (a sitemap page, a sankey stage, a wireframe link), so only the tab's secret is looked for there.
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
  await expect(visitor.getByRole('button', { name: 'Not shared' })).toHaveCount(2);
  await expect(visitor.getByRole('button', { name: /Roadmap/ })).toBeVisible();
  await expect(visitor.getByText('Pricing')).toHaveCount(0);
  expect(leaks).toEqual([]);

  // Widening the link reloads the visitor into every tab.
  await scopeSelect.selectOption({ label: 'All tabs' });
  await expect(visitor.getByRole('button', { name: /Pricing/ })).toBeVisible({ timeout: 15_000 });
  await expect(visitor.getByRole('button', { name: 'Not shared' })).toHaveCount(0);

  await visitorContext.close();
});

test('the owner is never scoped', async ({ page, pageErrors }) => {
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await expect(page.getByRole('button', { name: 'Not shared' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
