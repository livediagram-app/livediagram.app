import { fileURLToPath } from 'node:url';
import { expect, expectNoPageErrors, startBlankProject, test, createInMode } from './fixtures';
import type { Page } from '@playwright/test';

// A board from another tool, end to end (docs/specs/026-plan/tracker-import.md): Start Planning's Import card opens
// the Import dialog, a tool's row picks the export, the preview says where it goes, and Import makes the board with
// its columns, its cards and each card's Imported comments thread. The exports are the readers' own fixtures.

const fixture = (name: string) =>
  fileURLToPath(
    new URL(`../../../packages/items/src/tracker-import/fixtures/${name}`, import.meta.url),
  );

const board = (page: Page) => page.locator('[data-plan-board]').first();

// The board's column names, as their settings buttons say them.
const columns = (page: Page) =>
  board(page)
    .getByRole('button', { name: / column settings$/ })
    .evaluateAll((ns) =>
      ns.map((n) => (n.getAttribute('aria-label') ?? '').replace(' column settings', '')),
    );

// Start Planning's Import card, then a tool's row and the file it asks for.
async function importFrom(page: Page, tool: string, file: string) {
  await page.getByRole('button', { name: /^Import:/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Import' });
  await expect(dialog).toBeVisible();
  // The format is the first decision: focus starts on the list's first row.
  await expect(dialog.getByRole('button', { name: /^liveplanner Tab:/ })).toBeFocused();
  const chooser = page.waitForEvent('filechooser');
  await dialog.getByRole('button', { name: new RegExp(`^${tool}: `) }).click();
  await (await chooser).setFiles(fixture(file));
  await expect(dialog.getByRole('heading', { name: `Import from ${tool}` })).toBeVisible();
  return dialog;
}

// A card opened from the board, its Imported comments thread among its threads.
async function expectImportedThread(page: Page, title: string) {
  await board(page).locator('[data-plan-card]').filter({ hasText: title }).first().click();
  await expect(page.getByRole('button', { name: /^Imported comments/ })).toBeVisible();
}

test('a Jira export becomes a new Board tab of this plan, its comments on each card', async ({
  page,
  pageErrors,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await startBlankProject(page);
  const planUrl = page.url();

  const dialog = await importFrom(page, 'Jira', 'jira-issues.csv');
  await expect(dialog.getByRole('radio', { name: /This Plan/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(dialog).toBeHidden();

  // A new tab of the same plan, opened on the board: the same plan path, a different tab in the hash.
  const before = new URL(planUrl);
  await expect.poll(() => new URL(page.url()).hash).not.toBe(before.hash);
  expect(new URL(page.url()).pathname).toBe(before.pathname);
  await expect(board(page)).toBeVisible();
  await expect
    .poll(() => columns(page))
    .toEqual(expect.arrayContaining(['In Progress', 'To Do', 'Done']));
  for (const title of ['Checkout fails for EU cards', 'Add Apple Pay', 'Refresh product photos'])
    await expect(board(page).locator('[data-plan-card]').filter({ hasText: title })).toHaveCount(1);
  await expectImportedThread(page, 'Checkout fails for EU cards');
  expectNoPageErrors(pageErrors);
});

test('a Trello board becomes a new plan, opened with its lists, cards and comments', async ({
  page,
  pageErrors,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const first = await createInMode(page);

  const dialog = await importFrom(page, 'Trello', 'trello-board.json');
  await dialog.getByRole('radio', { name: /New Plan/ }).click();
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();

  // The new plan opens in this window.
  await page.waitForURL(
    (url) => /\/project\/[^/?#]+/.test(url.pathname) && !url.pathname.endsWith(first),
    {
      timeout: 30_000,
    },
  );
  await expect(board(page)).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => columns(page)).toEqual(['Backlog', 'Doing', 'In Review', 'Done']);
  // The archived list and cards stay behind.
  await expect(board(page).locator('[data-plan-card]')).toHaveCount(5);
  await expect(
    board(page).locator('[data-plan-card]').filter({ hasText: 'Old banner' }),
  ).toHaveCount(0);
  await expectImportedThread(page, 'Design the new hero section');
  expectNoPageErrors(pageErrors);
});
