import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { untilHydrated, expect, expectNoPageErrors, startBlankDocument, test } from './fixtures';

// Menus by keyboard alone (docs/specs/004-interface-design/menus.md): a command menu is a `menu` of
// menu items with one tab stop, the arrows, typeahead, a submenu on Right / Left, and focus back
// where it was on Escape; a control menu is a named non-modal dialog that takes focus when the
// keyboard opened it. Dark mode, desktop. MENU_SHOTS=<dir> also writes the focus-state screenshots. The page tree's
// row menu by keyboard is page-tree.spec.ts's.

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

  // The knowledgebase's menu (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The knowledgebase's menu"):
  // the name in the sidebar's head is its button. liveknowledge has no zoom menu: the browser's zoom is the page's.
  test('the knowledgebase menu opens on Down Arrow, takes focus and gives it back', async ({
    page,
    pageErrors,
  }) => {
    await startBlankDocument(page);

    const name = page.locator('[data-knowledgebase-menu]');
    await expect(name).toHaveAttribute('aria-haspopup', 'menu');
    await name.focus();
    // Focus alone does not open it; Down Arrow does.
    await expect(page.getByRole('menu')).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(name).toHaveAttribute('aria-expanded', 'true');
    // The menu moves focus in over the next frames (useMenu), so this waits for it rather than checking once.
    await expect.poll(() => menu.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    // An Editor's rows, Delete last.
    await expect(menu.getByRole('menuitem', { name: 'Knowledgebase Style' })).toBeVisible();
    await page.keyboard.press('End');
    await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
    await shot(page, 'after-knowledgebase-menu-focus');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(name).toBeFocused();
    expectNoPageErrors(pageErrors);
  });

  // In an editor the logo is a plain link, with no site switcher: no chevron to reach, and hovering it opens no
  // card (liveworkspace/docs/specs/010-site/site-switcher.md "Where it shows").
  test('the editor logo opens no site switcher, on hover or from the keyboard', async ({
    page,
    pageErrors,
  }) => {
    await startBlankDocument(page);
    // No header bar (experiment): the logo has a card of its own beside the menu card (MenuCardLogo).
    const header = page.locator('[data-toolbar-menu]').locator('..');
    const logo = header.getByRole('link', { name: 'liveknowledge' });
    await untilHydrated(logo);
    await logo.hover();
    await logo.focus();
    await expect(header.getByRole('button', { name: 'Switch site' })).toHaveCount(0);
    await expect(page.getByRole('menu', { name: 'liveworkspace sites' })).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});
