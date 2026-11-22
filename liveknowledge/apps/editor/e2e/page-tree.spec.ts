import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from './fixtures';
import {
  addPage,
  addSubpage,
  expectCaretInTitle,
  expectKeptOffline,
  newKnowledgebase,
  nameOpenPage,
  openPage,
  openMoveSection,
  openRowMenu,
  pageRow,
  pageTree,
  rowVerb,
  saveAndGoOn,
  titleOf,
  treeShape,
} from './knowledgebase';

// The page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree";
// blueprints/page-tree.md), end to end in a guest's knowledgebase kept Offline: adding, nesting, moving, deleting
// and undoing, the keyboard, the rail, and what this browser remembers. The model's rules are held by
// packages/document's page-tree tests; here it is the real sidebar, its focus and its storage.

const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Pages' });

// Start Here renamed Guides, then Setup and Deploy under it, and Notes at the top level.
async function threeLevels(page: Page): Promise<void> {
  await newKnowledgebase(page);
  await nameOpenPage(page, 'Guides');
  await addSubpage(page, 'Guides', 'Setup');
  await addSubpage(page, 'Guides', 'Deploy');
  await addPage(page, 'Notes');
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '2 Deploy', '1 Notes']);
}

test('New Page and Add Subpage take the caret in the new Title, and a subpage shows its breadcrumb', async ({
  page,
  pageErrors,
}) => {
  // At a laptop's width: the reading column is centred in the room beside the tree, so the breadcrumb over the paper
  // stands clear of the sidebar (docs/specs/030-knowledgebase/page-surface.md "A reading column").
  await page.setViewportSize({ width: 1280, height: 800 });
  await newKnowledgebase(page);
  await nameOpenPage(page, 'Guides');

  // New Page: a top-level page, open, the caret in its Title, so what is typed next is its name.
  await sidebar(page).getByRole('button', { name: 'New Page' }).click();
  await expect(pageRow(page, 'Untitled Page')).toHaveAttribute('aria-current', 'page');
  await expectCaretInTitle(page);
  await page.keyboard.type('Notes');
  await expect(pageRow(page, 'Notes')).toBeVisible();
  // The name is the draft's until Save (docs/specs/030-knowledgebase/editing.md "The page's name while editing").
  await saveAndGoOn(page);
  // A top-level page has no breadcrumb.
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveCount(0);

  // Add Subpage, from the row's own button: the last under its parent, open, the caret in its Title.
  const guides = pageRow(page, 'Guides');
  await guides.hover();
  await guides.getByRole('button', { name: 'Add Subpage to Guides' }).click();
  await expect(pageRow(page, 'Untitled Page')).toHaveAttribute('aria-current', 'page');
  await expectCaretInTitle(page);
  await page.keyboard.type('Setup');
  await expect(pageRow(page, 'Setup')).toBeVisible();
  await saveAndGoOn(page);
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '1 Notes']);
  await expect(guides).toHaveAttribute('aria-expanded', 'true');

  // The breadcrumb names the ancestors, each a link that opens its page.
  const crumb = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumb.getByRole('link')).toHaveText(['Guides']);
  await crumb.getByRole('link', { name: 'Guides' }).click();
  await expect(guides).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText('Guides');
  expectNoPageErrors(pageErrors);
});

test('the row menu moves a page up and down, indents and outdents it', async ({
  page,
  pageErrors,
}) => {
  await threeLevels(page);

  await rowVerb(page, 'Deploy', 'Move Up');
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Deploy', '2 Setup', '1 Notes']);
  await rowVerb(page, 'Deploy', 'Move Down');
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '2 Deploy', '1 Notes']);

  // Indent puts a page under the sibling above it; Outdent brings it back beside its parent.
  await rowVerb(page, 'Deploy', 'Indent');
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '3 Deploy', '1 Notes']);
  await rowVerb(page, 'Deploy', 'Outdent');
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '2 Deploy', '1 Notes']);

  // A verb that cannot run stays in the menu, disabled: the first of its siblings has nothing above it.
  const menu = await openRowMenu(page, 'Setup');
  await openMoveSection(menu);
  await expect(menu.getByRole('menuitem', { name: 'Move Up', exact: true })).toBeDisabled();
  await expect(menu.getByRole('menuitem', { name: 'Indent', exact: true })).toBeDisabled();
  await expect(menu.getByRole('menuitem', { name: 'Move Down', exact: true })).toBeEnabled();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  expectNoPageErrors(pageErrors);
});

