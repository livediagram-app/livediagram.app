// The Microsoft Whiteboard import end to end (docs/specs/020-import-export/whiteboard-import.md
// "Importing"), on a synthesised export: list, import, report, one document per board.
import type { Page } from '@playwright/test';
import { test, expect, dismissQuickTour, expectNoPageErrors, startBlankDocument } from './fixtures';
import { syntheticExportZip } from './ms-whiteboard-board';

// The Explorer page header's "Import from" toolbar opens the import.
async function openMsWhiteboardImport(page: Page): Promise<void> {
  await page.goto('/explorer/recent');
  await page
    .getByRole('toolbar', { name: 'Import from' })
    .getByRole('button', { name: 'Import from Microsoft Whiteboard' })
    .click();
}

test('Microsoft Whiteboard boards open as their own documents with a report', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);
  test.fixme(true, 'the Explorer page needs the editor-free commit (plan 0033, Requests to F)');
  await openMsWhiteboardImport(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a .zip' }).click();
  await (
    await chooser
  ).setFiles({ name: 'boards.zip', mimeType: 'application/zip', buffer: syntheticExportZip() });

  const list = page.getByRole('group', { name: 'Boards to import' });
  await expect(list).toContainText('Sprint board');
  await expect(list).toContainText('Whiteboard, 1 Jan 2026');
  await expect(page.getByRole('button', { name: 'Import 2 boards' })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath('ms-whiteboard-list.png') });

  await page.getByRole('button', { name: 'Import 2 boards' }).click();
  const report = page.getByTestId('import-image-report');
  await expect(report).toContainText('Rainbow ink drawn in pink');
  await page.screenshot({ path: test.info().outputPath('ms-whiteboard-report.png') });
  // One new document per board, named after the board (an untitled one by its date).
  const documents = page.getByTestId('import-documents');
  await expect(documents).toContainText('Sprint board');
  await expect(documents).toContainText('Whiteboard, 1 Jan 2026');
  await documents.getByRole('link', { name: 'Sprint board' }).click();
  await expect(page.getByText('Sprint board').first()).toBeVisible();
  await expect(
    page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ }),
  ).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('ms-whiteboard-document.png') });
  expectNoPageErrors(pageErrors);
});
