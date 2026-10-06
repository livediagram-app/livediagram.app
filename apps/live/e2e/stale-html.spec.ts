import type { Page } from '@playwright/test';
import { expect, test, pageOwnerHeaders } from './fixtures';

// Stale HTML after a deploy (docs/specs/016-platform/stale-builds.md), the way people meet it: open
// the Explorer, open a document (a full page load), a deploy lands, press back. Back is a history
// traversal, for which browsers reuse a cached page even when it is stale, so the Explorer's page
// can come back naming chunk files the deploy removed: a white screen with its styles refused.
//
// Real browser caching throughout: no Playwright routes (they turn the HTTP cache off), and the e2e
// stack serves files with production's caching headers. The deploy is simulated by the stack
// (POST /__e2e/deploy): a copy of the build whose chunk files all carry new names. On staging the old
// page's chunks were no longer in the browser's cache (the console showed them answering 404), so
// while the Explorer first loads, the stack serves its build assets `no-store`
// (POST /__e2e/assets-out-of-cache, until the deploy): the browser keeps the page, not its chunks.

// A document of this guest's, listed at the root of the Explorer's My documents.
async function seedDocument(page: Page, name: string): Promise<string> {
  // The guest's signed id is minted asynchronously; seed under the final one.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('livediagram:v2:self-sig')))
    .toBeTruthy();
  const headers = await pageOwnerHeaders(page, { 'Content-Type': 'application/json' });
  return page.evaluate(
    async ({ docName, headers }) => {
      const id = crypto.randomUUID();
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id,
          name: docName,
          tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
        }),
      });
      if (!res.ok) throw new Error(`seeding failed: ${res.status}`);
      return id;
    },
    { docName: name, headers },
  );
}

// The suite runs in parallel: a simulated deploy is this context's alone, never the stack's.
test('a simulated deploy leaves every other browser context on its build', async ({
  page,
  request,
}) => {
  const chunkOf = (html: string) => /_next\/static\/chunks\/([\w-]+)\.js/.exec(html)?.[1];
  const before = chunkOf(await (await request.get('/explorer/recent')).text());
  expect(before).toBeTruthy();

  expect((await page.request.post('/__e2e/deploy')).ok()).toBe(true);

  expect(chunkOf(await (await page.request.get('/explorer/recent')).text())).toMatch(/-d\d+$/);
  expect(chunkOf(await (await request.get('/explorer/recent')).text())).toBe(before);
});

test('back after a deploy brings the Explorer back, never a white screen', async ({ page }) => {
  test.setTimeout(60_000);
  const refusedStyles: string[] = [];
  page.on('console', (m) => {
    if (/Refused to apply style|MIME type/i.test(m.text())) refusedStyles.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });

  expect((await page.request.post('/__e2e/assets-out-of-cache')).ok()).toBe(true);
  await page.goto('/explorer/all');
  // The Explorer drawn: its sidebar's Home row.
  const home = page
    .getByRole('navigation', { name: 'Explorer' })
    .first()
    .getByRole('treeitem', { name: /^Home/ });
  await expect(home).toBeVisible({ timeout: 30_000 });
  // The page's own colour, styles applied: an unstyled page would be transparent (white).
  const styled = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(styled).not.toBe('rgba(0, 0, 0, 0)');
  const id = await seedDocument(page, 'History board');
  await page.reload();
  const row = page.getByRole('link', { name: /History board/ }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });

  // Open the document: a full page load (a document route is never a client transition here).
  const opened = page.waitForRequest(
    (r) => r.resourceType() === 'document' && new URL(r.url()).pathname === `/document/${id}`,
  );
  await row.click();
  await opened;
  await expect(page.locator('[data-canvas-a11y-root]')).toBeVisible({ timeout: 30_000 });

  // A deploy lands: every chunk the Explorer's page named is gone.
  expect((await page.request.post('/__e2e/deploy')).ok()).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\/explorer\/all$/);
  await expect(home).toBeVisible({ timeout: 20_000 });
  // Its styles applied, as before the deploy: not an unstyled white page.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(styled);
  await page.screenshot({ path: test.info().outputPath('back-after-deploy.png') });
  expect(refusedStyles).toEqual([]);
});
