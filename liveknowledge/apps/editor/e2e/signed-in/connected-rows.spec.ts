import { expect, expectNoPageErrors, ownerHeaders, test } from '../fixtures';
import { pageTree } from '../knowledgebase';
import { signedInKnowledgebase } from './knowledge-session';

// Connected files in the sidebar (docs/specs/030-knowledgebase/links-and-embeds.md "Connected files in the sidebar"),
// signed in: a liveplanner plan of the same account is connected from the sidebar foot's Add to Sidebar menu, shows
// in the page tree as a row with the arrow-out mark, opens in a new browser tab at the plan's address (never as the
// open page), and Remove from Sidebar takes it away at once.

test.use({ viewport: { width: 1440, height: 860 } });

test('a connected file sits in the page tree and opens in a new tab', async ({
  page,
  pageErrors,
}) => {
  const { who } = await signedInKnowledgebase(page);
  // A plan of the same account, in the index, for the picker to list.
  const made = await page.request.post('/api/index/items', {
    headers: ownerHeaders(who.id, {
      Origin: new URL(page.url()).origin,
      'Content-Type': 'application/json',
    }),
    data: { app: 'liveplanner', title: 'Launch Plan' },
  });
  expect(made.ok(), `the plan: ${made.status()}`).toBe(true);
  const planId = ((await made.json()) as { item: { id: string } }).item.id;
  // Opened, so it is among the person's Recent files, where the picker looks.
  const opened = await page.request.post(`/api/index/items/${planId}/open`, {
    headers: ownerHeaders(who.id, { Origin: new URL(page.url()).origin }),
  });
  expect(opened.ok(), `the open: ${opened.status()}`).toBe(true);

  await page.getByRole('button', { name: 'Add to Sidebar' }).click();
  await page.getByRole('menuitem', { name: 'Connect File' }).click();
  const dialog = page.getByRole('dialog', { name: 'Connect File' });
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole('button', { name: /Launch Plan/ })
    .first()
    .click();
  await expect(dialog).toHaveCount(0);

  const row = pageTree(page).getByRole('treeitem', { name: /^Launch Plan, liveplanner/ });
  await expect(row).toBeVisible();
  // Where it leads, asked of the index once the row is drawn: a real link, so the browser opens it itself.
  await expect(row).toHaveAttribute('href', new RegExp(planId));
  await expect(row).toHaveAttribute('target', '_blank');
  const openPageBefore = page.url();
  // liveplanner is not part of this stack: the plan's address answers a stand-in page, so the new tab lands on it
  // rather than on the browser's error page.
  await page.context().route(new RegExp(`/project/${planId}`), (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><title>Launch Plan</title>',
    }),
  );
  // `noopener`: the new tab has no handle back, so it is the context's new page rather than this page's popup.
  const popup = page.context().waitForEvent('page');
  await row.click();
  const plan = await popup;
  expect(plan.url()).toContain(planId);
  await plan.close();
  // Never the open page.
  expect(page.url()).toBe(openPageBefore);

  // Kept by the room: there after a reload.
  await page.reload();
  await expect(row).toBeVisible();

  await row.hover();
  await row.getByRole('button', { name: 'File Options for Launch Plan' }).click();
  await page.getByRole('menuitem', { name: 'Remove from Sidebar' }).click();
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(pageTree(page).getByRole('treeitem').first()).toBeVisible();
  await expect(row).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
