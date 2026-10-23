import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, seedTab, test } from './fixtures';

// Power user mode and Minimal chrome (docs/specs/007-editor/power-user-mode.md), and the role pill
// (docs/specs/007-editor/editor-app.md#role-pill), in a real browser, dark mode.
test.use({ colorScheme: 'dark' });

const TOOLTIP = '[role="tooltip"][data-hint="tooltip"]';

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

async function setPowerUserMode(page: Page, on: boolean) {
  await openSettings(page);
  const row = dialog(page).getByRole('switch', { name: 'Power User Mode' });
  await expect(row).toHaveAttribute('aria-checked', on ? 'false' : 'true');
  await row.click();
  await expect(row).toHaveAttribute('aria-checked', on ? 'true' : 'false');
}

test.describe('Role pill', () => {
  test('sits in the title bar for the owner and toggles a read-only preview', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    const pill = header(page).getByRole('button', { name: 'Editing. Owned by you' });
    await expect(pill).toBeVisible();

    await pill.hover();
    await expect(page.locator(TOOLTIP)).toHaveText('Owned by you', { timeout: 2_000 });

    // Each click steps the preview: Editing, Participating, Viewing, back to Editing (editor-app.md "Role pill").
    await pill.click();
    const participating = header(page).getByRole('button', {
      name: 'Participating. Owned by you',
    });
    await expect(participating).toBeVisible();
    await participating.click();
    const viewing = header(page).getByRole('button', { name: 'Viewing. Owned by you' });
    await expect(viewing).toBeVisible();

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
    ).toHaveCount(2);
    await closeSettings(page);
    await page.screenshot({ path: 'test-results/power-user-minimal-chrome.png' });

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
    await tabBar(page).getByRole('button', { name: 'Participating', exact: true }).click();
    await expect(
      tabBar(page).getByRole('button', { name: 'Viewing (read-only)', exact: true }),
    ).toBeVisible();
    await tabBar(page).getByRole('button', { name: 'Viewing (read-only)', exact: true }).click();

    // Selection: no caption, no desktop bin, no More; the keys still delete.
    await seedTab(page, [
      { id: 'sq', type: 'shape', shape: 'square', x: 400, y: 300, width: 120, height: 120 },
    ]);
    await page.getByRole('img', { name: 'Square', exact: true }).click();
    const toolbar = page.getByRole('toolbar', { name: 'Selected Square' });
    await expect(toolbar).toBeVisible();
    await expect(page.getByText('Selected Square', { exact: true })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await expect(toolbar.getByRole('button', { name: 'More actions' })).toHaveCount(0);
    await page.keyboard.press('Backspace');
    await expect(page.locator('[data-element-id]')).toHaveCount(0);

    // The help centre stays in the Explorer's footer links.
    await page.getByRole('button', { name: 'Explorer', exact: true }).click();
    await expect(
      page.getByRole('navigation', { name: 'Go to' }).getByRole('link', { name: 'Help' }),
    ).toHaveAttribute('href', /\/help\/?$/);
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
    expect(await page.evaluate(() => localStorage.getItem('liveplanner:v2:ui-mode'))).toBe(
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
