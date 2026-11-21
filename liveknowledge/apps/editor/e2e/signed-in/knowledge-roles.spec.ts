import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import {
  addPage,
  knowledgeResults,
  nameOpenPage,
  openRowMenu,
  pageRow,
  paragraphs,
  searchPanel,
  titleOf,
  treeShape,
  writeLines,
  writing,
} from '../knowledgebase';
import {
  person,
  savedWith,
  secondPerson,
  shareCode,
  signedInKnowledgebase,
} from './knowledge-session';

// Share roles in a knowledgebase (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Share roles"): a second
// person arrives through a share link at each role. A Viewer and a Participant read every page, follow the tree and
// search; neither writes on a page nor changes the tree. The room's own refusal of their writes is held by the
// api's role tests; this is what the editor offers them.

test.use({ viewport: { width: 1440, height: 860 } });

async function sharedKnowledgebase(owner: Page, role: 'view' | 'participate') {
  const { who, id } = await signedInKnowledgebase(owner);
  await nameOpenPage(owner, 'Handbook');
  const saved = savedWith(owner, 'Welcome to the team');
  await writeLines(owner, 'Welcome to the team.');
  await saved;
  // The second page's name is saved before anyone arrives to read the tree.
  const named = savedWith(owner, '"name":"Expenses"');
  await addPage(owner, 'Expenses');
  await named;
  return { id, code: await shareCode(owner, who, id, role) };
}

async function expectReadOnly(visitor: Page): Promise<void> {
  // Reads every page and follows the tree.
  expect(await treeShape(visitor)).toEqual(['1 Handbook', '1 Expenses']);
  await pageRow(visitor, 'Handbook').click();
  await expect(titleOf(visitor)).toHaveText('Handbook');
  await expect(paragraphs(visitor).filter({ hasText: 'Welcome to the team.' })).toBeVisible();

  // The writing takes no typing.
  await expect(writing(visitor)).toHaveAttribute('contenteditable', 'false');
  await paragraphs(visitor).filter({ hasText: 'Welcome to the team.' }).click();
  // Text sent as an input would send it, with no key presses: a reader's single keys are the canvas's shortcuts.
  await visitor.keyboard.insertText('XYZ');
  await expect(writing(visitor)).not.toContainText('XYZ');

  // The tree offers no way to change it: no New Page, no Add Subpage, no rename, and a menu of Copy Link alone.
  const sidebar = visitor.getByRole('complementary', { name: 'Pages' });
  await expect(sidebar.getByRole('button', { name: 'New Page' })).toHaveCount(0);
  const row = pageRow(visitor, 'Expenses');
  await row.hover();
  await expect(row.getByRole('button', { name: 'Add Subpage to Expenses' })).toHaveCount(0);
  await row.focus();
  await visitor.keyboard.press('F2');
  await expect(sidebar.getByRole('textbox', { name: 'Page name' })).toHaveCount(0);
  const menu = await openRowMenu(visitor, 'Expenses');
  await expect(menu.getByRole('menuitem')).toHaveText(['Copy Link']);
  await visitor.keyboard.press('Escape');

  // Search is every role's: the sidebar's field opens the search panel, this knowledgebase's results first.
  await visitor
    .getByRole('complementary', { name: 'Pages' })
    .getByRole('button', { name: 'Search' })
    .click();
  const panel = searchPanel(visitor);
  await panel.getByRole('combobox', { name: 'Search' }).fill('welcome team');
  const hit = knowledgeResults(panel).getByRole('option').filter({ hasText: 'Welcome to the' });
  await expect(hit).toBeVisible();
  await hit.click();
  await expect(panel).toBeHidden();
  await expect(titleOf(visitor)).toHaveText('Handbook');
}

test('a Viewer reads, follows the tree and searches, and cannot write or change the tree', async ({
  page,
  browser,
  baseURL,
}) => {
  const { id, code } = await sharedKnowledgebase(page, 'view');
  const visitor = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${code}`,
    person('Grace', 'Hopper'),
  );
  await expectReadOnly(visitor);
  // A Viewer does not comment: the writing's Comment control is not offered.
  await expect(visitor.getByRole('button', { name: /^Comment/ })).toHaveCount(0);
  // Nothing the Viewer did reached the owner's copy.
  await pageRow(page, 'Handbook').click();
  await expect(writing(page)).not.toContainText('XYZ');
  await visitor.context().close();
});

test('a Participant reads and cannot write or change the tree', async ({
  page,
  browser,
  baseURL,
}) => {
  const { id, code } = await sharedKnowledgebase(page, 'participate');
  const visitor = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${code}`,
    person('Grace', 'Hopper'),
  );
  await expectReadOnly(visitor);
  await pageRow(page, 'Handbook').click();
  await expect(writing(page)).not.toContainText('XYZ');
  await visitor.context().close();
});