test('Delete names the subpages it takes, and Undo brings them all back', async ({
  page,
  pageErrors,
}) => {
  await threeLevels(page);

  await rowVerb(page, 'Guides', 'Delete');
  const confirm = page.getByRole('dialog', { name: 'Delete Guides and 2 Subpages?' });
  await expect(confirm).toContainText('Undo (Cmd/Ctrl-Z) brings them back.');
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(confirm).toBeHidden();
  expect(await treeShape(page)).toEqual(['1 Notes']);

  // The last page is never deleted.
  const menu = await openRowMenu(page, 'Notes');
  await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(pageTree(page).getByRole('treeitem')).toHaveCount(4);
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '2 Deploy', '1 Notes']);
  expectNoPageErrors(pageErrors);
});

test('the tree is walked by keyboard: arrows move, Enter opens, F2 renames', async ({
  page,
  pageErrors,
}) => {
  await threeLevels(page);

  await pageRow(page, 'Guides').focus();
  await page.keyboard.press('ArrowDown');
  await expect(pageRow(page, 'Setup')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(pageRow(page, 'Deploy')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(pageRow(page, 'Setup')).toBeFocused();

  // Left on a subpage goes to its parent; Left there closes it, Right opens it again.
  await page.keyboard.press('ArrowLeft');
  await expect(pageRow(page, 'Guides')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(pageRow(page, 'Guides')).toHaveAttribute('aria-expanded', 'false');
  expect(await treeShape(page)).toEqual(['1 Guides', '1 Notes']);
  await page.keyboard.press('ArrowRight');
  await expect(pageRow(page, 'Guides')).toHaveAttribute('aria-expanded', 'true');

  // Enter opens the focused page.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(pageRow(page, 'Setup')).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText('Setup');

  // F2 renames in place, and the page's Title follows: its name and its Title are one thing.
  await pageRow(page, 'Setup').focus();
  await page.keyboard.press('F2');
  const field = pageTree(page).getByRole('textbox', { name: 'Page name' });
  await expect(field).toBeFocused();
  await field.fill('Install');
  await page.keyboard.press('Enter');
  await expect(pageRow(page, 'Install')).toBeVisible();
  await expect(titleOf(page)).toHaveText('Install');
  expectNoPageErrors(pageErrors);
});

test('the tree collapses to a rail and back, and this browser remembers what was open', async ({
  page,
  pageErrors,
}) => {
  await threeLevels(page);

  // Notes is the open page, so Guides may be closed (the open page's ancestors always show).
  await pageRow(page, 'Guides').getByRole('button', { name: 'Collapse Guides' }).click();
  expect(await treeShape(page)).toEqual(['1 Guides', '1 Notes']);
  await expectKeptOffline(page, 'Notes');
  await page.reload();
  await titleOf(page).waitFor();
  await expect(pageRow(page, 'Guides')).toHaveAttribute('aria-expanded', 'false');
  expect(await treeShape(page)).toEqual(['1 Guides', '1 Notes']);

  // Opened again, and that is remembered too.
  await pageRow(page, 'Guides').getByRole('button', { name: 'Expand Guides' }).click();
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '2 Deploy', '1 Notes']);

  // The rail: the tree is put away, New Page and Show Pages stay.
  await sidebar(page).getByRole('button', { name: 'Hide Pages' }).click();
  await expect(sidebar(page)).toHaveAttribute('data-page-tree', 'rail');
  await expect(pageTree(page)).toHaveCount(0);
  await expect(sidebar(page).getByRole('button', { name: 'New Page' })).toBeVisible();
  await page.reload();
  await titleOf(page).waitFor();
  await expect(sidebar(page)).toHaveAttribute('data-page-tree', 'rail');

  await sidebar(page).getByRole('button', { name: 'Show Pages' }).click();
  await expect(sidebar(page)).toHaveAttribute('data-page-tree', 'open');
  expect(await treeShape(page)).toEqual(['1 Guides', '2 Setup', '2 Deploy', '1 Notes']);

  // A page opened from the tree shows its writing.
  await openPage(page, 'Deploy');
  expectNoPageErrors(pageErrors);
});
