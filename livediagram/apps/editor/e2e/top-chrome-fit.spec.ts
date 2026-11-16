import { expect, expectNoPageErrors, startBlankDocument, test } from './fixtures';

// docs/specs/007-editor/toolbar-layout.md "The tab's name" (Work Tracker 1038): from 640 to 1024px wide the palette
// strip never covers the top-left menu box (menu, mode switch, tab name); a long tab name truncates short of it.
const LONG_NAME = 'Quarterly planning for the platform team';

for (const width of [768, 640, 900, 1024]) {
  test(`at ${width}px the strip and the menu box keep apart`, async ({ page, pageErrors }) => {
    await page.setViewportSize({ width, height: 900 });
    await startBlankDocument(page);
    const name = page.locator('[data-toolbar-menu] [data-tab-name-in-box]');
    await name.click();
    const field = page.getByRole('textbox', { name: 'Tab name' });
    await field.fill(LONG_NAME);
    await field.press('Enter');
    await expect(name).toHaveText(LONG_NAME);
    const strip = page.locator('[data-toolbar-palette] [data-tour-id="palette"]');
    const menu = page.locator('[data-toolbar-menu]').first();
    // The strip settles (crowded to the right, or centred) and the box takes the room left of it.
    await expect
      .poll(async () => {
        const [s, m] = [await strip.boundingBox(), await menu.boundingBox()];
        return s && m ? Math.round(s.x - (m.x + m.width)) : -1;
      })
      .toBeGreaterThanOrEqual(8);
    // The name is cut with an ellipsis rather than by the strip: its box ends inside the menu box.
    const [n, m] = [await name.boundingBox(), await menu.boundingBox()];
    expect(n!.x + n!.width).toBeLessThanOrEqual(m!.x + m!.width);
    expectNoPageErrors(pageErrors);
  });
}
