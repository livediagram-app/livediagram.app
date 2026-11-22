import { expect, expectNoPageErrors, test } from '../fixtures';
import {
  addPage,
  knowledgeResults,
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
// page is saved, answered in the editor's search panel's This Knowledgebase group, where a guest searches an Offline
// knowledgebase too (search.spec.ts).

test("Cmd or Ctrl K finds a passage in the room's index, and Enter opens its page at it", async ({
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

  const panel = await openSearch(page);
  const results = knowledgeResults(panel);
  const answered = page.waitForResponse((r) => /\/search$/.test(new URL(r.url()).pathname));
  await page.keyboard.type('director approve');
  expect((await answered).ok()).toBe(true);
  const hit = results.getByRole('option').filter({ hasText: 'Flights need a' });
  await expect(hit).toBeVisible();
  await expect(hit).toContainText('Expenses');
  await expect(hit.locator('mark').first()).toBeVisible();
  await hit.click();
  await expect(panel).toBeHidden();
  await expect(pageRow(page, 'Expenses')).toHaveAttribute('aria-current', 'page');
  await expect(titleOf(page)).toHaveText('Expenses');
  await expect(paragraphs(page).filter({ hasText: 'Flights need a director' })).toBeInViewport();

  // Words no page holds.
  await openSearch(page);
  await page.keyboard.type('zeppelin');
  await expect(results).toContainText('No Pages Match');
  await expect(results.getByRole('option')).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
