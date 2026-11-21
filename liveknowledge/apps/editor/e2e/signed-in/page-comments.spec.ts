import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { nameOpenPage, pageRow, titleOf, writeLines } from '../knowledgebase';
import {
  person,
  savedWith,
  secondPerson,
  shareCode,
  signedInKnowledgebase,
} from './knowledge-session';

// Comments on a page (docs/specs/030-knowledgebase/page-comments.md; blueprints/approval-and-comments.md), signed in:
// threads at the foot of the page, after Linked From. The owner starts one; a Participant arriving through a share
// link replies and resolves it, and each side sees the other's change at once; a Viewer reads with nothing to press.
// Kept by the api: read again after a reload.

test.use({ viewport: { width: 1440, height: 860 } });

const comments = (page: Page) => page.locator('[data-page-comments]');
const thread = (page: Page) => comments(page).locator('[data-page-thread]').first();

test('threads at a page’s foot: start, reply and resolve, live for everyone on the page', async ({
  page,
  browser,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(150_000);
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  // An empty page has no Comments: they appear once it has some writing.
  await expect(comments(page)).toHaveCount(0);
  const saved = savedWith(page, 'blue lever');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;

  // A writer with no threads sees the empty state and the composer.
  await expect(comments(page)).toContainText(
    'Questions, corrections and context for this page go here.',
  );
  const field = comments(page).getByLabel('Add a comment');
  await field.fill('Is the blue lever still the right one?');
  await field.press('ControlOrMeta+Enter');
  await expect(thread(page)).toContainText('Is the blue lever still the right one?');
  await expect(comments(page).getByRole('heading', { name: /Comments/ })).toContainText('1');

  const grace = person('Grace', 'Hopper');
  const visitor = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${await shareCode(page, who, id, 'participate')}`,
    grace,
  );
  await pageRow(visitor, 'Runbook').click();
  await expect(titleOf(visitor)).toHaveText('Runbook');
  await expect(thread(visitor)).toContainText('Is the blue lever still the right one?');
  // Someone else's comment has no Edit or Delete.
  await expect(thread(visitor).getByRole('button', { name: 'Edit comment' })).toHaveCount(0);
  await thread(visitor).getByRole('button', { name: 'Reply' }).click();
  await thread(visitor).getByLabel('Reply').fill('Yes, since March.');
  await thread(visitor).getByRole('button', { name: 'Reply' }).click();
  await expect(thread(page)).toContainText('Yes, since March.');

  await thread(page).getByRole('button', { name: 'Resolve' }).click();
  await expect(comments(visitor).locator('[data-resolved-threads] summary')).toHaveText(
    /1 Resolved/,
  );

  const viewer = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${await shareCode(page, who, id, 'view')}`,
    person('Alan', 'Turing'),
  );
  await pageRow(viewer, 'Runbook').click();
  await comments(viewer).locator('[data-resolved-threads] summary').click();
  await expect(comments(viewer)).toContainText('Yes, since March.');
  await expect(comments(viewer).getByLabel('Add a comment')).toHaveCount(0);
  await expect(comments(viewer).getByRole('button', { name: 'Reopen' })).toHaveCount(0);

  await page.reload();
  await titleOf(page).waitFor();
  await expect(comments(page).locator('[data-resolved-threads] summary')).toHaveText(/1 Resolved/);
  await visitor.context().close();
  await viewer.context().close();
  expectNoPageErrors(pageErrors);
});
