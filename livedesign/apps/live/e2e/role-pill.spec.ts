import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// Previewing a role (docs/specs/007-editor/live-app.md#role-pill): the role pill is the Editing Mode button in the tab bar, between Tools and
// Settings (Work Tracker 1291). And the chrome everyone gets now Power user mode is retired (docs/specs/007-editor/power-user-mode.md), in a real browser, dark mode.
test.use({ colorScheme: 'dark' });

const PREFS_KEY = 'livedesign:user-preferences:v1';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const tabBar = (page: Page) => page.locator('[data-editor-tabbar]');
const tools = (page: Page) => tabBar(page).getByRole('button', { name: /^Tools/ });
const modeButton = (page: Page) => tabBar(page).locator('[data-editing-mode]');

// The Editing Mode button, between Tools and Settings (Work Tracker 1291): it shows only the mode in force, and a press
// moves to the next mode, wrapping round.
async function step(page: Page, mode: 'edit' | 'participate' | 'view', word: string) {
  await modeButton(page).click();
  await expect(modeButton(page)).toHaveAttribute('data-editing-mode', mode);
  await expect(modeButton(page)).toHaveText(word);
}

// Where the button sits among the bar's buttons: after Tools, before Settings.
async function clusterOrder(page: Page) {
  return tabBar(page).evaluate((bar) => {
    const buttons = [...bar.querySelectorAll('button')];
    const at = (selector: string) =>
      buttons.indexOf(bar.querySelector(selector) as HTMLButtonElement);
    return {
      tools: at('[data-tools-button]'),
      mode: at('[data-editing-mode]'),
      settings: at('button[aria-label="Application settings"]'),
    };
  });
}

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Straight to a blank canvas: the /new?blank=1 bypass (Start Blank).
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);
}

test.describe('Editing Mode', () => {
  test('steps the owner through Participant and Viewer from the button, and back to Editor', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    // No header bar, so no pill in one.
    await expect(page.locator('header[data-region="header"]')).toHaveCount(0);
    // A button of its own showing only the mode in force, after Tools and before Settings.
    await expect(modeButton(page)).toHaveText('Editor');
    await expect(modeButton(page)).toHaveAccessibleName(
      'Editing Mode: Editor. Switch to Participant.',
    );
    const order = await clusterOrder(page);
    expect(order.tools).toBeGreaterThanOrEqual(0);
    expect(order.mode).toBe(order.tools + 1);
    expect(order.settings).toBeGreaterThan(order.mode);
    // No longer a row in Tools.
    await tools(page).click();
    await expect(page.locator('[data-tools-item]').first()).toBeVisible();
    await expect(page.locator('[data-tools-item="role"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-tools-item]')).toHaveCount(0);
    await expect(page.locator('[data-category-bar-button][aria-label="Shapes"]')).toBeVisible();
    await step(page, 'participate', 'Participant');
    await expect(modeButton(page)).toHaveAccessibleName(
      'Editing Mode: Participant. Switch to Viewer.',
    );
    await step(page, 'view', 'Viewer');
    // Read-only for a Viewer: the building categories are gone.
    await expect(page.locator('[data-category-bar-button][aria-label="Shapes"]')).toHaveCount(0);
    await expect(modeButton(page)).toHaveAccessibleName('Editing Mode: Viewer. Switch to Editor.');
    // Round to the real role.
    await step(page, 'edit', 'Editor');
    await expect(page.locator('[data-category-bar-button][aria-label="Shapes"]')).toBeVisible();
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
