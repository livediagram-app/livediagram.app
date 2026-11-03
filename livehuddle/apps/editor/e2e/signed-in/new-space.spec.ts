import { expect, expectNoPageErrors, test, untilHydrated } from '../fixtures';
import { freshUserId, installSession } from './session';

// The New Space wizard signed in (docs/specs/007-editor/new-document-route.md "One-step wizard", issue #330): the body
// names the Blank Space, the Sync switch starts on (a signed-in person's default is livehuddle), and Create makes the
// Space on the server with no error card.

test.use({ viewport: { width: 1280, height: 800 } });

test('signed in, Create makes the Space on the server', async ({ page, pageErrors }) => {
  const id = freshUserId('newspace');
  await installSession(page, {
    id,
    firstName: 'Nia',
    lastName: 'Space',
    email: `${id}@example.com`,
  });
  await page.goto('/new');
  const create = page.getByRole('button', { name: 'Create', exact: true });
  await untilHydrated(create);
  await expect(page.getByRole('region', { name: 'Blank Space' })).toBeVisible();
  await expect(page.getByRole('switch', { name: /Sync Space to Server/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  const created = page.waitForResponse(
    (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/documents',
  );
  await create.click();
  expect((await created).ok()).toBe(true);
  await expect(page).toHaveURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await expect(page.getByText(/Couldn.t create the space/)).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
