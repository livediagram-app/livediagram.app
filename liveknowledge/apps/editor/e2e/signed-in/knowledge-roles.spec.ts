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
// person arrives through a share link at each role. A Viewer reads every page, follows the tree and searches, and
// neither writes on a page nor changes the tree. A Participant is an Editor minus the Review Period, the
// Knowledgebase Style and automations: it edits and saves a page, sets a cover and verifies, and is offered neither
// the Review Period's pencil nor the style. The room's and the api's own rules are held by the api's role tests;
// this is what the editor offers them, and that what a Participant writes reaches the owner.

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

const editButton = (page: Page) => page.getByRole('button', { name: 'Edit', exact: true });
const health = (page: Page) => page.getByRole('region', { name: 'Page Health' });

test('a Participant edits and saves a page, sets a cover and verifies, with no Settings or Style', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const { id, code } = await sharedKnowledgebase(page, 'participate');
  const visitor = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${code}`,
    person('Grace', 'Hopper'),
  );
  await pageRow(visitor, 'Handbook').click();
  await expect(titleOf(visitor)).toHaveText('Handbook');

  // Edit, write in the draft, and Save: the owner reads it.
  await editButton(visitor).click();
  await expect(visitor.locator('[data-page-edit-bar]')).toBeVisible();
  await expect(writing(visitor)).toHaveAttribute('contenteditable', 'true');
  await paragraphs(visitor).filter({ hasText: 'Welcome to the team.' }).click();
  await visitor.keyboard.press('End');
  await visitor.keyboard.press('Enter');
  await visitor.keyboard.type('Grace wrote this line.');
  await visitor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(editButton(visitor)).toBeVisible();
  await pageRow(page, 'Handbook').click();
  await expect(writing(page)).toContainText('Grace wrote this line.');

  // A cover, from edit mode: saved at once, and the owner sees it.
  await editButton(visitor).click();
  const coverSaved = savedWith(visitor, '"cover"');
  await visitor.getByRole('button', { name: /^Add Cover/ }).click();
  await visitor
    .getByRole('dialog', { name: 'Add Cover' })
    .getByRole('button', { name: 'Theme Dusk' })
    .click();
  await coverSaved;
  await expect(visitor.locator('[data-page-cover]')).toHaveAttribute('data-page-cover', 'gradient');
  await expect(page.locator('[data-page-cover]')).toHaveAttribute('data-page-cover', 'gradient');
  await visitor.getByRole('button', { name: 'Save', exact: true }).click();

  // Verify, in Page Health: the page is vouched for by the Participant.
  await health(visitor).getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(visitor.locator('[data-page-meta]')).toContainText('Verified by Grace Hopper');
  // The Review Period is shown, with no pencil beside it (an Editor's alone).
  await expect(health(visitor).getByRole('button', { name: 'Change Review Period' })).toHaveCount(
    0,
  );

  // The knowledgebase's menu: no Rename, AI Settings or Delete.
  await visitor.locator('[data-knowledgebase-menu]').click();
  const rows = visitor.getByRole('menuitem');
  await expect(rows.filter({ hasText: 'Export' })).toHaveCount(1);
  for (const name of ['Rename', 'AI Settings', 'Delete'])
    await expect(visitor.getByRole('menuitem', { name })).toHaveCount(0);
  await visitor.keyboard.press('Escape');

  // The owner keeps the Review Period's pencil.
  await expect(health(page).getByRole('button', { name: 'Change Review Period' })).toBeVisible();
  await visitor.context().close();
});
