import { expect, expectNoPageErrors, test } from './fixtures';
import {
  addPage,
  expectKeptOffline,
  nameOpenPage,
  newKnowledgebase,
  pageRow,
  rowVerb,
  titleOf,
  treeShape,
} from './knowledgebase';

// A page's Title is its name (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Name"; blueprints/
// page-tree.md): typing in the Title renames the page in the tree as each key lands, renaming the page in the tree
// rewrites the Title, and a Title emptied leaves the page "Untitled Page".

test('the Title names the page as it is typed, and a rename in the tree rewrites the Title', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await nameOpenPage(page, 'Handbook');
  await addPage(page, 'Expenses');

  // Each key shows in the tree before the writing commits (it waits for the typing to pause).
  await page.keyboard.type(' Policy', { delay: 40 });
  await expect(pageRow(page, 'Expenses Policy')).toBeVisible({ timeout: 500 });
  expect(await treeShape(page)).toEqual(['1 Handbook', '1 Expenses Policy']);

  // Renamed in the tree: the Title says so.
  await rowVerb(page, 'Expenses Policy', 'Rename');
  const field = page.getByRole('textbox', { name: 'Page name' });
  await field.fill('Travel and Expenses');
  await field.press('Enter');
  await expect(titleOf(page)).toHaveText('Travel and Expenses');
  await expect(pageRow(page, 'Travel and Expenses')).toBeVisible();

  // Emptied, the Title leaves the page unnamed.
  await titleOf(page).click();
  await page.keyboard.press('End');
  for (const _ of 'Travel and Expenses') await page.keyboard.press('Backspace');
  await expect(pageRow(page, 'Untitled Page')).toBeVisible();
  await page.keyboard.type('Travel');
  await expect(pageRow(page, 'Travel')).toBeVisible();

  // Kept: the stored name is the Title.
  await expectKeptOffline(page, 'Travel');
  await page.reload();
  await titleOf(page).waitFor();
  await expect(titleOf(page)).toHaveText('Travel');
  expect(await treeShape(page)).toEqual(['1 Handbook', '1 Travel']);
  expectNoPageErrors(pageErrors);
});
