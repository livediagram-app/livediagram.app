// The Microsoft Whiteboard card end to end (docs/specs/020-import-export/whiteboard-import.md
// "Importing in the dialog"), on a synthesised export: list, untick, import, report, new tabs.
import { test, expect, dismissQuickTour, expectNoPageErrors, startBlankDocument } from './fixtures';
import { syntheticExportZip } from './ms-whiteboard-board';

test('Microsoft Whiteboard boards open as new whiteboard tabs with a report', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);
  await page.getByRole('button', { name: 'Tab menu' }).click();
  await page.getByText('Content', { exact: true }).click();
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await page.getByRole('button', { name: /^Microsoft Whiteboard/ }).click();
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
  await expect(report).toContainText('Multicolour ink drawn in one colour');
  await page.screenshot({ path: test.info().outputPath('ms-whiteboard-report.png') });
  await page.getByRole('button', { name: 'Done' }).click();

  // The first new tab is active and named after its board.
  await expect(page.locator('[aria-current="page"]', { hasText: 'Sprint board' })).toBeVisible();
  await expect(
    page.locator('[data-canvas-a11y-root]').getByRole('img', { name: /^Sticky note/ }),
  ).toHaveCount(1);
  await page.screenshot({ path: test.info().outputPath('ms-whiteboard-tab.png') });
  expectNoPageErrors(pageErrors);
});
