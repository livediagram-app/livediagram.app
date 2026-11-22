import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { nameOpenPage, pageRow, rowVerb, titleOf, writeLines } from '../knowledgebase';
import {
  person,
  savedWith,
  secondPerson,
  shareCode,
  signedInKnowledgebase,
} from './knowledge-session';

// Approval (docs/specs/030-knowledgebase/approval.md; blueprints/approval-and-comments.md), signed in: the owner asks
// for a page to be approved from its sidebar menu; a Participant who arrives through a share link sees it Pending
// Approval in the meta row and Page Health, approves it (which verifies it) or rejects it with a note, and the owner
// sees each at once. A Viewer sees the state and nothing to press. Kept by the room: each is read again after a reload.

test.use({ viewport: { width: 1440, height: 860 } });

const meta = (page: Page) => page.locator('[data-page-meta]');
const rail = (page: Page) => page.getByRole('region', { name: 'Approval' });
const popover = (page: Page) => page.locator('[data-approval-popover]');

async function askedForApproval(page: Page) {
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  const saved = savedWith(page, 'blue lever');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;
  // Request Approval starts from the page's menu in the sidebar alone; Page Health's Approval section asks
  // (approval.md "Asking for approval").
  await expect(meta(page).getByRole('button', { name: 'Request Approval' })).toHaveCount(0);
  await rowVerb(page, 'Runbook', 'Request Approval');
  await expect(rail(page)).toContainText('Request Approval?');
  const asked = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/pages\/[^/]+\/approval$/.test(new URL(r.url()).pathname),
  );
  await rail(page).getByRole('button', { name: 'Request Approval' }).click();
  expect((await asked).ok()).toBe(true);
  await expect(meta(page).locator('[data-approval-pill="pending"]')).toHaveText('Pending Approval');
  // The sidebar row carries no approval mark (approval.md "Where it shows").
  await expect(pageRow(page, 'Runbook')).toBeVisible();
  // The asker waits: no Approve for their own request.
  await expect(rail(page)).toContainText('Waiting for someone else to approve it.');
  await expect(rail(page).getByRole('button', { name: 'Approve' })).toHaveCount(0);
  return { who, id };
}

test('a Participant approves a page another asked about, and it is verified for everyone', async ({
  page,
  browser,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(150_000);
  const { who, id } = await askedForApproval(page);
  const code = await shareCode(page, who, id, 'participate');
  const grace = person('Grace', 'Hopper');
  const visitor = await secondPerson(browser, baseURL!, `/document/${id}?s=${code}`, grace);
  await pageRow(visitor, 'Runbook').click();
  await expect(titleOf(visitor)).toHaveText('Runbook');
  await expect(rail(visitor)).toContainText(`Requested by ${who.firstName} ${who.lastName}`);
  await rail(visitor).getByRole('button', { name: 'Approve' }).click();
  await expect(meta(visitor)).toContainText(`Verified by ${grace.firstName} ${grace.lastName}`);
  await expect(meta(visitor).locator('[data-approval-pill]')).toHaveCount(0);

  // The owner sees it at once, and after a reload.
  // Verify's own "Verified by" names only the people this editor knows; the approval keeps the approver's name.
  await expect(meta(page).locator('[data-trust="verified"]')).toBeVisible();
  await expect(rail(page)).toContainText(`Approved by ${grace.firstName} ${grace.lastName}`);
  await page.reload();
  await titleOf(page).waitFor();
  await expect(pageRow(page, 'Runbook')).toBeVisible();
  await visitor.context().close();
  expectNoPageErrors(pageErrors);
});

test('a Participant rejects with a note the owner reads; a Viewer sees the state alone', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const { who, id } = await askedForApproval(page);
  const participant = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${await shareCode(page, who, id, 'participate')}`,
    person('Grace', 'Hopper'),
  );
  await pageRow(participant, 'Runbook').click();
  await meta(participant).getByRole('button', { name: 'Pending Approval' }).click();
  await popover(participant).getByRole('button', { name: 'Reject' }).click();
  await popover(participant)
    .getByLabel('What needs to change? (optional)')
    .fill('Name the on-call rota.');
  await popover(participant).getByRole('button', { name: 'Reject' }).click();
  await expect(meta(participant).locator('[data-approval-pill="rejected"]')).toBeVisible();

  await expect(meta(page).locator('[data-approval-pill="rejected"]')).toBeVisible();
  await expect(rail(page).locator('[data-approval-note]')).toHaveText('Name the on-call rota.');
  await expect(rail(page).getByRole('button', { name: 'Request Again' })).toBeVisible();

  const viewer = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${await shareCode(page, who, id, 'view')}`,
    person('Alan', 'Turing'),
  );
  await pageRow(viewer, 'Runbook').click();
  await meta(viewer).getByRole('button', { name: 'Rejected' }).click();
  await expect(popover(viewer)).toContainText('Name the on-call rota.');
  for (const name of ['Approve', 'Reject', 'Request Again', 'Withdraw'])
    await expect(popover(viewer).getByRole('button', { name })).toHaveCount(0);
  await participant.context().close();
  await viewer.context().close();
});
