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

// Reactions on a page (docs/specs/030-knowledgebase/page-reactions.md; blueprints/page-reactions.md), signed in: the
// owner claps from the capsule left of Edit; a Viewer arriving (theirs left of Zen) through a view link sees it at once, adds a heart and
// a clap of their own and takes the clap back, each side seeing the other's at once; kept by the api over a reload.

test.use({ viewport: { width: 1440, height: 860 } });

const capsule = (page: Page) => page.locator('[data-page-reactions]');
const segment = (page: Page, emoji: string) =>
  capsule(page).locator(`[data-reaction-segment="${emoji}"]`);
const picker = (page: Page) => page.locator('[data-reaction-picker]');

async function pick(page: Page, name: string): Promise<void> {
  await capsule(page).getByRole('button', { name: 'Add Reaction' }).click();
  await picker(page).getByRole('button', { name, exact: true }).click();
  await expect(picker(page)).toHaveCount(0);
}

test('reactions beside Edit: anyone signed in reacts, a Viewer too, live for everyone', async ({
  page,
  browser,
  baseURL,
  pageErrors,
}) => {
  test.setTimeout(150_000);
  const { who, id } = await signedInKnowledgebase(page);
  await nameOpenPage(page, 'Runbook');
  const saved = savedWith(page, 'blue lever');
  await writeLines(page, 'Restart the queue worker with the blue lever.');
  await saved;
  await page.locator('[data-page-edit-save]').click();

  // Reading: the capsule stands left of Edit, with only Add Reaction while nobody has reacted.
  await expect(capsule(page)).toBeVisible();
  const corner = page.locator('[data-page-read-corner]');
  await expect(corner.locator('> *').last()).toHaveAttribute('data-page-edit', '');
  await pick(page, 'Clap');
  await expect(segment(page, '👏')).toHaveAttribute('aria-pressed', 'true');
  await expect(segment(page, '👏')).toHaveAccessibleName('Clap, 1');

  const viewer = await secondPerson(
    browser,
    baseURL!,
    `/document/${id}?s=${await shareCode(page, who, id, 'view')}`,
    person('Alan', 'Turing'),
  );
  await pageRow(viewer, 'Runbook').click();
  await expect(titleOf(viewer)).toHaveText('Runbook');
  // A Viewer has no Edit: the capsule stands left of Zen, clear of it, and they may react.
  await expect(viewer.locator('[data-page-edit]')).toHaveCount(0);
  const zen = (await viewer.locator('[data-zen-control]').boundingBox())!;
  const own = (await capsule(viewer).boundingBox())!;
  expect(own.x + own.width).toBeLessThanOrEqual(zen.x);
  await expect(segment(viewer, '👏')).toHaveAttribute('aria-pressed', 'false');
  await pick(viewer, 'Heart');
  await expect(segment(page, '❤️')).toHaveAccessibleName('Heart, 1');
  await segment(viewer, '👏').click();
  await expect(segment(page, '👏')).toHaveAccessibleName('Clap, 2');
  // Hovering names who reacted.
  await segment(page, '👏').hover();
  await expect(page.getByRole('tooltip')).toContainText('You and Alan Turing reacted');
  // Pressing your own again takes it back.
  await segment(viewer, '👏').click();
  await expect(segment(page, '👏')).toHaveAccessibleName('Clap, 1');

  // Any emoji, from the full list.
  await capsule(viewer).getByRole('button', { name: 'Add Reaction' }).click();
  await picker(viewer).getByLabel('Search Emoji').fill('rocket');
  await picker(viewer)
    .getByRole('button', { name: /rocket/i })
    .first()
    .click();
  await expect(segment(page, '🚀')).toBeVisible();

  // Editing: the draft bar replaces the capsule.
  await page.locator('[data-page-edit]').click();
  await expect(capsule(page)).toHaveCount(0);
  await page.locator('[data-page-edit-cancel]').click();
  await expect(capsule(page)).toBeVisible();

  await page.reload();
  await titleOf(page).waitFor();
  await expect(segment(page, '❤️')).toHaveAccessibleName('Heart, 1');
  await expect(segment(page, '👏')).toHaveAttribute('aria-pressed', 'true');
  await viewer.context().close();
  expectNoPageErrors(pageErrors);
});
