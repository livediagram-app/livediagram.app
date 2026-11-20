import { expect, expectNoPageErrors, test } from '../fixtures';
import {
  addPage,
  nameOpenPage,
  openPageId,
  pageRow,
  paragraphs,
  titleOf,
  writeLines,
} from '../knowledgebase';
import { asPerson, savedWith, signedInKnowledgebase } from './knowledge-session';

// The Knowledgebase Home (docs/specs/030-knowledgebase/knowledgebase-home.md; blueprints/home.md), for a signed-in
// person on a fresh account: their knowledgebase with its numbers, the search across knowledgebases opening a
// result at its passage, and Yours to Review with Still Right.

test.use({ viewport: { width: 1440, height: 860 } });

const home = (page: import('@playwright/test').Page) => page.locator('[data-home]');

test('Home lists the knowledgebase with its page count and verified share, and search opens a passage', async ({
  page,
  pageErrors,
}) => {
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Handbook');
  await page.locator('[data-page-meta]').getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(pageRow(page, 'Handbook, Verified')).toBeVisible();
  await addPage(page, 'Expenses');
  const saved = savedWith(page, 'director to approve');
  await writeLines(page, 'File receipts by Friday.', 'Flights need a director to approve them.');
  expect((await saved).ok()).toBe(true);

  await page.goto('/home');
  await expect(
    home(page).getByRole('heading', { level: 1, name: `What do you need to know, ${who.firstName}?` }),
  ).toBeVisible();
  const card = home(page).locator(`[data-home-knowledgebase="${id}"]`);
  await expect(card).toContainText('Untitled Knowledgebase');
  await expect(card).toContainText('2 pages');
  await expect(card).toContainText('50% verified');
  await expect(card.getByRole('img')).toHaveAccessibleName('50 percent of pages verified');
  await expect(
    home(page).getByRole('region', { name: 'Recently Updated' }).getByRole('link', { name: /^Expenses/ }),
  ).toBeVisible();

  // The field searches every knowledgebase the person can open; a result opens its page at the passage.
  await home(page).getByRole('textbox', { name: 'Search or ask' }).fill('director approve');
  const result = home(page).locator('[data-home-result]').filter({ hasText: 'Flights need a' });
  await expect(result).toBeVisible();
  await result.click();
  await page.waitForURL(new RegExp(`/document/${id}`));
  await expect(titleOf(page)).toHaveText('Expenses');
  await expect(pageRow(page, 'Expenses')).toHaveAttribute('aria-current', 'page');
  await expect(paragraphs(page).filter({ hasText: 'Flights need a director' })).toBeInViewport();
  expectNoPageErrors(pageErrors);
});

test('Yours to Review lists a page of yours that is due, and Still Right clears it', async ({
  page,
  pageErrors,
}) => {
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  const tab = openPageId(page);

  // Verified 100 days ago, on a 30 day review. Verify always says now; the e2e stack alone lets a spec name an
  // earlier moment (apps/api/src/knowledge/claude-door.ts `verifyMoment`), so a page can be due without the wait.
  const headers = await asPerson(page, who, id);
  const verify = await page.request.post(`/api/documents/${id}/pages/${tab}/verify`, {
    headers: { ...headers, 'X-E2E-Verified-At': String(Date.now() - 100 * 24 * 60 * 60 * 1000) },
  });
  expect(verify.ok(), `verify: ${verify.status()}`).toBe(true);
  const interval = await page.request.put(`/api/documents/${id}/pages/${tab}/knowledge`, {
    headers,
    data: { reviewEvery: 30 },
  });
  expect(interval.ok(), `review interval: ${interval.status()}`).toBe(true);
  // Due in the editor too: the row and the meta row say so.
  await page.reload();
  await expect(pageRow(page, 'Runbook, Review Due')).toBeVisible();
  await expect(page.locator('[data-page-meta]')).toContainText('Review Due');

  await page.goto('/home');
  const review = home(page).getByRole('region', { name: 'Yours to Review' });
  await expect(review).toContainText('Runbook');
  const verified = page.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/verify$/.test(new URL(r.url()).pathname),
  );
  await review.getByRole('button', { name: /Still Right/ }).click();
  expect((await verified).ok()).toBe(true);
  await expect(review).toHaveCount(0);

  // And it stays cleared: the page is verified as of now.
  await page.goto(`/document/${id}`);
  await expect(page.locator('[data-page-meta]')).toContainText('Verified by');
  await expect(pageRow(page, 'Runbook, Verified')).toBeVisible();
  expectNoPageErrors(pageErrors);
});
