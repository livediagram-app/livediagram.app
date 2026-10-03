import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, mintSignedGuest, test } from './fixtures';
import { asGuest } from './home-seed';
import { syntheticExportZip } from './ms-whiteboard-board';

// Making a document is a use, a bulk import is not (docs/specs/013-workspace/explorer-home.md
// "Making a document"), end to end against the real build and api worker, as a guest, in dark
// mode: a board imported on its own is in Home's Jump back in without being opened; a two-board
// import puts neither there, though both are on the Recent page.

test.use({ colorScheme: 'dark' });

const SINGLE_BOARD = 'Sprint board';
const UNTITLED_BOARD = 'Whiteboard, 1 Jan 2026';

/** The Explorer's Microsoft Whiteboard import of a synthesised export of `boards` boards. */
async function importBoards(page: Page, boards: 1 | 2): Promise<void> {
  await page.goto('/explorer/recent');
  await page
    .getByRole('toolbar', { name: 'Import from' })
    .getByRole('button', { name: 'Import from Microsoft Whiteboard' })
    .click();
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

const jumpBackIn = (page: Page) => page.getByRole('list', { name: 'Jump back in' });

async function freshGuest(page: Page): Promise<void> {
  await asGuest(page, await mintSignedGuest(page.request));
}

test('a board imported on its own is in Jump back in without being opened', async ({
  page,
  pageErrors,
}) => {
  await freshGuest(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await importBoards(page, 1);

  await page.goto('/explorer/home');
  const tile = jumpBackIn(page).getByRole('link', { name: SINGLE_BOARD });
  await expect(tile).toBeVisible();
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('single-import-home-desktop.png') });

  // A phone: the same board in the strip, before its See more tile.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tile).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('single-import-home-phone.png') });
  expectNoPageErrors(pageErrors);
});

test('a two-board import marks neither used: Jump back in stays empty, Recent has both', async ({
  page,
  pageErrors,
}) => {
  await freshGuest(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await importBoards(page, 2);

  await page.goto('/explorer/home');
  const jump = page.getByRole('region', { name: 'Jump back in' });
  await expect(jump).toContainText('The documents you use most and last will gather here.');
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('bulk-import-home-desktop.png') });

  await page.goto('/explorer/recent');
  await expect(page.getByRole('link', { name: SINGLE_BOARD }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: UNTITLED_BOARD }).first()).toBeVisible();

  // Opened, one of them joins.
  await page.getByRole('link', { name: SINGLE_BOARD }).first().click();
  await expect(page).toHaveURL(/\/document\//);
  await expect(page.getByText(SINGLE_BOARD).first()).toBeVisible();
  await page.goto('/explorer/home');
  await expect(jumpBackIn(page).getByRole('link', { name: SINGLE_BOARD })).toBeVisible();
  await expect(jumpBackIn(page).getByRole('link', { name: UNTITLED_BOARD })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
