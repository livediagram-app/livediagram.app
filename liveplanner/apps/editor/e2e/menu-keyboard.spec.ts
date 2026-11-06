import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  startBlankProject,
  test,
  untilHydrated,
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

  test('the tab menu is a named dialog', async ({ page, pageErrors }) => {
    await startBlankProject(page);
    await dismissQuickTour(page);

    const tabMenu = page.getByRole('button', { name: 'Tab menu' });
    await expect(tabMenu).toHaveAttribute('aria-haspopup', 'dialog');
    await tabMenu.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Tab menu' });
    await expect(dialog).toBeVisible();
    // The menu moves focus in over the next frames (useMenu), so this waits for it rather than checking once.
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
    await shot(page, 'after-tab-menu-focus');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(tabMenu).toBeFocused();

    expectNoPageErrors(pageErrors);
  });

  // Start Planning's code loads when it is first drawn, so on a busy machine it mounts after the keyboard has opened
  // the tab menu. Its search takes focus as it opens only while focus is free (docs/specs/007-editor/start-panel.md
  // "Keyboard"): here its chunk is held until focus is in the menu, and the menu keeps it.
  test('a late Start Planning never takes focus from the open tab menu', async ({
    page,
    pageErrors,
  }) => {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let held = 0;
    await page.route('**/_next/static/chunks/**', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      if (body.includes('Find a board, sheet, form or layout')) {
        held += 1;
        await released;
      }
      await route.fulfill({ response, body });
    });
    await startBlankProject(page);
    const tabMenu = page.getByRole('button', { name: 'Tab menu' });
    await expect(tabMenu).toHaveAttribute('aria-haspopup', 'dialog');
    // The panel's chunk is the one held, so the panel is still to come.
    await expect.poll(() => held).toBe(1);
    await expect(page.getByRole('region', { name: 'Start Planning' })).toHaveCount(0);
    await tabMenu.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Tab menu' });
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
    release();
    await expect(page.getByRole('region', { name: 'Start Planning' })).toBeVisible();
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(tabMenu).toBeFocused();
    expectNoPageErrors(pageErrors);
  });

  // In an editor the logo is a plain link, with no site switcher: no chevron to reach, and hovering it opens no
  // card (liveworkspace/docs/specs/010-site/site-switcher.md "Where it shows").
  test('the editor logo opens no site switcher, on hover or from the keyboard', async ({
    page,
    pageErrors,
  }) => {
    await startBlankProject(page);
    const header = page.locator('header[data-region="header"]');
    const logo = header.getByRole('link', { name: 'liveplanner' });
    await untilHydrated(logo);
    await logo.hover();
    await logo.focus();
    await expect(header.getByRole('button', { name: 'Switch site' })).toHaveCount(0);
    await expect(page.getByRole('menu', { name: 'liveworkspace sites' })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});
