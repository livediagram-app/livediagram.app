import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// Power user mode and Minimal chrome (docs/specs/007-editor/power-user-mode.md), and the role pill
// (docs/specs/007-editor/live-app.md#role-pill), in a real browser, dark mode.
test.use({ colorScheme: 'dark' });

const TOOLTIP = '[role="tooltip"][data-hint="tooltip"]';
const PREFS_KEY = 'livediagram:user-preferences:v1';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const tabBar = (page: Page) => page.locator('[data-editor-tabbar]');
const header = (page: Page) => page.locator('header');

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Straight to a blank canvas: the /new?blank=1 bypass (Start Blank).
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
}

async function openSettings(page: Page) {
  await page.getByRole('button', { name: 'Application settings' }).click();
  await dialog(page).waitFor();
}

async function closeSettings(page: Page) {
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
}

async function storedPrefs(page: Page): Promise<Record<string, unknown>> {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), PREFS_KEY);
}

async function setPowerUserMode(page: Page, on: boolean) {
  await openSettings(page);
  const row = dialog(page).getByRole('switch', { name: 'Power User Mode' });
  await expect(row).toHaveAttribute('aria-checked', on ? 'false' : 'true');
  await row.click();
  await expect(row).toHaveAttribute('aria-checked', on ? 'true' : 'false');
}

// Focus by keyboard, so :focus-visible holds and the Tooltip opens at once.
async function keyboardFocus(page: Page, selector: ReturnType<Page['locator']>) {
  await selector.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(selector).toBeFocused();
}

test.describe('Role pill', () => {
  test('sits in the title bar for the owner and toggles a read-only preview', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    const pill = header(page).getByRole('button', { name: 'Editing. Owned by you' });
    await expect(pill).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Add square', exact: true }).first(),
    ).toBeVisible();

    await pill.hover();
    await expect(page.locator(TOOLTIP)).toHaveText('Owned by you', { timeout: 2_000 });

    await pill.click();
    const viewing = header(page).getByRole('button', { name: 'Viewing. Owned by you' });
    await expect(viewing).toBeVisible();
    // Read-only: the palette's add tiles are gone.
    await expect(page.getByRole('button', { name: 'Add square', exact: true })).toHaveCount(0);

    await viewing.click();
    await expect(pill).toBeVisible();
    expectNoPageErrors(pageErrors);
  });
});

