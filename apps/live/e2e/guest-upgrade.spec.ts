import { test, expect, expectNoPageErrors } from './fixtures';

// A legacy guest (an unsigned id from before signing, docs/specs/014-identity/auth-and-guest-access.md
// "Legacy upgrade") moves its documents to a signed id on its next editor load. A reload can land
// after the worker moved them but before the browser kept the new id; the next load must resume that
// upgrade, never mint another id and lock the guest out of their own document ("An interrupted
// upgrade resumes"). A first-time guest is signed from the start and never upgrades, so the legacy
// guest is set up here: an unsigned id in this browser that already owns a document.
test('a reload in the middle of the signed-id upgrade keeps the document', async ({
  page,
  pageErrors,
}) => {
  const legacyId = crypto.randomUUID();
  const id = crypto.randomUUID();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
  // The stack leaves enforcement off, so an unsigned guest can still create, as before signing.
  const created = await page.request.post(`${apiBase}/documents`, {
    headers: { 'X-Owner-Id': legacyId },
    data: {
      id,
      name: 'Legacy board',
      tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
    },
  });
  expect(created.ok(), 'seeding the legacy guest’s document').toBe(true);
  // The legacy id in this browser, set once (not an init script, which a reload would replay).
  await page.goto('/robots.txt').catch(() => undefined);
  await page.evaluate((owner) => {
    localStorage.setItem('livediagram:v2:self-id', owner);
    localStorage.removeItem('livediagram:v2:self-sig');
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
  }, legacyId);

  let moved!: () => void;
  const movedOnServer = new Promise<void>((resolve) => (moved = resolve));
  // Let the worker do the move, then never hand the answer to the page.
  await page.route('**/api/migrate', async (route) => {
    await route.fetch();
    moved();
  });
  await page.goto(`/document/${id}`);
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
