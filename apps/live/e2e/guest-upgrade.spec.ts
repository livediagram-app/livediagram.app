import { test, expect, expectNoPageErrors } from './fixtures';

// A fresh guest's documents move to a signed id moments after the first one is created. A reload
// can land after the worker moved them but before the browser kept the new id; the next load must
// resume that upgrade, never mint another id and lock the guest out of their own document
// (docs/specs/014-identity/auth-and-guest-access.md, "An interrupted upgrade resumes").
test('a reload in the middle of the signed-id upgrade keeps the document', async ({
  page,
  pageErrors,
}) => {
  let moved!: () => void;
  const movedOnServer = new Promise<void>((resolve) => (moved = resolve));
  // Let the worker do the move, then never hand the answer to the page.
  await page.route('**/api/migrate', async (route) => {
    await route.fetch();
    moved();
  });
  await page.goto('/new');
  await page
    .getByRole('button', { name: /Just Draw/i })
    .first()
    .click();
  await page.waitForURL(/\/document\//);
  const id = /\/document\/([^/?#]+)/.exec(page.url())![1];
  await movedOnServer;
  await page.unroute('**/api/migrate');

  const refused: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes(`/api/documents/${id}`) && r.status() === 403) refused.push(r.url());
  });
  await page.reload();
  const load = await page.waitForResponse(
    (r) => r.url().endsWith(`/api/documents/${id}`) && r.request().method() === 'GET',
  );
  expect(load.status()).toBe(200);
  await page.waitForLoadState('networkidle');
  expect(refused).toEqual([]);
  expectNoPageErrors(pageErrors);
});
