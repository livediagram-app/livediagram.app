import type { Page } from '@playwright/test';
import { test, expect, expectNoPageErrors, openStartBlank, seedTab } from './fixtures';

// The click rules (docs/specs/008-canvas/canvas-and-palette.md "Selection" and "Marquee
// box-select"): only Shift adds to a selection; a plain click on a member selects it alone, on the
// only selected element deselects it; a drag still moves, and a double-click still edits. Unit tests
// cannot see the press, drag and release pipeline end to end, so this drives a real browser.

test.use({ viewport: { width: 1800, height: 1000 }, colorScheme: 'dark', ignoreHTTPSErrors: true });

const box = (id: string, x: number) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 300,
  width: 160,
  height: 100,
  label: id,
});

// What the selection chrome shows: a multi-selection's toolbar, and the resize grips' count.
async function selection(page: Page): Promise<{ multi: boolean; grips: number }> {
  return page.evaluate(() => ({
    multi: !!document.querySelector('[aria-label="Duplicate selected elements"]'),
    grips: document.querySelectorAll('[data-canvas-handle]').length,
  }));
}

async function point(page: Page, label: string): Promise<{ x: number; y: number }> {
  const r = (await page.locator(`[aria-label='Square "${label}"']`).boundingBox())!;
  return { x: r.x + r.width * 0.4, y: r.y + r.height * 0.4 };
}

// Two clicks further apart than a double-click, so none pairs with the one before.
const settle = (page: Page) => page.waitForTimeout(600);

async function shiftClick(page: Page, p: { x: number; y: number }): Promise<void> {
  await page.keyboard.down('Shift');
  await page.mouse.click(p.x, p.y);
  await page.keyboard.up('Shift');
}

test.describe('selection clicks', () => {
  test('follow the click rules', async ({ page, pageErrors }) => {
    await openStartBlank(page);
    await seedTab(page, [box('Alpha', 620), box('Beta', 860), box('Gamma', 1100)]);
    const a = await point(page, 'Alpha');
    const b = await point(page, 'Beta');
    const c = await point(page, 'Gamma');

    await page.mouse.click(a.x, a.y);
    await shiftClick(page, b);
    await expect.poll(() => selection(page)).toMatchObject({ multi: true });

    // A plain click outside the multi-selection selects that element alone.
    await settle(page);
    await page.mouse.click(c.x, c.y);
    await expect.poll(() => selection(page)).toEqual({ multi: false, grips: 8 });

    // A plain click on a member selects it alone.
    await settle(page);
    await page.mouse.click(a.x, a.y);
    await shiftClick(page, b);
    await settle(page);
    await page.mouse.click(a.x, a.y);
    await expect.poll(() => selection(page)).toEqual({ multi: false, grips: 8 });

    // Clicking it again deselects it.
    await settle(page);
    await page.mouse.click(a.x, a.y);
    await expect.poll(() => selection(page)).toEqual({ multi: false, grips: 0 });

    // A press that drags a member still moves the whole selection.
    await settle(page);
    await page.mouse.click(a.x, a.y);
    await shiftClick(page, b);
    await settle(page);
    const before = await point(page, 'Beta');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 60, a.y + 40, { steps: 6 });
    await page.mouse.up();
    const after = await point(page, 'Beta');
    expect(Math.round(after.x - before.x)).toBeGreaterThan(40);
    await expect.poll(() => selection(page)).toMatchObject({ multi: true });

    // A double-click on the only selected element still edits it.
    await settle(page);
    const moved = await point(page, 'Alpha');
    await page.mouse.click(moved.x, moved.y);
    await settle(page);
    await page.mouse.dblclick(moved.x, moved.y);
    await expect(page.locator('[data-element-id] [contenteditable="true"]').first()).toBeFocused();

    expectNoPageErrors(pageErrors);
  });
});
