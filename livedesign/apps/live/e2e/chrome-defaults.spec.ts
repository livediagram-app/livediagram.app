import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// The chrome everyone gets: no header bar (experiment) and no Editing Mode tool in Tools, now Power user mode is retired (docs/specs/007-editor/power-user-mode.md), in a real browser, dark mode.
test.use({ colorScheme: 'dark' });

const PREFS_KEY = 'livedesign:user-preferences:v1';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const tabBar = (page: Page) => page.locator('[data-editor-tabbar]');
const tools = (page: Page) => tabBar(page).getByRole('button', { name: /^Tools/ });

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Straight to a blank canvas: the /new?blank=1 bypass (Start Blank).
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
}

test.describe('Tools', () => {
  test('offers no Editing Mode: an owner edits, with no role to preview', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    // No header bar, so no role pill in one.
    await expect(page.locator('header[data-region="header"]')).toHaveCount(0);
    await tools(page).click();
    await expect(page.locator('[data-tools-item]').first()).toBeVisible();
    await expect(page.locator('[data-tools-item="role"]')).toHaveCount(0);
    await expect(page.getByText('Editing Mode', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    expectNoPageErrors(pageErrors);
  });
});

test.describe('Retired power user keys', () => {
  test('a stored blob with them loads the default chrome and keeps every other setting', async ({
    page,
    pageErrors,
  }) => {
    // What a person who had Power user mode on carries: the mode, its baseline, Minimal chrome, the offer's latch,
    // and the preset's values (alignment guides, auto-attach arrows, tours seen).
    await page.addInitScript((key) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem(
        key,
        JSON.stringify({
          powerUserMode: true,
          minimalChrome: true,
          powerUserOfferShown: true,
          powerUserBaseline: {
            alignmentGuides: {
              before: { alignmentGuides: false },
              applied: { alignmentGuides: true },
            },
          },
          alignmentGuides: true,
          autoRebindArrows: false,
          pagesTourSeen: true,
          elementToursSeen: true,
        }),
      );
    }, PREFS_KEY);
    await openEditor(page);

    // The default chrome: labelled status bar controls, a cycling Appearance control.
    await expect(tabBar(page).getByText('Tools', { exact: true })).toBeVisible();
    await expect(tabBar(page).getByRole('button', { name: /^Appearance: / })).toHaveAccessibleName(
      'Appearance: System. Switch to Light.',
    );

    // Settings: no Power User heading or rows; the preset's values stand.
    await page.getByRole('button', { name: 'Application settings' }).click();
    await dialog(page).getByRole('button', { name: 'Editor', exact: true }).click();
    await expect(dialog(page).getByText('Power User', { exact: true })).toHaveCount(0);
    await expect(dialog(page).getByRole('switch', { name: 'Power User Mode' })).toHaveCount(0);
    await expect(dialog(page).getByRole('switch', { name: 'Alignment Guides' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await expect(dialog(page).getByRole('switch', { name: 'Auto-Attach Arrows' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expectNoPageErrors(pageErrors);
  });
});
