import { expect, expectNoPageErrors, test } from '../fixtures';
import {
  addPage,
  nameOpenPage,
  openPage,
  openSearch,
  pageRow,
  paragraphs,
  titleOf,
  writeLines,
} from '../knowledgebase';
import { savedWith, signedInKnowledgebase } from './knowledge-session';

// The server's search (docs/specs/030-knowledgebase/search-and-ask.md "Search"): the room's index, rewritten when a
// page is saved, answered through the same dialog a guest searches an Offline knowledgebase in (search.spec.ts).

test('Cmd or Ctrl K finds a passage in the room\'s index, and Enter opens its page at it', async ({
  page,
  pageErrors,
}) => {
  await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Handbook');
  await addPage(page, 'Expenses');
  const saved = savedWith(page, 'director to approve');
  await writeLines(page, 'File receipts by Friday.', 'Flights need a director to approve them.');
  expect((await saved).ok()).toBe(true);
  await openPage(page, 'Handbook');

  const dialog = await openSearch(page);
  const results = dialog.getByRole('listbox', { name: 'Results' });
  const answered = page.waitForResponse((r) => /\/search$/.test(new URL(r.url()).pathname));
  await page.keyboard.type('director approve');
  expect((await answered).ok()).toBe(true);
  const hit = results.getByRole('option').filter({ hasText: 'Flights need a' });
  await expect(hit).toBeVisible();
  await expect(hit).toContainText('Expenses');
  await expect(hit.locator('mark').first()).toBeVisible();
  await hit.click();
  await expect(dialog).toBeHidden();
  await expect(pageRow(page, 'Expenses')).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText('Expenses');
  await expect(paragraphs(page).filter({ hasText: 'Flights need a director' })).toBeInViewport();

  // Words no page holds.
  await openSearch(page);
  await page.keyboard.type('zeppelin');
  await expect(dialog).toContainText('No pages match “zeppelin”');
  await expect(results.getByRole('option')).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
