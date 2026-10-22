import type { Page } from '@playwright/test';
import { apiBase, darkVisitor } from './audit-screens';
import { expect, expectNoPageErrors, mintSignedGuest, ownerHeaders, test } from './fixtures';

// A move that fails says so (docs/specs/013-workspace/folders.md "A move that fails says so"): the api
// refuses a folder move, and the Explorer shows the error toast and leaves the folder where it was.

async function seedFolder(page: Page, owner: string, origin: string, name: string) {
  const res = await page.request.post(`${apiBase}/folders`, {
    headers: ownerHeaders(owner, { Origin: origin, 'Content-Type': 'application/json' }),
    data: { id: crypto.randomUUID(), name },
  });
  expect(res.ok(), `seeding a folder failed: ${res.status()}`).toBe(true);
}

test('a folder move the api refuses says so', async ({ page, pageErrors, baseURL }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const owner = await mintSignedGuest(page.request);
  await darkVisitor(page, owner);
  const origin = new URL(baseURL!).origin;
  await seedFolder(page, owner, origin, 'Archive');
  await seedFolder(page, owner, origin, 'Projects');

  await page.goto('/explorer/all');
  await page.getByRole('button', { name: 'Menu for Projects' }).click();
  await page.getByRole('menu').last().getByText('Change Folder', { exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Move to folder' });
  await dialog.getByRole('radio', { name: /^My Work/ }).click();
  await dialog.getByRole('radio', { name: /^Archive/ }).click();

  const moves: string[] = [];
  page.on('console', (message) => {
    if (message.text().startsWith('[explorer-move]')) moves.push(message.text());
  });
  await page.route('**/api/folders/*', (route) =>
    route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, body: '{"error":"unavailable"}' })
      : route.fallback(),
  );
  await dialog.getByRole('button', { name: 'Move Here' }).click();

  await expect(page.getByText('Could not move “Projects”. Try again.')).toBeVisible();
  await expect
    .poll(() => moves)
    .toEqual([expect.stringMatching(/^\[explorer-move\] folder failed folder=/)]);
  // Still at the root, beside Archive.
  await expect(page.getByRole('button', { name: 'Menu for Projects' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
