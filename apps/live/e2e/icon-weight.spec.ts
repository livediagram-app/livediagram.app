import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, seedTab, startBlankDocument, test } from './fixtures';

// A line-art icon's weight, end to end (docs/specs/004-interface-design/iconography.md, "Canvas icons"):
// the context menu's Weight row lands on the element, persists, and draws the chosen on-screen stroke.

const ICON = {
  id: 'ic',
  type: 'shape',
  shape: 'icon',
  iconId: 'server',
  x: 400,
  y: 260,
  width: 88,
  height: 88,
};

const glyphStroke = (page: Page) =>
  page
    .locator('[data-element-id="ic"] svg[viewBox="0 0 24 24"]')
    .first()
    .getAttribute('stroke-width');

test.describe('Icon weight', () => {
  test('draws regular by default and bold once chosen, across a reload', async ({
    page,
    pageErrors,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await startBlankDocument(page);
    await seedTab(page, [ICON]);

    await expect.poll(() => glyphStroke(page)).toBe('1.25');

    await page.locator('[data-element-id="ic"]').click({ button: 'right' });
    await page.getByRole('button', { name: 'Weight', exact: true }).click();
    await page.getByRole('button', { name: 'Bold', exact: true }).click();
    await expect.poll(() => glyphStroke(page)).toBe('2');

    // Autosave, then a fresh load draws the stored weight.
    await page.waitForTimeout(1500);
    await page.reload();
    await page.locator('[data-canvas-a11y-root]').waitFor();
    await expect.poll(() => glyphStroke(page)).toBe('2');

    expectNoPageErrors(pageErrors);
  });
});

test.describe('Chrome glyph weight', () => {
  test('draws the house weight in on-screen px, whatever CSS does to the size', async ({
    page,
    pageErrors,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await startBlankDocument(page);
    const glyph = page
      .getByRole('button', { name: 'Add Square', exact: true })
      .locator('svg.lvd-glyph')
      .first();
    await expect(glyph).toHaveAttribute('stroke-width', '1.25');
    const child = glyph.locator('> *').first();
    await expect
      .poll(() => child.evaluate((el) => getComputedStyle(el).getPropertyValue('vector-effect')))
      .toBe('non-scaling-stroke');
    await expect
      .poll(() =>
        glyph.evaluate((el) => (el as SVGSVGElement).style.getPropertyValue('--glyph-ink-l')),
      )
      .not.toBe('');
    expectNoPageErrors(pageErrors);
  });
});
