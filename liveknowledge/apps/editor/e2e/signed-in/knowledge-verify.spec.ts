import { expect, expectNoPageErrors, test } from '../fixtures';
import {
  nameOpenPage,
  openPageId,
  openRowMenu,
  pageRow,
  titleOf,
  writeLines,
} from '../knowledgebase';
import { asPerson, savedWith, signedInKnowledgebase } from './knowledge-session';

// Verification (docs/specs/030-knowledgebase/verification.md; blueprints/knowledge-ui.md "Verification"), signed in:
// a new knowledgebase is saved to the account, Verify says who vouches for a page in its meta row and its tree row,
// Page Health changes the owner, and its pencil beside the Review Period changes that period for every page at once, and the row menu puts a page Always in Context. Each is kept by the room, so each
// is read again after a reload.

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

  // Never verified: no mark on the page or in the tree. The meta row's Verify asks first (VerifyPageButton);
  // Page Health's is one press.
  await expect(meta(page)).not.toContainText('Verified');
  await meta(page).getByRole('button', { name: 'Verify', exact: true }).click();
  const ask = page.locator('[data-verify-popover]');
  await expect(ask).toContainText('Verify This Page?');
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await expect(ask).toHaveCount(0);
  await expect(meta(page)).not.toContainText('Verified by');
  await expect(pageRow(page, 'Runbook').getByRole('img')).toHaveCount(0);

  // One press, no confirmation.
  await health(page).getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(meta(page)).toContainText(`Verified by ${who.firstName} ${who.lastName}`);
  await expect(meta(page)).toContainText(/Review due \w+ \d+, \d{4}/);
  await expect(health(page).getByRole('button', { name: 'Verify Again' })).toBeVisible();
  // The row now offers Verify Again (asking first), never a one-press verify.
  await expect(meta(page).getByRole('button', { name: 'Verify Again' })).toBeVisible();
  // The tick is the meta row's; the tree row carries no Verified tick (knowledgebases-and-pages.md "Row menu").
  await expect(meta(page).locator('[data-trust="verified"]')).toBeVisible();
  await expect(pageRow(page, 'Runbook').getByRole('img')).toHaveCount(0);
  // A page with no owner takes its verifier.
  await expect(health(page).getByRole('combobox', { name: 'Owner' })).toHaveValue(who.id);
  // Last Verified is one line: the date and the verifier's disc, named for them.
  await expect(health(page).locator('[data-verified-by]')).toHaveAccessibleName(
    `Verified by ${who.firstName} ${who.lastName}`,
  );

  await page.reload();
  await titleOf(page).waitFor();
  await expect(meta(page)).toContainText(`Verified by ${who.firstName} ${who.lastName}`);
  await expect(meta(page).locator('[data-trust="verified"]')).toBeVisible();
  await expect(pageRow(page, 'Runbook').getByRole('img')).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('Page Health changes the owner and says the Review Period, and Always in Context toggles', async ({
  page,
  pageErrors,
}) => {
  const { who } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  await health(page).getByRole('button', { name: 'Verify', exact: true }).click();
  const owner = health(page).getByRole('combobox', { name: 'Owner' });
  await expect(owner).toHaveValue(who.id);
  // The Review Period is the knowledgebase's: the card says it and when this page comes due, with no control.
  await expect(health(page).getByRole('combobox')).toHaveCount(1);
  await expect(health(page).locator('[data-review-period]')).toHaveText('Every 90 Days');
  await expect(health(page).locator('[data-review-due]')).toHaveText(/\d/);

  const patched = () =>
    page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' &&
        /\/pages\/[^/]+\/knowledge$/.test(new URL(r.url()).pathname),
    );
  let done = patched();
  await owner.selectOption({ label: 'Nobody' });
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
  await expect(health(page).locator('[data-review-period]')).toHaveText('Every 90 Days');
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

test('Page Health’s pencil changes the Review Period, and a page comes due at once', async ({
  page,
  pageErrors,
}) => {
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  const tab = openPageId(page);
  // Verified 40 days ago: inside the default 90 days. Verify always says now; the e2e stack alone lets a spec
  // name an earlier moment (apps/api/src/knowledge/model-door.ts `verifyMoment`).
  const verify = await page.request.post(`/api/documents/${id}/pages/${tab}/verify`, {
    headers: {
      ...(await asPerson(page, who, id)),
      'X-E2E-Verified-At': String(Date.now() - 40 * 24 * 60 * 60 * 1000),
    },
  });
  expect(verify.ok(), `verify: ${verify.status()}`).toBe(true);
  await page.reload();
  await titleOf(page).waitFor();
  await expect(pageRow(page, 'Runbook')).toBeVisible();
  await expect(meta(page)).toContainText(/Review due /);
  await expect(health(page).locator('[data-review-period]')).toHaveText('Every 90 Days');

  // The pencil, beside the period in Page Health, opens it under the button: it says it applies to every page, with five
  // choices, the current one chosen.
  const change = health(page).getByRole('button', { name: 'Change Review Period' });
  await change.click();
  const settings = page.getByRole('dialog', { name: 'Review Period' });
  await expect(settings).toContainText('Applies to every page in this knowledgebase.');
  const period = (name: string) => settings.getByRole('radio', { name });
  await expect(settings.getByRole('radio')).toHaveText([
    'Every 30 Days',
    'Every 90 Days',
    'Every 180 Days',
    'Every Year',
    'Never',
  ]);
  await expect(period('Every 90 Days')).toHaveAttribute('aria-checked', 'true');

  // A shorter period says how many pages it makes due before anything changes; Cancel leaves it be.
  const body = settings;
  // Measured once the popover's entrance has finished: mid-animation its box is still faded and moving.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const height = (await body.boundingBox())!.height;
  await period('Every 30 Days').click();
  await expect(settings).toContainText('1 page will be due for review');
  expect((await body.boundingBox())!.height, 'the popover keeps its height').toBe(height);
  await expect(period('Every 90 Days')).toHaveAttribute('aria-checked', 'true');
  await expect(pageRow(page, 'Runbook')).toBeVisible();
  await settings.getByRole('button', { name: 'Cancel' }).click();
  await expect(settings).not.toContainText('will be due for review');

  // Apply: one write of the knowledgebase's setting, and the page is due everywhere at once.
  const stored = () =>
    page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' && /\/knowledge-settings$/.test(new URL(r.url()).pathname),
    );
  await period('Every 30 Days').click();
  let done = stored();
  await settings.getByRole('button', { name: 'Apply' }).click();
  expect((await done).ok()).toBe(true);
  await expect(period('Every 30 Days')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Pages are now reviewed every 30 days.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(pageRow(page, 'Runbook, Review Due')).toBeVisible();
  await expect(meta(page)).toContainText('Review Due');
  await expect(meta(page)).toContainText(/Review was due /);
  await expect(health(page).locator('[data-review-period]')).toHaveText('Every 30 Days');

  // Kept by the knowledgebase: the same after a reload.
  await page.reload();
  await titleOf(page).waitFor();
  await expect(pageRow(page, 'Runbook, Review Due')).toBeVisible();
  await expect(health(page).locator('[data-review-period]')).toHaveText('Every 30 Days');

  // Never applies at once, with no question: no page is due, and the page says it has no review period.
  await change.click();
  done = stored();
  await period('Never').click();
  expect((await done).ok()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(pageRow(page, 'Runbook')).toBeVisible();
  await expect(health(page).locator('[data-review-due]')).toHaveText('No Review Period');
  await expect(meta(page)).not.toContainText(/Review (was )?due/);
  expectNoPageErrors(pageErrors);
});
