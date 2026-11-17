import type { Page } from '@playwright/test';
import { adoptGuest, expect, expectNoPageErrors, mintGuest, ownerHeaders, test } from './fixtures';
import { syntheticExportZip } from './ms-whiteboard-board';

// Making a document is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md
// "Making a document"), end to end against the real build and api worker, as a guest, in dark
// mode: a board imported on its own is in Home's Most Used and Recent without being opened; a two-board
// import puts neither there, though both are in All (Recent lists only what was opened). Home and All are the
// shared Explorer's (liveworkspace's page at /explorer, from its site build); the import is this site's /import page.

test.use({ colorScheme: 'dark' });

const SINGLE_BOARD = 'Sprint board';
const UNTITLED_BOARD = 'Whiteboard, 1 Jan 2026';

/** The Explorer's Microsoft Whiteboard import (the /import page its Import from opens) of a synthesised
 *  export of `boards` boards. */
async function importBoards(page: Page, boards: 1 | 2): Promise<void> {
  await page.goto('/import?source=microsoft-whiteboard');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a .zip' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'boards.zip',
    mimeType: 'application/zip',
    buffer: syntheticExportZip(boards),
  });
  // One board imports at once; several are listed first, to choose from.
  if (boards === 2) await page.getByRole('button', { name: 'Import 2 boards' }).click();
  await expect(page.getByTestId('import-documents')).toContainText(SINGLE_BOARD);
}

// Home's opened documents: the Most Used and Recent sections, grids on a wide screen, strips on a phone.
const homeOpened = (page: Page) =>
  page.getByRole('region', { name: /^(Most Used|Recent)$/ }).getByRole('listitem');

// Home shows each item once, in the first of New, Most Used and Recent it qualifies for
// (liveworkspace/docs/specs/004-index/one-explorer.md "Each item shows once"), so a just-imported board is in New. Four
// newer boards, made with markUsed: false (never a use), take New's four places, so where the imported ones land shows
// whether importing them was a use.
async function fillNew(page: Page, owner: string): Promise<void> {
  for (let i = 1; i <= 4; i++) {
    const res = await page.request.post('/api/documents', {
      headers: ownerHeaders(owner),
      data: {
        id: crypto.randomUUID(),
        name: `Newer ${i}`,
        tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }],
        markUsed: false,
      },
    });
    expect(res.status(), `create Newer ${i}`).toBe(201);
  }
}

async function freshGuest(page: Page): Promise<string> {
  const owner = await mintGuest(page.request);
  await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
    localStorage.setItem('livediagram:v2:ui-mode', 'dark');
  });
  return owner;
}

test('a board imported on its own is in Home’s Most Used or Recent without being opened', async ({
  page,
  pageErrors,
}) => {
  const owner = await freshGuest(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await importBoards(page, 1);
  await fillNew(page, owner);

  await page.goto('/explorer/home');
  const tile = homeOpened(page).getByRole('link', { name: SINGLE_BOARD });
  await expect(tile).toBeVisible();
  await expect(homeOpened(page).getByRole('link')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('single-import-home-desktop.png') });

  // A phone: the same board in the strip, before its See More tile.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tile).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('single-import-home-phone.png') });
  expectNoPageErrors(pageErrors);
});

test('a two-board import marks neither used: Most Used and Recent stay empty, All has both', async ({
  page,
  pageErrors,
}) => {
  const owner = await freshGuest(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await importBoards(page, 2);

  await page.goto('/explorer/home');
  const jump = page.getByRole('region', { name: 'Recent' });
  await expect(jump).toContainText(/will gather here\./);
  await expect(homeOpened(page).getByRole('link')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('bulk-import-home-desktop.png') });

  // Never opened, so not in Recent either: All lists every item the person can open.
  await page.goto('/explorer/all');
  await expect(page.getByRole('link', { name: SINGLE_BOARD }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: UNTITLED_BOARD }).first()).toBeVisible();

  // Opened, one of them joins: four newer boards first push both out of New, where each shows once.
  await fillNew(page, owner);
  await page.getByRole('link', { name: SINGLE_BOARD }).first().click();
  await expect(page).toHaveURL(/\/document\//);
  await expect(page.getByText(SINGLE_BOARD).first()).toBeVisible();
  await page.goto('/explorer/home');
  await expect(homeOpened(page).getByRole('link', { name: SINGLE_BOARD })).toBeVisible();
  await expect(homeOpened(page).getByRole('link', { name: UNTITLED_BOARD })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