test.describe('Power user mode', () => {
  test('Minimal chrome hides words, keeps names and controls', async ({ page, pageErrors }) => {
    await openEditor(page);
    await expect(tabBar(page).getByText('Tabs', { exact: true })).toBeVisible();
    await expect(tabBar(page).getByText('Search', { exact: true })).toBeVisible();

    await setPowerUserMode(page, true);
    // The mode's children, nested beneath it: Minimal Chrome, then what the preset set.
    const children = dialog(page).getByRole('group', { name: 'Power User Mode settings' });
    await expect(children.getByRole('switch', { name: 'Minimal Chrome' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(
      children.getByRole('list', { name: 'Set By Power User Mode' }).getByRole('listitem'),
    ).toHaveCount(5);
    await closeSettings(page);
    await page.screenshot({ path: 'test-results/power-user-minimal-chrome.png' });

    // Kept: the empty-canvas banner holds actions, so it is a control, not a hint.
    await expect(page.getByText('Tab 1 is empty')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Start' })).toBeVisible();

    // Status bar: icons only, names kept.
    await expect(tabBar(page).getByText('Tabs', { exact: true })).toHaveCount(0);
    await expect(tabBar(page).getByText('Search', { exact: true })).toHaveCount(0);
    await expect(tabBar(page).getByRole('button', { name: 'Search' })).toBeVisible();

    // The role pill became the status bar's first control.
    await expect(header(page).locator('[data-role-pill]')).toHaveCount(0);
    const roleIcon = tabBar(page).getByRole('button', { name: 'Editing', exact: true });
    await expect(roleIcon).toBeVisible();
    await roleIcon.hover();
    await page.waitForTimeout(400);
    await expect(page.locator(TOOLTIP)).toHaveCount(0);
    await expect(page.locator(TOOLTIP)).toHaveText('Editing', { timeout: 1_500 });
    await roleIcon.click();
    await expect(
      tabBar(page).getByRole('button', { name: 'Viewing (read-only)', exact: true }),
    ).toBeVisible();
    await tabBar(page).getByRole('button', { name: 'Viewing (read-only)', exact: true }).click();

    // Palette tile: no caption; the name comes back on keyboard focus.
    const square = page.getByRole('button', { name: 'Add square', exact: true }).first();
    // The strip's always-visible shortcut letter is a kept hint; the caption is gone.
    await expect(square).not.toContainText('Square');
    await page.mouse.move(700, 500);
    await keyboardFocus(page, square);
    await expect(page.locator(TOOLTIP)).toHaveText('Add square', { timeout: 300 });

    // Selection: no caption, no desktop bin, no More; the keys still delete.
    await square.click();
    await page.mouse.click(640, 420);
    const shape = page.locator('[data-element-id]').first();
    await expect(shape).toBeVisible();
    // Placing selects the square; a click on it now would deselect it
    // (docs/specs/008-canvas/canvas-and-palette.md "Click the selected element again").
    const toolbar = page.getByRole('toolbar', { name: 'Selected Square' });
    await expect(toolbar).toBeVisible();
    await expect(page.getByText('Selected Square', { exact: true })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'More actions' })).toHaveCount(0);
    await page.keyboard.press('Backspace');
    await expect(page.locator('[data-element-id]')).toHaveCount(0);

    // Panel headers: the title stays for assistive technology only, and the
    // help button goes.
    await page
      .getByRole('button', { name: /layers/i })
      .first()
      .click();
    const layersTitle = page.locator('.sr-only', { hasText: /^Layers$/ });
    await expect(layersTitle).toHaveCount(1);
    await expect(page.getByRole('link', { name: /learn about layers/i })).toHaveCount(0);
    // A panel without a ⋯ menu just drops its help; the help centre stays in
    // the header's Editor menu.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Switch section, currently Editor$/ }).click();
    await expect(page.getByRole('menuitem', { name: /^Help/ })).toHaveAttribute(
      'href',
      /\/help\/?$/,
    );
    expectNoPageErrors(pageErrors);
  });

  test('switching off restores untouched settings and keeps changed ones', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    // Before: alignment guides off (left alone later), auto-attach arrows on (the default).
    await openSettings(page);
    await dialog(page).getByRole('switch', { name: 'Alignment Guides' }).click();
    await closeSettings(page);
    expect((await storedPrefs(page)).alignmentGuides).toBe(false);

    await setPowerUserMode(page, true);
    let prefs = await storedPrefs(page);
    expect(prefs).toMatchObject({
      powerUserMode: true,
      autoRebindArrows: true,
      alignmentGuides: true,
    });

    // Change one preset setting while the mode is on, reached from the readout.
    await dialog(page).getByRole('button', { name: 'Change Auto-Attach Arrows in Editor' }).click();
    await dialog(page).getByRole('switch', { name: 'Auto-Attach Arrows' }).click();
    const readout = dialog(page).getByRole('list', { name: 'Set By Power User Mode' });
    await expect(readout.getByRole('listitem').first()).toContainText(
      'Restored when you switch off',
    );
    await expect(readout.getByRole('listitem').nth(1)).toContainText(
      'Changed: kept when you switch off',
    );
    await dialog(page).getByRole('switch', { name: 'Power User Mode' }).click();
    await closeSettings(page);

    prefs = await storedPrefs(page);
    expect(prefs.powerUserMode).toBeUndefined();
    expect(prefs.powerUserBaseline).toBeUndefined();
    // Untouched: back to what it was.
    expect(prefs.alignmentGuides).toBe(false);
    // Changed: the user's change stays.
    expect(prefs.autoRebindArrows).toBe(false);
    // Minimal chrome is off with the mode.
    await expect(tabBar(page).getByText('Search', { exact: true })).toBeVisible();
    expectNoPageErrors(pageErrors);
  });

  test('the Appearance control flips on click and follows the device on right-click', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    const appearance = tabBar(page).getByRole('button', { name: /^Appearance: / });
    const painted = () =>
      page.evaluate(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
    // Outside the mode: the three-step cycle, System first on this dark device.
    await expect(appearance).toHaveAccessibleName('Appearance: System. Switch to Light.');

    await setPowerUserMode(page, true);
    await closeSettings(page);
    await expect(appearance).toHaveAccessibleName(
      'Appearance: System. Switch to Light. Right-click to follow your device.',
    );

    await appearance.click();
    await expect(appearance).toHaveAccessibleName(/^Appearance: Light\. Switch to Dark\./);
    expect(await painted()).toBe('light');
    await appearance.click();
    await expect(appearance).toHaveAccessibleName(/^Appearance: Dark\. Switch to Light\./);
    expect(await painted()).toBe('dark');
    await appearance.click();
    await expect(appearance).toHaveAccessibleName(/^Appearance: Light\./);

    // Right-click: back to System, which paints this device's dark, and no browser menu.
    await appearance.click({ button: 'right' });
    await expect(appearance).toHaveAccessibleName(/^Appearance: System\./);
    expect(await painted()).toBe('dark');
    expect(await page.evaluate(() => localStorage.getItem('livediagram:v2:ui-mode'))).toBe(
      'system',
    );
    await expect(page.getByRole('menu')).toHaveCount(0);

    // The keyboard reaches System too: Shift+F10 on the focused control.
    await appearance.click();
    await expect(appearance).toHaveAccessibleName(/^Appearance: Light\./);
    await appearance.focus();
    await page.keyboard.press('Shift+F10');
    await expect(appearance).toHaveAccessibleName(/^Appearance: System\./);
    expectNoPageErrors(pageErrors);
  });
});
