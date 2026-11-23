import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import { knowledgebaseId, newServerKnowledgebase } from './knowledgebase';

// Renaming a new knowledgebase (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The knowledgebase's menu";
// Work Tracker 1376): right after it is made, a two-word name typed at its name, or through Rename, is kept whole,
// saved, and is still its name after a reload. Typed at the open menu, "Team Handbook" used to be saved as "Handbook":
// "Team" spelled no row and the space pressed the focused Rename.

const nameButton = (page: Page) => page.locator('[data-knowledgebase-menu]');

/** The metadata save that names the knowledgebase `name`, answered. */
const savedAs = (page: Page, id: string, name: string) =>
  page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      new URL(r.url()).pathname === `/api/documents/${id}` &&
      (r.request().postData() ?? '').includes(JSON.stringify(name)) &&
      r.ok(),
  );

async function expectNamedAfterReload(page: Page, name: string): Promise<void> {
  await page.reload();
  await expect(nameButton(page)).toHaveText(name, { timeout: 30_000 });
  await expect(nameButton(page)).toHaveAttribute('aria-label', `${name}: Knowledgebase Menu`);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
});

test('a two-word name typed at the knowledgebase’s name right after it is made is kept whole', async ({
  page,
  pageErrors,
}) => {
  await newServerKnowledgebase(page);
  const id = knowledgebaseId(page);
  const saved = savedAs(page, id, 'Team Handbook');
  await nameButton(page).click();
  await expect(page.getByRole('menu', { name: 'Knowledgebase Menu' })).toBeVisible();
  // As a person types: no wait for the menu to take focus.
  await page.keyboard.type('Team Handbook', { delay: 40 });
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Knowledgebase name' })).toHaveCount(0);
  await expect(nameButton(page)).toHaveText('Team Handbook');
  await saved;
  await expectNamedAfterReload(page, 'Team Handbook');
  expectNoPageErrors(pageErrors);
});

test('Rename from the menu, right after the knowledgebase is made, keeps the new name through a reload', async ({
  page,
  pageErrors,
}) => {
  await newServerKnowledgebase(page);
  const id = knowledgebaseId(page);
  const saved = savedAs(page, id, 'Release Notes');
  await nameButton(page).click();
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const field = page.getByRole('textbox', { name: 'Knowledgebase name' });
  await expect(field).toBeFocused();
  // The field opens on the old name, all of it selected: typing replaces it.
  await page.keyboard.type('Release Notes', { delay: 40 });
  await page.keyboard.press('Enter');
  await expect(nameButton(page)).toHaveText('Release Notes');
  await saved;
  await expectNamedAfterReload(page, 'Release Notes');
  expectNoPageErrors(pageErrors);
});
