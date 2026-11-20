import { expect, expectNoPageErrors, test } from '../fixtures';
import { nameOpenPage, openRowMenu, pageRow, titleOf, writeLines } from '../knowledgebase';
import { asPerson, savedWith, signedInKnowledgebase } from './knowledge-session';

// Verification (docs/specs/030-knowledgebase/verification.md; blueprints/knowledge-ui.md "Verification"), signed in:
// a new knowledgebase is saved to the account, Verify says who vouches for a page in its meta row and its tree row,
// Page Health changes the owner and the review interval, and the row menu puts a page Always in Context. Each is
// kept by the room, so each is read again after a reload.

test.use({ viewport: { width: 1440, height: 860 } });

const meta = (page: import('@playwright/test').Page) => page.locator('[data-page-meta]');
const health = (page: import('@playwright/test').Page) =>
  page.getByRole('region', { name: 'Page Health' });

test('a new knowledgebase is saved to the account, and Verify shows who vouches for the page', async ({
  page,
  pageErrors,
}) => {
  const { who, id } = await signedInKnowledgebase(page);
  // On the server, the account's: the api answers for it to the account's own token.
  const stored = await page.request.get(`/api/documents/${id}`, {
    headers: await asPerson(page, who, id),
  });
  expect(stored.status(), 'the knowledgebase is on the server').toBe(200);

  const saved = savedWith(page, 'blue lever');
  await nameOpenPage(page, 'Runbook');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;

  // Never verified: nothing but the Verify button, and no mark in the tree.
  await expect(meta(page)).not.toContainText('Verified');
  await expect(pageRow(page, 'Runbook').getByRole('img')).toHaveCount(0);

  // One press, no confirmation.
  await meta(page).getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(meta(page)).toContainText(`Verified by ${who.firstName} ${who.lastName}`);
  await expect(meta(page)).toContainText(/Review due \w+ \d+, \d{4}/);
  await expect(meta(page).getByRole('button', { name: 'Verify Again' })).toBeVisible();
  const row = pageRow(page, 'Runbook, Verified');
  await expect(row.getByRole('img', { name: 'Verified' })).toBeVisible();
  // A page with no owner takes its verifier.
  await expect(health(page).getByRole('combobox', { name: 'Owner' })).toHaveValue(who.id);
  await expect(health(page).locator('[data-verified-by]')).toHaveText(
    `by ${who.firstName} ${who.lastName}`,
  );

  await page.reload();
  await titleOf(page).waitFor();
  await expect(meta(page)).toContainText(`Verified by ${who.firstName} ${who.lastName}`);
  await expect(pageRow(page, 'Runbook, Verified').getByRole('img', { name: 'Verified' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('Page Health changes the owner and the review interval, and Always in Context toggles', async ({
  page,
  pageErrors,
}) => {
  const { who } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  await meta(page).getByRole('button', { name: 'Verify', exact: true }).click();
  const owner = health(page).getByRole('combobox', { name: 'Owner' });
  const interval = health(page).getByRole('combobox', { name: 'Review Interval' });
  await expect(owner).toHaveValue(who.id);
  await expect(interval).toHaveValue('90');

  const patched = () =>
    page.waitForResponse(
      (r) => r.request().method() === 'PUT' && /\/pages\/[^/]+\/knowledge$/.test(new URL(r.url()).pathname),
    );
  let done = patched();
  await interval.selectOption({ label: 'Every 30 Days' });
  expect((await done).ok()).toBe(true);
  done = patched();
  await owner.selectOption({ label: 'No Owner' });
  expect((await done).ok()).toBe(true);

  // Always in Context, from the row menu: a checkmark row.
  let menu = await openRowMenu(page, 'Runbook');
  const inContext = () => menu.getByRole('menuitem', { name: 'Always in Context' });
  await expect(inContext().locator('[data-checked]')).toHaveCount(0);
  done = patched();
  await inContext().click();
  expect((await done).ok()).toBe(true);
  menu = await openRowMenu(page, 'Runbook');
  await expect(inContext().locator('[data-checked]')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await page.reload();
  await titleOf(page).waitFor();
  await expect(health(page).getByRole('combobox', { name: 'Review Interval' })).toHaveValue('30');
  await expect(health(page).getByRole('combobox', { name: 'Owner' })).toHaveValue('');
  menu = await openRowMenu(page, 'Runbook');
  await expect(inContext().locator('[data-checked]')).toHaveCount(1);
  // And off again.
  done = patched();
  await inContext().click();
  expect((await done).ok()).toBe(true);
  menu = await openRowMenu(page, 'Runbook');
  await expect(inContext().locator('[data-checked]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  expectNoPageErrors(pageErrors);
});
