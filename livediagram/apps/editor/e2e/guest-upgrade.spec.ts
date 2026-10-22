import { test, expect, expectNoPageErrors, pageOwnerHeaders } from './fixtures';

// A legacy guest (an unsigned id from before this deployment signed anything) moves onto a signed id
// the first time it opens the app. A reload can land after the worker moved its data but before the
// browser kept the new id; the next load must resume that upgrade, never mint another id and lock
// the guest out of their own data (docs/specs/014-identity/auth-and-guest-access.md, "An interrupted
// upgrade resumes"). The stack enforces guest signatures, so this is also the legacy exception at
// work: only such an id may still upgrade unsigned (docs/specs/015-api/public-api-and-tokens.md §6).
test('a reload in the middle of the signed-id upgrade keeps the legacy guest’s data', async ({
  page,
  pageErrors,
}) => {
  // The api cannot make a legacy guest under enforcement, so the stack writes one.
  const seeded = await page.request.post('/__e2e/legacy-guest');
  expect(seeded.ok()).toBe(true);
  const legacy = (await seeded.json()) as { ownerId: string; folderName: string };
  // The legacy id in this browser, set before the first load only: the guard lives in
  // sessionStorage, which later loads keep, so they see whatever the upgrade left.
  await page.addInitScript((id) => {
    if (sessionStorage.getItem('e2e:legacy-seeded')) return;
    sessionStorage.setItem('e2e:legacy-seeded', '1');
    localStorage.setItem('livediagram:v2:self-id', id);
    localStorage.removeItem('livediagram:v2:self-sig');
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
  }, legacy.ownerId);

  let moved!: () => void;
  const movedOnServer = new Promise<void>((resolve) => (moved = resolve));
  // Let the worker do the move, then never hand the answer to the page.
  await page.route('**/api/migrate', async (route) => {
    await route.fetch();
    moved();
  });
  await page.goto('/explorer');
  await movedOnServer;
  await page.unroute('**/api/migrate');

  // The resumed move is refused (403): the legacy id's participant row went with the first move, so
  // it no longer counts as legacy. The browser then adopts the signed id it recorded, which already
  // holds the data ("A refused upgrade adopts the signed id"). Any other refusal is a failure.
  const refused: string[] = [];
  page.on('response', (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api/') && path !== '/api/migrate' && [401, 403].includes(r.status())) {
      refused.push(path);
    }
  });
  await page.reload();
  // The resumed upgrade adopts the signed id it recorded before the move.
  await expect
    .poll(() =>
      page.evaluate(() => ({
        id: localStorage.getItem('livediagram:v2:self-id'),
        signed: Boolean(localStorage.getItem('livediagram:v2:self-sig')),
      })),
    )
    .toEqual({ id: expect.not.stringMatching(legacy.ownerId), signed: true });
  await page.waitForLoadState('networkidle');

  const headers = await pageOwnerHeaders(page);
  const folders = await page.evaluate(async (headers) => {
    const res = await fetch('/api/folders', { headers });
    return ((await res.json()) as { folders: { name: string }[] }).folders.map((f) => f.name);
  }, headers);
  expect(folders).toEqual([legacy.folderName]);
  expect(refused).toEqual([]);
  expectNoPageErrors(pageErrors);
});
