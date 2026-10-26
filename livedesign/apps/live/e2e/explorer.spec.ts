import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';

// The shared Explorer (@liveworkspace/explorer, liveworkspace/docs/specs/004-index/one-explorer.md) as livedesign hosts it at
// /explorer: what it lists is the index's, reached through /api/index on this origin, beside this browser's own
// designs (This Browser). One guest, one design, every verb a person uses on it: make it (in This Browser, a guest's
// default), sync it to livedesign, rename it, open it, find it in Recent, star it, file it in a new folder, delete it
// and restore it.

const sidebar = (page: Page) => page.getByRole('navigation', { name: 'Sections' });

async function showView(page: Page, name: string): Promise<void> {
  await sidebar(page).getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

const thisBrowserList = (page: Page) =>
  page.evaluate(
    (key) =>
      (
        (JSON.parse(localStorage.getItem(key) ?? '{}') as { items?: { id: string }[] }).items ?? []
      ).map((i) => i.id),
    'liveworkspace:this-browser:livedesign',
  );

const row = (page: Page, title: string) =>
  page.locator('main').getByRole('link', { name: title, exact: true });

async function rowAction(page: Page, title: string, action: string): Promise<void> {
  await page.getByRole('button', { name: `Menu for ${title}`, exact: true }).click();
  await page.getByRole('menuitem', { name: action, exact: true }).click();
}

test('a guest makes, syncs, renames, opens, stars, files, deletes and restores a design', async ({
  page,
  pageErrors,
}) => {
  // A new guest's Explorer Home is a first run, so its hero is the welcome (liveworkspace/docs/specs/004-index/
  // one-explorer.md): its Start Blank goes through /new, which makes a guest's design in This Browser and opens it
  // (docs/specs/006-design/save-locations.md "The default depends on who is creating").
  await page.goto('/explorer');
  await page.getByRole('link', { name: 'Start Blank', exact: true }).first().click();
  await page.waitForURL(/\/design\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  const id = new URL(page.url()).pathname.split('/').pop()!;
  await expect.poll(() => thisBrowserList(page)).toContain(id);

  // The Explorer lists it under This Browser.
  await page.goto('/explorer');
  await sidebar(page)
    .getByRole('button', { name: /^This Browser/ })
    .click();
  await expect(page.locator(`[data-this-browser-row="${id}"]`)).toBeVisible();

  // Sharing needs it on livedesign: Share offers Sync Design first, which moves it there in place.
  await page.goto(`/design/${id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: /^Share$/ }).click();
  await page.getByRole('button', { name: 'Sync Design', exact: true }).click();
  await expect.poll(() => thisBrowserList(page), { timeout: 15_000 }).not.toContain(id);
  await page.keyboard.press('Escape');

  // It is listed in My Work, under the name the editor gave it.
  await page.goto('/explorer');
  await showView(page, 'My Work');
  const made = page.locator(`main a[href^="/design/${id}"]`);
  await expect(made).toBeVisible();
  const firstTitle = (await made.innerText()).trim();

  // Rename, in place.
  await rowAction(page, firstTitle, 'Rename');
  const input = page.getByRole('textbox', { name: `Rename ${firstTitle}` });
  await input.fill('Roadmap');
  await input.press('Enter');
  await expect(row(page, 'Roadmap')).toBeVisible();

  // Open: the row is the design's address in the editor.
  await row(page, 'Roadmap').click();
  await page.waitForURL(new RegExp(`/design/${id}`));
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
  await rowAction(page, 'Roadmap', 'Delete Design');
  await expect(row(page, 'Roadmap')).toBeHidden();
  await showView(page, 'Trash');
  await expect(page.locator('main').getByText('Roadmap', { exact: true })).toBeVisible();
  await rowAction(page, 'Roadmap', 'Restore');
  await expect(page.locator('main').getByText('Roadmap', { exact: true })).toBeHidden();
  await showView(page, 'Recent');
  await expect(row(page, 'Roadmap')).toBeVisible();

  expectNoPageErrors(pageErrors);
});

// The Explorer lists what the index holds for the person, not only designs: the Show switch widens it to every app.
test('the Explorer offers every app’s items, designs first', async ({ page, pageErrors }) => {
  // The switch heads a list's pane (My Work here); Home's hero has none.
  await page.goto('/explorer');
  await showView(page, 'My Work');
  const show = page.getByRole('group', { name: 'Show' });
  await expect(show.getByRole('button', { name: 'livedesign' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await show.getByRole('button', { name: 'All' }).click();
  await expect(show.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  expectNoPageErrors(pageErrors);
});
