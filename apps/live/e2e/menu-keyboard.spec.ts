import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { apiBase } from './audit-screens';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  startBlankDocument,
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

async function guestWithFolder(page: Page, baseURL: string, name: string) {
  const owner = await mintSignedGuest(page.request);
  await page.addInitScript(
    ({ id, sig }) => {
      localStorage.setItem('livediagram:v2:ui-mode', 'dark');
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
      localStorage.setItem('livediagram:v2:self-id', id);
      if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
    },
    { id: owner, sig: guestSigFor(owner) },
  );
  const headers = ownerHeaders(owner, {
    Origin: new URL(baseURL).origin,
    'Content-Type': 'application/json',
  });
  const res = await page.request.post(`${apiBase}/folders`, {
    headers,
    data: { id: crypto.randomUUID(), name, parentId: null },
  });
  expect(res.ok()).toBe(true);
}

const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return el
      ? `${el.getAttribute('role') ?? el.tagName.toLowerCase()}:${el.textContent?.trim()}`
      : '';
  });

test.describe('menus by keyboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('the folder menu and its Use as default for submenu', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    await guestWithFolder(page, baseURL!, 'Retros');
    await page.goto('/explorer/all');
    const nav = page.getByRole('navigation', { name: 'Explorer' }).first();
    const row = nav.getByRole('treeitem', { name: 'Retros' });
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.focus();
    await page.keyboard.press('Shift+F10');
    const menu = page.getByRole('menu', { name: 'Retros' });
    await expect(menu).toBeVisible();
    await expect(menu).toMatchAriaSnapshot(`
      - menu "Retros":
        - menuitem "Rename"
        - menuitem "New Subfolder"
        - menuitem "Change Folder"
        - menuitem "Use as default for"
        - separator
        - menuitem "Delete"
    `);
    // Focus is on the first item; the arrows wrap, typeahead finds by first letters.
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('u');
    const useAs = menu.getByRole('menuitem', { name: 'Use as default for' });
    await expect(useAs).toBeFocused();
    await expect(useAs).toHaveAttribute('aria-haspopup', 'menu');
    await shot(page, 'after-folder-menu-focus');

    // Right opens the submenu on its first entry; Left comes back to its trigger.
    await page.keyboard.press('ArrowRight');
    const sub = page.getByRole('menu', { name: 'New documents that open as' });
    await expect(sub).toBeVisible();
    await expect(useAs).toHaveAttribute('aria-expanded', 'true');
    await expect(useAs).toHaveAttribute('aria-controls', (await sub.getAttribute('id'))!);
    await expect(sub.getByRole('menuitemcheckbox', { name: 'Diagrams' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press(' ');
    await expect(sub.getByRole('menuitemcheckbox', { name: 'Whiteboards' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await shot(page, 'after-folder-submenu-focus');
    await page.keyboard.press('ArrowLeft');
    await expect(sub).toHaveCount(0);
    await expect(useAs).toBeFocused();

    // Escape closes the menu and puts focus back on the tree row Shift+F10 was pressed on.
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(row).toBeFocused();

    // Tab closes it and moves on from there.
    await page.keyboard.press('Shift+F10');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(menu).toHaveCount(0);
    expect(await focusedName(page)).not.toMatch(/^menuitem/);
    expectNoPageErrors(pageErrors);
  });

  test('the element menu is a control menu that takes focus from the keyboard', async ({
    page,
    pageErrors,
  }) => {
    await startBlankDocument(page);
    await dismissQuickTour(page);
    await page.getByRole('button', { name: 'Add Square', exact: true }).click();
    await page.locator('[data-canvas-a11y-root]').click({ position: { x: 520, y: 360 } });
    const square = page.getByRole('img', { name: 'Square', exact: true });
    await expect(square).toHaveCount(1);
    const elementMenu = page.getByRole('dialog', { name: 'Element menu' });

    // From the keyboard (the selection toolbar's More actions on the new square) focus moves in,
    // and Escape brings it back.
    const more = page.getByRole('button', { name: 'More actions' });
    await expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(elementMenu).toBeVisible();
    await expect(elementMenu.getByRole('button', { name: 'Layer' })).toBeFocused();
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

  test('the tab menu is a named dialog, the zoom presets a menu of one-of-a-set levels', async ({
    page,
    pageErrors,
  }) => {
    await startBlankDocument(page);
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

    const zoom = page.getByRole('button', { name: 'Fit to screen' }).first();
    await zoom.focus();
    // Focus alone no longer opens it; Down Arrow does, on the current level.
    await expect(page.getByRole('menu', { name: 'Zoom level' })).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    const presets = page.getByRole('menu', { name: 'Zoom level' });
    await expect(presets).toBeVisible();
    await expect(presets.getByRole('menuitemradio', { name: '100%' })).toBeFocused();
    await expect(presets.getByRole('menuitemradio', { name: '100%' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await page.keyboard.press('End');
    await expect(presets.getByRole('menuitem', { name: 'Fit to screen' })).toBeFocused();
    await shot(page, 'after-zoom-menu-focus');
    await page.keyboard.press('Escape');
    await expect(presets).toHaveCount(0);
    await expect(zoom).toBeFocused();
    expectNoPageErrors(pageErrors);
  });

  test('on a phone the submenu covers its parent, its Close read last', async ({
    page,
    pageErrors,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await guestWithFolder(page, baseURL!, 'Retros');
    await page.goto('/explorer/all');
    const trigger = page.getByRole('button', { name: 'Menu for folder Retros' });
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu', { name: 'Retros' });
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
    await page.keyboard.press('u');
    await page.keyboard.press('Enter');
    const sub = page.getByRole('menu', { name: 'New documents that open as' });
    await expect(sub.getByRole('menuitemcheckbox', { name: 'Diagrams' })).toBeFocused();
    // The drill-down's header draws first but reads last, so focus opened on the first entry.
    const items = await sub.getByRole('menuitem').or(sub.getByRole('menuitemcheckbox')).all();
    expect(await items.at(-1)!.getAttribute('aria-label')).toBe('Close Use as default for');
    await shot(page, 'after-phone-folder-submenu');
    await page.keyboard.press('Escape');
    await expect(sub).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expectNoPageErrors(pageErrors);
  });

  test('the product switcher opens from the keyboard, not on focus alone', async ({
    page,
    pageErrors,
  }) => {
    await page.goto('/explorer');
    const switcher = page.getByRole('button', { name: /^Switch section/ });
    await switcher.focus();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu', { name: /^Switch section/ });
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
