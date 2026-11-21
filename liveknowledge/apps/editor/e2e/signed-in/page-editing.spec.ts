import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';
import { draftLines as writeLines, pageRow, titleOf, writing } from '../knowledgebase';
import {
  person,
  savedWith,
  secondPerson,
  shareCode,
  signedInKnowledgebase,
} from './knowledge-session';

// Read mode and edit mode (docs/specs/030-knowledgebase/editing.md; blueprint blueprints/editing.md "Testing"): two
// Editors write one shared draft while a Viewer reads the saved page; Save publishes it to the Viewer; a draft
// survives a reload; Cancel by the last editor asks before the changes go.

test.use({ viewport: { width: 1440, height: 860 } });

const editButton = (page: Page) => page.getByRole('button', { name: 'Edit', exact: true });
const saveButton = (page: Page) => page.getByRole('button', { name: 'Save', exact: true });
const cancelButton = (page: Page) => page.getByRole('button', { name: 'Cancel', exact: true });
const draftBar = (page: Page) => page.locator('[data-page-edit-bar]');

async function edit(page: Page): Promise<void> {
  await editButton(page).click();
  await expect(draftBar(page)).toBeVisible();
  await expect(writing(page)).toHaveAttribute('contenteditable', 'true');
}

test('two Editors write one draft, a Viewer reads the saved page, and Save publishes it', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const { who, id } = await signedInKnowledgebase(page);
  // A page made here opens in edit mode, the caret in its Title.
  await expect(draftBar(page)).toBeVisible();
  await page.keyboard.type('Handbook');
  await writeLines(page, 'Welcome to the team.');
  // The page's name waits for Save: readers see the saved page.
  const named = savedWith(page, '"name":"Handbook"');
  await saveButton(page).click();
  await named;
  await expect(pageRow(page, 'Handbook')).toBeVisible();
  await expect(editButton(page)).toBeVisible();
  // Read mode: the writing takes no caret.
  await expect(writing(page)).toHaveAttribute('contenteditable', 'false');

  const editorCode = await shareCode(page, who, id, 'edit');
  const viewerCode = await shareCode(page, who, id, 'view');
  const sam = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${editorCode}`,
    person('Sam', 'Okafor'),
  );
  const vera = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${viewerCode}`,
    person('Vera', 'Lind'),
  );
  await expect(titleOf(vera)).toHaveText('Handbook');
  // A Viewer has no Edit.
  await expect(editButton(vera)).toHaveCount(0);

  // Both Editors edit the page; each sees the other in the bar.
  await edit(page);
  await edit(sam);
  await expect(draftBar(page).getByRole('img', { name: /Also editing: Sam/ })).toBeVisible();
  await expect(draftBar(sam).getByRole('img', { name: /Also editing: Ada/ })).toBeVisible();
  // The Viewer is told who is editing.
  await expect(vera.locator('[data-page-being-edited]')).toContainText('Being edited by');

  // Ada writes in the draft: Sam sees it, Vera does not.
  await writeLines(page, 'A line in the draft.');
  await expect(writing(sam)).toContainText('A line in the draft.');
  await expect(draftBar(sam)).toContainText('Unsaved changes');
  await vera.waitForTimeout(1500);
  await expect(writing(vera)).not.toContainText('A line in the draft.');

  // Sam saves: Vera reads it, Ada is told and keeps editing.
  await saveButton(sam).click();
  await expect(writing(vera)).toContainText('A line in the draft.');
  await expect(page.getByText('Sam Okafor saved the page')).toBeVisible();
  await expect(draftBar(page)).toBeVisible();
  await expect(editButton(sam)).toBeVisible();

  await sam.context().close();
  await vera.context().close();
});

test('a draft survives a reload, and Cancel by the last editor asks before it goes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await signedInKnowledgebase(page);
  await page.keyboard.type('Expenses');
  await writeLines(page, 'Claims within 30 days.');
  await saveButton(page).click();
  await expect(editButton(page)).toBeVisible();

  // Edit, write, and leave without saving: the draft is kept.
  await edit(page);
  const kept = savedWith(page, 'Receipts are required.');
  await writeLines(page, 'Receipts are required.');
  await kept;
  await page.reload();
  await titleOf(page).waitFor({ timeout: 30_000 });
  // Reading shows the saved page.
  await expect(writing(page)).not.toContainText('Receipts are required.');
  await edit(page);
  await expect(writing(page)).toContainText('Receipts are required.');
  await expect(draftBar(page)).toContainText(/Unsaved changes from you/);

  // Keep Editing keeps everything.
  await cancelButton(page).click();
  const ask = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await expect(ask).toContainText('Discard your changes to this page?');
  await ask.getByRole('button', { name: 'Keep Editing' }).click();
  await expect(draftBar(page)).toBeVisible();

  // Discard Changes takes the page back to what was saved.
  await cancelButton(page).click();
  await ask.getByRole('button', { name: 'Discard Changes' }).click();
  await expect(editButton(page)).toBeVisible();
  await expect(writing(page)).not.toContainText('Receipts are required.');
  await edit(page);
  await expect(writing(page)).not.toContainText('Receipts are required.');
  // Nothing changed: Cancel leaves without asking.
  await cancelButton(page).click();
  await expect(editButton(page)).toBeVisible();
});

test('the keys: E edits, Mod-S saves', async ({ page }) => {
  await signedInKnowledgebase(page);
  await page.keyboard.type('Keys');
  await page.keyboard.press('ControlOrMeta+s');
  await expect(editButton(page)).toBeVisible();
  await expect(pageRow(page, 'Keys')).toBeVisible();
  await page.locator('body').click({ position: { x: 900, y: 600 } });
  await page.keyboard.press('e');
  await expect(draftBar(page)).toBeVisible();
});
