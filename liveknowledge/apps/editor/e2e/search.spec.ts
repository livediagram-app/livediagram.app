import { expect, expectNoPageErrors, test } from './fixtures';
import {
  addPage,
  knowledgeResults,
  nameOpenPage,
  newKnowledgebase,
  openPage,
  openSearch,
  pageRow,
  paragraphs,
  searchPanel,
  titleOf,
  writeLines,
} from './knowledgebase';

// The knowledgebase's search (docs/specs/030-knowledgebase/search-and-ask.md "Search"; blueprints/knowledge-ui.md
// "Search"), for a guest: the editor's search panel, whose first group is This Knowledgebase. An Offline
// knowledgebase is searched in this browser, over the pages it holds. The server's search, over the room's index, is
// signed-in/knowledge-search.spec.ts.

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

  const panel = await openSearch(page);
  const group = knowledgeResults(panel);
  // Nothing typed: the group lists the pages opened most recently, the newest first.
  await expect(group.getByRole('option').first()).toContainText('Handbook');

  await page.keyboard.type('director approve');
  const hit = group.getByRole('option').filter({ hasText: 'Flights need a' });
  await expect(hit).toBeVisible();
  await expect(hit).toContainText('Expenses');
  // The matched words are marked, as text.
  await expect(hit.locator('mark')).toHaveText(['director', 'approve']);

  // This knowledgebase's results come first: the passage is the panel's first option, and Enter takes it.
  await expect(hit).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(panel).toBeHidden();
  await expect(pageRow(page, 'Expenses')).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText('Expenses');
  // The passage's block is on screen.
  await expect(paragraphs(page).filter({ hasText: 'Flights need a director' })).toBeInViewport();
  expectNoPageErrors(pageErrors);
});

test('a page is found by its title, and words nothing holds say so', async ({
  page,
  pageErrors,
}) => {
  await newKnowledgebase(page);
  await nameOpenPage(page, 'Handbook');
  await addPage(page, 'Expenses');

  const panel = await openSearch(page);
  const group = knowledgeResults(panel);
  await page.keyboard.type('zeppelin');
  // The group stays, saying this knowledgebase was searched.
  await expect(group).toContainText('No Pages Match');
  await expect(group.getByRole('option')).toHaveCount(0);

  // The search field at the head of the page tree opens the same panel.
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await page
    .getByRole('complementary', { name: 'Pages' })
    .getByRole('button', { name: 'Search' })
    .click();
  await expect(searchPanel(page).getByRole('combobox', { name: 'Search' })).toBeFocused();
  await page.keyboard.type('handbook');
  const found = group.getByRole('option').filter({ hasText: 'Handbook' });
  await expect(found).toBeVisible();
  await found.click();
  await expect(panel).toBeHidden();
  await expect(pageRow(page, 'Handbook')).toHaveAttribute('aria-current', 'page');
  expectNoPageErrors(pageErrors);
});
