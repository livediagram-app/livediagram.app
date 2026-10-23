import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  startBlankProject,
  test,
} from './fixtures';

// Menus by keyboard alone (docs/specs/004-interface-design/menus.md): a command menu is a `menu` of
// menu items with one tab stop, the arrows, typeahead, a submenu on Right / Left, and focus back
// where it was on Escape; a control menu is a named non-modal dialog that takes focus when the
// keyboard opened it. Dark mode, desktop. MENU_SHOTS=<dir> also writes the focus-state screenshots.

const SHOTS = process.env.MENU_SHOTS;
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  // Let entrance fades settle, so the shot shows the resting colours.
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

test.describe('menus by keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('the element menu is a control menu that takes focus from the keyboard', async ({
    page,
    pageErrors,
  }) => {
    await startBlankProject(page);
    await seedTab(page, [
      { id: 'sq', type: 'shape', shape: 'square', x: 400, y: 300, width: 120, height: 120 },
    ]);
    const square = page.getByRole('img', { name: 'Square', exact: true });
    await expect(square).toHaveCount(1);
    await square.click();
    const elementMenu = page.getByRole('dialog', { name: 'Element menu' });

    // From the keyboard (the selection toolbar's More actions on the new square) focus moves in,
    // and Escape brings it back.
    const more = page.getByRole('button', { name: 'More actions' });
    await expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(elementMenu).toBeVisible();
    // Focus lands on the menu's first control: the quick bar's first button, above the categories
    // (docs/specs/008-canvas/element-menu-quick-bar.md).
    await expect(elementMenu.getByRole('button').first()).toBeFocused();
    await shot(page, 'after-element-menu-focus');
    // Arrows in the menu never nudge the element; Delete never deletes it. Measured once its entry
    // animation has finished: mid-animation the box is still growing to its size.
    await square.evaluate((el) =>
      Promise.all(el.getAnimations({ subtree: true }).map((anim) => anim.finished)),
    );
    const before = await square.boundingBox();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Delete');
    await expect(square).toHaveCount(1);
    expect(await square.boundingBox()).toEqual(before);
    await page.keyboard.press('Escape');
    await expect(elementMenu).toHaveCount(0);
    await expect(square).toHaveCount(1);
    await expect(more).toBeFocused();

    // By pointer it opens beside the canvas without taking focus. (The Quick style panel covers
    // the square's left half, so the press lands on its right edge, once the panel has settled.)
    await page.waitForTimeout(400);
    const box = (await square.boundingBox())!;
    await page.mouse.click(box.x + box.width - 12, box.y + box.height / 2, { button: 'right' });
    await expect(elementMenu).toBeVisible();
    await expect(elementMenu.getByRole('menuitem')).toHaveCount(0);
    await expect(elementMenu.getByRole('button', { name: 'Layer' })).toBeVisible();
    // Collapsed sections are inert: their sliders are not in the tree.
    await expect(elementMenu.getByRole('slider')).toHaveCount(0);
    expect(await elementMenu.evaluate((el) => el.contains(document.activeElement))).toBe(false);
    await page.keyboard.press('Escape');
    await expect(elementMenu).toHaveCount(0);
    await expect(square).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });

  test('the tab menu is a named dialog', async ({
    page,
    pageErrors,
  }) => {
    await startBlankProject(page);
    await dismissQuickTour(page);

    const tabMenu = page.getByRole('button', { name: 'Tab menu' });
    await expect(tabMenu).toHaveAttribute('aria-haspopup', 'dialog');
    await tabMenu.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Tab menu' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await shot(page, 'after-tab-menu-focus');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(tabMenu).toBeFocused();

    expectNoPageErrors(pageErrors);
  });

  test('the product switcher opens from the keyboard, not on focus alone', async ({
    page,
    pageErrors,
  }) => {
    await page.goto('/explorer');
    const switcher = page.getByRole('button', { name: 'Switch site' });
    await switcher.focus();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem').first()).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menu.getByRole('menuitem').nth(1)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(switcher).toBeFocused();
    expectNoPageErrors(pageErrors);
  });
});
