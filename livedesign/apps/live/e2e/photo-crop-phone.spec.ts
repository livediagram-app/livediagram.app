import { test, expect, expectNoPageErrors } from './fixtures';

// docs/specs/031-photo/photo-pages.md (a phone's tools row and options sheet) and photo-tools.md "Crop": on a phone,
// Crop from the options sheet closes the sheet, so the cropped photo shows at once rather than under it, and Show
// Crop Box stays one tap on Crop in the tools row away (Work Tracker 1282).
test.describe('cropping a photo on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Crop closes the sheet, and Show Crop Box is a tap on Crop away', async ({
    page,
    pageErrors,
  }) => {
    await page.goto('/new');
    await page
      .getByRole('button', { name: /^Photo Edit/ })
      .first()
      .click();
    const cropTool = page.getByRole('button', { name: 'Crop (C)' });
    await cropTool.tap();
    // The crop box is under way: its bar holds Options, which opens the sheet.
    const bar = page.getByRole('toolbar', { name: 'Crop' });
    await bar.getByRole('button', { name: 'Options' }).tap();
    const sheet = page.locator('[data-bottom-sheet]');
    await expect(sheet).toBeVisible();
    await sheet.getByText('1:1', { exact: true }).tap();
    await sheet.getByRole('button', { name: 'Crop', exact: true }).tap();
    await expect(sheet).toHaveCount(0);
    await expect(bar).toHaveCount(0);
    // The tool is still in hand: a tap on it opens the sheet again, offering Show Crop Box.
    await cropTool.tap();
    await expect(sheet.getByRole('button', { name: 'Show Crop Box' })).toBeVisible();
    expectNoPageErrors(pageErrors);
  });
});
