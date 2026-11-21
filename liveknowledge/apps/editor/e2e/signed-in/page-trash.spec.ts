import { expect, expectNoPageErrors, test } from '../fixtures';
import {
  addSubpage,
  nameOpenPage,
  pageTree,
  rowVerb,
  saveAndGoOn,
  treeShape,
} from '../knowledgebase';
import { signedInKnowledgebase } from './knowledge-session';

// The page Trash (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page Trash"; blueprint page-tree.md
// "The page Trash"), signed in: a delete moves the page and its subpages to the Trash, the row above New Page counts
// them, the dialog lists them, and Restore puts them back where they were. Each is kept by the room, so each is read
// again after a reload.

test.use({ viewport: { width: 1440, height: 860 } });

const trashRow = (page: import('@playwright/test').Page) => page.locator('[data-page-trash-row]');

test('a deleted page waits in the Trash, and Restore puts it back with its subpages', async ({
  page,
  pageErrors,
}) => {
  await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Guides');
  await addSubpage(page, 'Guides', 'Setup');
  await saveAndGoOn(page);
  await expect(trashRow(page)).toHaveAccessibleName('Trash, empty');

  await rowVerb(page, 'Guides', 'Delete');
  const confirm = page.getByRole('dialog', { name: 'Move Guides and 1 Subpage to the Trash?' });
  await expect(confirm).toContainText('restore them from the Trash for 30 days');
  await confirm.getByRole('button', { name: 'Move to Trash', exact: true }).click();
  await expect(confirm).toBeHidden();
  expect(await treeShape(page)).not.toContain('1 Guides');

  // The row counts the page and its subpage once the delete has landed, and keeps them across a reload.
  await expect(trashRow(page)).toHaveAccessibleName('Trash, 2 pages', { timeout: 15_000 });
  await page.reload();
  await expect(trashRow(page)).toHaveAccessibleName('Trash, 2 pages', { timeout: 15_000 });

  await trashRow(page).click();
  const trash = page.getByRole('dialog', { name: 'Trash' });
  await expect(trash).toContainText('Guides');
  await expect(trash).toContainText('and 1 Subpage');
  await expect(trash).toContainText('30 days left');
  await trash.getByRole('button', { name: 'Restore Guides' }).click();
  await expect(trash).toContainText('No Pages in the Trash');
  await trash.getByRole('button', { name: 'Close' }).click();

  await expect(pageTree(page).getByRole('treeitem', { name: /Guides/ })).toBeVisible();
  await expect.poll(() => treeShape(page)).toContain('2 Setup');
  await expect(trashRow(page)).toHaveAccessibleName('Trash, empty');
  expectNoPageErrors(pageErrors);
});
