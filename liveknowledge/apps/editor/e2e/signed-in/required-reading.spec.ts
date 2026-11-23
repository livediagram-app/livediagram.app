import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, test } from '../fixtures';
import { nameOpenPage, pageRow, titleOf, writeLines } from '../knowledgebase';
import {
  openView,
  person,
  secondPerson,
  shareCode,
  signedInKnowledgebase,
} from './knowledge-session';

// Required Reading (docs/specs/030-knowledgebase/required-reading.md; blueprints/required-reading.md), signed in: the
// owner, an Editor, requires a page for everyone from Page Info; a Viewer arriving through a view link sees the banner,
// confirms, and the owner sees who has read it; saving with Ask Everyone to Read Again asks the Viewer again; AI
// Knowledge lists the page with its counts. E2E_SHOTS=<dir> keeps a picture of each step.

test.use({ viewport: { width: 1440, height: 860 } });

const rail = (page: Page) => page.getByRole('complementary', { name: 'Page Info' });
const section = (page: Page) => rail(page).locator('[data-page-reading]');
const banner = (page: Page) => page.getByRole('region', { name: 'Required Reading' });
const shot = async (page: Page, name: string) => {
  const dir = process.env.E2E_SHOTS;
  if (!dir) return;
  // Settled first: the fades and the save's flash finish before the picture.
  await page.waitForTimeout(700);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ).catch(() => undefined),
  );
  await page.screenshot({ path: `${dir}/${name}.png` });
};

test('Required Reading: required, confirmed, seen by the owner, asked again, listed in AI Knowledge', async ({
  page,
  browser,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(180_000);
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Expenses Policy');
  await writeLines(page, 'Keep every receipt and claim within 30 days.');
  await page.locator('[data-page-edit-save]').click();
  await expect(page.locator('[data-page-edit]')).toBeVisible();

  // An Editor on a page that is not required: one line and Require Reading.
  await expect(section(page)).toHaveAttribute('data-page-reading', 'off');
  await section(page).getByRole('button', { name: 'Require Reading' }).click();
  const dialog = page.getByRole('dialog', { name: 'Required Reading' });
  await expect(dialog.getByRole('radio', { name: /Everyone/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await dialog.getByRole('radio', { name: /Chosen People/ }).click();
  await expect(dialog.getByRole('button', { name: 'Require Reading' })).toBeDisabled();
  await shot(page, '01-setup-chosen-people');
  await dialog.getByRole('radio', { name: /Everyone/ }).click();
  await dialog.getByRole('button', { name: 'Require Reading' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(section(page)).toHaveAttribute('data-page-reading', 'everyone');
  // The owner is asked too: the banner above the meta row, and the rail's own line.
  await expect(banner(page)).toBeVisible();
  await expect(section(page).getByText('0 of 1 has read it')).toBeVisible();
  await shot(page, '02-owner-banner-and-rail');

  const viewer = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${await shareCode(page, who, id, 'view')}`,
    person('Alan', 'Turing'),
  );
  await pageRow(viewer, 'Expenses Policy').click();
  await expect(titleOf(viewer)).toHaveText('Expenses Policy');
  await expect(banner(viewer)).toBeVisible();
  await shot(viewer, '03-viewer-banner');
  await banner(viewer).getByRole('button', { name: "I've Read This" }).click();
  await expect(banner(viewer)).toHaveCount(0);
  await expect(section(viewer).locator('[data-reading-mine="read"]')).toBeVisible();
  // A Viewer sees the counts and their own state, never who.
  await expect(section(viewer).getByText('Not Yet')).toHaveCount(0);
  await shot(viewer, '04-viewer-confirmed');

  // The owner sees who has read it, after a fresh read.
  await page.reload();
  await expect(titleOf(page)).toHaveText('Expenses Policy');
  await expect(section(page).getByText('1 of 2 have read it')).toBeVisible();
  await expect(section(page).getByRole('region', { name: 'Read' })).toContainText('Alan');
  await expect(section(page).getByRole('region', { name: 'Not Yet' })).toBeVisible();
  await section(page).scrollIntoViewIfNeeded();
  await shot(page, '05-owner-sees-who');

  // A significant change asks everyone again.
  await page.locator('[data-page-edit]').click();
  const toggle = page.getByRole('switch', { name: 'Ask Everyone to Read Again' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await shot(page, '06-ask-again-toggle');
  const asked = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/read-again'),
  );
  await page.locator('[data-page-edit-save]').click();
  expect((await asked).ok()).toBe(true);
  await expect(page.getByText('Everyone is asked to read it again.')).toBeVisible();
  await shot(page, '07-asked-again-toast');
  await viewer.reload();
  await pageRow(viewer, 'Expenses Policy').click();
  await expect(banner(viewer)).toContainText('This page changed on');

  // AI Knowledge lists it with its counts.
  await openView(page, 'AI Knowledge');
  const card = page.locator('[data-ai-section="ai-required-reading"]');
  await expect(card.locator('[data-required-reading]')).toHaveCount(1);
  // Without a team, Everyone counts the owner and those who confirmed this round: Alan counts again once he confirms.
  await expect(card).toContainText('0 of 1');
  await card.scrollIntoViewIfNeeded();
  await shot(page, '08-ai-knowledge-card');

  // On a phone the banner's button takes the whole width.
  await viewer.setViewportSize({ width: 390, height: 844 });
  await expect(banner(viewer)).toBeVisible();
  await shot(viewer, '09-viewer-banner-phone');

  expectNoPageErrors(pageErrors);
  await viewer.context().close();
});
