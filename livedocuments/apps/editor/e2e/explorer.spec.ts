import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';

// The shared Explorer (@liveworkspace/explorer, liveworkspace/docs/one-explorer.md) as livedocuments hosts it at
// /explorer: everything it lists is the index's, reached through /api/index on this origin. One guest, one plan,
// every verb a person uses on it: make it, rename it, open it, find it in Recent, star it, file it in a new folder,
// delete it and restore it.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Sections' });

async function showView(page: Page, name: string): Promise<void> {
  await sidebar(page).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

const row = (page: Page, title: string) =>
  page.locator('main').getByRole('link', { name: title, exact: true });

async function rowAction(page: Page, title: string, action: string): Promise<void> {
  await page.getByRole('button', { name: `Menu for ${title}`, exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

test('a guest makes, renames, opens, stars, files, deletes and restores a plan', async ({
  page,
  pageErrors,
}) => {
  // New Plan from the Explorer goes through /new, which makes the plan at the index and opens it.
  await page.goto('/explorer');
  await page.getByRole('button', { name: 'New Plan' }).first().click();
  await page.waitForURL(/\/document\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  const id = new URL(page.url()).pathname.split('/').pop()!;

  // It is listed in My Work, under the name the editor gave it.
  await page.goto('/explorer');
  await showView(page, 'My Work');
  const made = page.locator(`main a[href^="/document/${id}"]`);
  await expect(made).toBeVisible();
  const firstTitle = (await made.innerText()).trim();

  // Rename, in place.
  await rowAction(page, firstTitle, 'Rename');
  const input = page.getByRole('textbox', { name: `Rename ${firstTitle}` });
  await input.fill('Roadmap');
  await input.press('Enter');
  await expect(row(page, 'Roadmap')).toBeVisible();

  // Open: the row is the plan's address in the editor.
  await row(page, 'Roadmap').click();
  await page.waitForURL(new RegExp(`/document/${id}`));
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });

  // The open is recorded, so it is in Recent.
  await page.goto('/explorer');
  await showView(page, 'Recent');
  await expect(row(page, 'Roadmap')).toBeVisible();

  // Star it: Favourites lists it.
  await rowAction(page, 'Roadmap', 'Add to Favourites');
  await showView(page, 'Favourites');
  await expect(row(page, 'Roadmap')).toBeVisible();

  // File it in a new folder, made from the move dialog.
  await showView(page, 'My Work');
  await rowAction(page, 'Roadmap', 'Change Folder');
  const move = page.getByRole('dialog', { name: 'Move to folder' });
  await move.getByRole('button', { name: /^New Folder/ }).click();
  await move.getByRole('textbox', { name: 'New folder name' }).fill('Q3');
  await move.getByRole('button', { name: 'Create', exact: true }).click();
  await move.getByRole('button', { name: /^Q3/ }).first().click();
  await move.getByRole('button', { name: 'Move Here' }).click();
  await expect(move).toBeHidden();
  await expect(row(page, 'Roadmap')).toBeHidden();
  await page.locator('main').getByText('Q3', { exact: true }).first().click();
  await expect(row(page, 'Roadmap')).toBeVisible();

  // Delete it: it goes to the Trash, and Restore brings it back.
  await rowAction(page, 'Roadmap', 'Delete Plan');
  await expect(row(page, 'Roadmap')).toBeHidden();
  await showView(page, 'Trash');
  await expect(page.locator('main').getByText('Roadmap', { exact: true })).toBeVisible();
  await rowAction(page, 'Roadmap', 'Restore');
  await expect(page.locator('main').getByText('Roadmap', { exact: true })).toBeHidden();
  await showView(page, 'Recent');
  await expect(row(page, 'Roadmap')).toBeVisible();

  expectNoPageErrors(pageErrors);
});

// The Explorer lists what the index holds for the person, not only plans: the Show switch widens it to every app.
test('the Explorer offers every app’s items, plans first', async ({ page, pageErrors }) => {
  await page.goto('/explorer');
  const show = page.getByRole('group', { name: 'Show' });
  await expect(show.getByRole('button', { name: 'Plans' })).toHaveAttribute('aria-pressed', 'true');
  await show.getByRole('button', { name: 'All' }).click();
  await expect(show.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  expectNoPageErrors(pageErrors);
});
