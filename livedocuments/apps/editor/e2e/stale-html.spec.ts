import { expect, test } from './fixtures';

// Stale HTML after a deploy (docs/specs/016-platform/stale-builds.md), the way people meet it: open
// a page, open a document (a full page load), a deploy lands, press back. Back is a history
// traversal, for which browsers reuse a cached page even when it is stale, so the first page
// can come back naming chunk files the deploy removed: a white screen with its styles refused.
// The page here is This Browser (/offline), a page of the editor's own beside the document page.
//
// Real browser caching throughout: no Playwright routes (they turn the HTTP cache off), and the e2e
// stack serves files with production's caching headers. The deploy is simulated by the stack
// (POST /__e2e/deploy): a copy of the build whose chunk files all carry new names. On staging the old
// page's chunks were no longer in the browser's cache (the console showed them answering 404), so
// while the first page loads, the stack serves its build assets `no-store`
// (POST /__e2e/assets-out-of-cache, until the deploy): the browser keeps the page, not its chunks.

// The suite runs in parallel: a simulated deploy is this context's alone, never the stack's.
test('a simulated deploy leaves every other browser context on its build', async ({
  page,
  request,
}) => {
  const chunkOf = (html: string) => /_next\/static\/chunks\/([\w-]+)\.js/.exec(html)?.[1];
  const before = chunkOf(await (await request.get('/offline')).text());
  expect(before).toBeTruthy();

  expect((await page.request.post('/__e2e/deploy')).ok()).toBe(true);

  expect(chunkOf(await (await page.request.get('/offline')).text())).toMatch(/-d\d+$/);
  expect(chunkOf(await (await request.get('/offline')).text())).toBe(before);
});

test('back after a deploy brings the page back, never a white screen', async ({ page }) => {
  test.setTimeout(60_000);
  const refusedStyles: string[] = [];
  page.on('console', (m) => {
    if (/Refused to apply style|MIME type/i.test(m.text())) refusedStyles.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });

  expect((await page.request.post('/__e2e/assets-out-of-cache')).ok()).toBe(true);
  await page.goto('/offline');
  // The page drawn: its heading.
  const heading = page.getByRole('heading', { name: 'This Browser' });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  // The page's own colour, styles applied: an unstyled page would be transparent (white).
  const styled = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(styled).not.toBe('rgba(0, 0, 0, 0)');

  // Open a new document: a full page load.
  await page.goto('/new?blank=1');
  await page.waitForURL(/\/document\//, { timeout: 30_000 });
  await expect(page.locator('[data-canvas-a11y-root]')).toBeVisible({ timeout: 30_000 });
  // The document page done loading, as someone sees it before they press back: once it has rendered
  // and the page is idle, it fetches the code of the surfaces it loads on demand
  // (docs/specs/016-platform/web-performance.md), and a deploy landing mid-fetch would refuse that
  // code on the document page, not the first page's this test is about.
  await page.evaluate(
    () => new Promise((done) => requestIdleCallback(() => done(null), { timeout: 5_000 })),
  );
  await page.waitForLoadState('networkidle');

  // A deploy lands: every chunk the first page named is gone.
  expect((await page.request.post('/__e2e/deploy')).ok()).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\/offline$/);
  await expect(heading).toBeVisible({ timeout: 20_000 });
  // Its styles applied, as before the deploy: not an unstyled white page.
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe(styled);
  await page.screenshot({ path: test.info().outputPath('back-after-deploy.png') });
  expect(refusedStyles).toEqual([]);
});
