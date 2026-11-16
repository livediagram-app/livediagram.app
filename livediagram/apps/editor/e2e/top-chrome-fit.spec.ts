import { expect, expectNoPageErrors, startBlankDocument, test } from './fixtures';

// docs/specs/007-editor/toolbar-layout.md "The tab's name" (Work Tracker 1038): from 640 to 1440px wide the palette
// strip never covers the top-left menu box (menu button, mode switch, tab name). Short of room the mode switch drops
// to its icon, then the name hides; the button and the switch are never cut, and a shown name truncates with an
// ellipsis inside the box.
const LONG_NAME = 'Quarterly planning for the platform team';
// NAME_SLOT_MIN_PX less the name's own padding and hairline: a shown name is never a sliver.
const NAME_MIN = 40;

for (const width of [640, 700, 768, 900, 1024, 1440]) {
  test(`at ${width}px the strip and the menu box keep apart`, async ({ page, pageErrors }) => {
    // Below about 695px the category bar (551px, which cannot fold in livediagram) leaves room for the menu button
    // alone: split out of Work Tracker 1038 until the bar folds as livedesign's and livedocuments' do.
    test.fixme(
      width < 695,
      'the category bar is wider than the room beside the menu button and mode switch',
    );
    // Named at a wide window, where the box shows the name to click, then narrowed: a bare box hides it, and the
    // box follows the window down (watchMove re-cuts on a resize, Work Tracker 1027).
    await page.setViewportSize({ width: 1440, height: 900 });
    await startBlankDocument(page);
    const name = page.locator('[data-toolbar-menu] [data-tab-name-in-box]');
    await name.click();
    const field = page.getByRole('textbox', { name: 'Tab name' });
    await field.fill(LONG_NAME);
    await field.press('Enter');
    await expect(name).toHaveText(LONG_NAME);
    await page.setViewportSize({ width, height: 900 });
    const strip = page.locator('[data-toolbar-palette] [data-tour-id="palette"]');
    const menu = page.locator('[data-toolbar-menu]').first();
    // The strip settles (crowded to the right, or centred) and the box takes the room left of it.
    await expect
      .poll(async () => {
        const [s, m] = [await strip.boundingBox(), await menu.boundingBox()];
        return s && m ? Math.round(s.x - (m.x + m.width)) : -1;
      })
      .toBeGreaterThanOrEqual(8);
    const box = (await menu.boundingBox())!;
    const form = await menu.getAttribute('data-menu-form');
    // The menu button and the mode switch stand whole inside the box, never cut.
    for (const part of [
      menu.getByRole('button', { name: 'Explorer' }),
      menu.getByRole('button', { name: /^Editor mode:/ }),
    ]) {
      const r = (await part.boundingBox())!;
      expect(r.x + r.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      expect(await part.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    }
    const chipText = await menu.getByRole('button', { name: /^Editor mode:/ }).textContent();
    if (form === 'full') expect(chipText).toBe('Diagram');
    else expect(chipText).toBe('');
    if (form === 'bare') {
      // No room for a readable name: hidden with its hairline, never a sliver.
      await expect(name).toBeHidden();
    } else {
      await expect(name).toHaveText(LONG_NAME);
      const n = (await name.boundingBox())!;
      expect(n.width).toBeGreaterThanOrEqual(NAME_MIN);
      expect(n.x + n.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    }
    // A wide window keeps everything whole, with the strip moved right if it needs to.
    if (width >= 1024) expect(form).toBe('full');
    expectNoPageErrors(pageErrors);
  });
}
