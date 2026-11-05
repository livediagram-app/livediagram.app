import { expect, expectNoPageErrors, test } from '../fixtures';
import { freshUserId, installSession } from './session';

// /new signed in (docs/specs/007-editor/new-document-route.md "No welcome screen", issue #330): the Space is made on
// the server at once (a signed-in person's default is livehuddle), with no error card, and opens on Start a Space with
// its Sync switch on.

test.use({ viewport: { width: 1280, height: 800 } });

test('signed in, /new makes the Space on the server', async ({ page, pageErrors }) => {
  const id = freshUserId('newspace');
  await installSession(page, {
    id,
    firstName: 'Nia',
    lastName: 'Space',
    email: `${id}@example.com`,
  });
  const created = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/documents',
  );
  await page.goto('/new');
  expect((await created).ok()).toBe(true);
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect(page.getByText(/Couldn.t create the space/)).toHaveCount(0);
  const start = page.getByRole('region', { name: /^Start a Space$/ });
  await expect(start.getByRole('switch', { name: /Sync Space to Server/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expectNoPageErrors(pageErrors);
});
