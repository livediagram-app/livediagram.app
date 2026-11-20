import { expect, expectNoPageErrors, test } from './fixtures';
import {
  addPage,
  nameOpenPage,
  newKnowledgebase,
  openPage,
  openSearch,
  pageRow,
  paragraphs,
  titleOf,
  writeLines,
} from './knowledgebase';

// The knowledgebase's search (docs/specs/030-knowledgebase/search-and-ask.md "Search"; blueprints/knowledge-ui.md
// "Search"), for a guest: an Offline knowledgebase is searched in this browser, over the pages it holds, through the
// same dialog. The server's search, over the room's index, is signed-in/knowledge-search.spec.ts.

test('Cmd or Ctrl K finds a passage Offline, and Enter opens its page at it', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await nameOpenPage(page, 'Handbook');
  await writeLines(page, 'Welcome to the team.');
  await addPage(page, 'Expenses');
  await writeLines(page, 'File receipts by Friday.', 'Flights need a director to approve them.');
  await openPage(page, 'Handbook');

  const dialog = await openSearch(page);
  const results = dialog.getByRole('listbox', { name: 'Results' });
  // Nothing typed: no results, a line saying what is searched.
  await expect(results.getByRole('option')).toHaveCount(0);

  await page.keyboard.type('director approve');
  const hit = results.getByRole('option').filter({ hasText: 'Flights need a' });
  await expect(hit).toBeVisible();
  await expect(hit).toContainText('Expenses');
  // The matched words are marked, as text.
  await expect(hit.locator('mark')).toHaveText(['director', 'approve']);

  await expect(hit).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await expect(pageRow(page, 'Expenses')).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText('Expenses');
  // The passage's block is on screen.
  await expect(paragraphs(page).filter({ hasText: 'Flights need a director' })).toBeInViewport();
  expectNoPageErrors(pageErrors);
});

test('a page is found by its title, and words nothing holds say so', async ({ page, pageErrors }) => {
  await newKnowledgebase(page);
  await nameOpenPage(page, 'Handbook');
  await addPage(page, 'Expenses');

  const dialog = await openSearch(page);
  const results = dialog.getByRole('listbox', { name: 'Results' });
  await page.keyboard.type('zeppelin');
  await expect(results.getByRole('option')).toHaveCount(0);
  await expect(dialog).toContainText('No pages match “zeppelin”');

  // The search field at the head of the page tree opens the same dialog.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page
    .getByRole('complementary', { name: 'Pages' })
    .getByRole('button', { name: 'Search' })
    .click();
  await expect(dialog.getByRole('combobox')).toBeFocused();
  await page.keyboard.type('handbook');
  await expect(results.getByRole('option').filter({ hasText: 'Handbook' })).toBeVisible();
  await results.getByRole('option').filter({ hasText: 'Handbook' }).click();
  await expect(pageRow(page, 'Handbook')).toHaveAttribute('aria-current', 'page');
  expectNoPageErrors(pageErrors);
});
