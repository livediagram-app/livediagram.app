import { apiBase, darkVisitor, seedDocument } from './audit-screens';
import { expect, expectNoPageErrors, test } from './fixtures';

// The Explorer asks only for snapshots that exist (docs/specs/006-document/document-snapshots.md, "An
// empty document is never asked for"): the list says which documents are empty, so their cards show
// the undrawn sketch at once and no thumbnail request (and no 404) reaches the console.

test('an empty document is never asked for its thumbnail; a drawn one is', async ({
  page,
  pageErrors,
  baseURL,
}) => {
  const owner = crypto.randomUUID();
  await darkVisitor(page, owner);
  const origin = new URL(baseURL!).origin;
  const drawn = await seedDocument(page, owner, origin);
  const empty = crypto.randomUUID();
  const created = await page.request.post(`${apiBase}/documents`, {
    headers: { 'X-Owner-Id': owner, Origin: origin },
    data: {
      id: empty,
      name: 'Nothing yet',
      tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
    },
  });
  expect(created.ok()).toBe(true);

  const asked: string[] = [];
  const missing: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/thumbnail')) asked.push(r.url());
  });
  page.on('response', (r) => {
    if (r.url().includes('/thumbnail') && r.status() === 404) missing.push(r.url());
  });

  await page.goto('/explorer/recent');
  await expect(page.getByText('Nothing yet', { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect.poll(() => asked.some((u) => u.includes(drawn)), { timeout: 15_000 }).toBe(true);

  expect(asked.filter((u) => u.includes(empty))).toEqual([]);
  expect(missing).toEqual([]);
  expectNoPageErrors(pageErrors);
});
