import { expect, serverNewUrl, test } from './fixtures';

// A create whose content step fails opens the document on Retry, and the document survives a reload
// (docs/specs/007-editor/new-document-route.md "Retry"; Work Tracker 456). The index makes the item first and liveknowledge's api its
// content under ids the editor minted: when the content's POST fails, Try again sends the same ids, the index
// answers 409 `item_exists` for an item that is the caller's own, and createOrResumeItem finishes the create from
// its edit grant. Take the resume out and the second index create stays a 409 the card cannot get past.
test('a failed create retries and opens the document, which survives a reload', async ({
  page,
}) => {
  const contentCreates = '**/api/documents';
  let contentRefusals = 0;
  await page.route(contentCreates, (route) => {
    if (route.request().method() !== 'POST' || contentRefusals > 0) return route.continue();
    contentRefusals += 1;
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'e2e_create_refused' }),
    });
  });
  const indexCreates: number[] = [];
  page.on('response', (r) => {
    if (r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/api/index/items'))
      indexCreates.push(r.status());
  });

  await page.goto(await serverNewUrl(page, '/new?blank=1'));
  const retry = page.getByRole('button', { name: 'Try again' });
  await retry.waitFor({ timeout: 30_000 });
  expect(contentRefusals).toBe(1);

  await retry.click();
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  const opened = new URL(page.url()).pathname;
  // The first create made the item (2xx); the Retry's was told it exists (409) and resumed from the grant.
  expect(indexCreates.length).toBe(2);
  expect(indexCreates[0]).toBeLessThan(300);
  expect(indexCreates[1]).toBe(409);
  expect(contentRefusals).toBe(1);

  await page.reload();
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe(opened);
});
