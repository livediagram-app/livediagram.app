import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// The role pill (docs/specs/007-editor/editor-app.md#role-pill), and the chrome everyone gets now Power user mode is
// retired (docs/specs/007-editor/power-user-mode.md), in a real browser, dark mode.
test.use({ colorScheme: 'dark' });

const TOOLTIP = '[role="tooltip"][data-hint="tooltip"]';
const PREFS_KEY = 'livehuddle:user-preferences:v1';

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

test.describe('Role pill', () => {
  test('sits in the title bar for the owner and toggles a read-only preview', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    const pill = header(page).getByRole('button', { name: 'Editing. Owned by you' });
    await expect(pill).toBeVisible();
    await expect(page.locator('[data-category-bar-button][aria-label="Write"]')).toBeVisible();

    await pill.hover();
    await expect(page.locator(TOOLTIP)).toHaveText('Owned by you', { timeout: 2_000 });

    // Each click steps the preview between Editing and Participating, with no Viewing step (editor-app.md "Role pill").
    await pill.click();
    const participating = header(page).getByRole('button', {
      name: 'Participating. Owned by you',
    });
    await expect(participating).toBeVisible();
    // A Participant walks (share-roles.md "Always walking"): the building categories and the Edit | Walk toggle are gone.
    await expect(page.locator('[data-category-bar-button][aria-label="Write"]')).toHaveCount(0);
    await expect(page.getByRole('group', { name: 'Edit or Walk' })).toHaveCount(0);

    await participating.click();
    await expect(pill).toBeVisible();
    expectNoPageErrors(pageErrors);
  });
});

test.describe('Retired power user keys', () => {
  test('a stored blob with them loads the default chrome and keeps every other setting', async ({
    page,
    pageErrors,
  }) => {
    // What a person who had Power user mode on carries: the mode, its baseline, Minimal chrome, the offer's latch,
    // and the preset's values (alignment guides on, the Avatar Tour and element tours seen).
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
          avatarTourSeen: true,
          elementToursSeen: true,
        }),
      );
    }, PREFS_KEY);
    await openEditor(page);

    // The default chrome: the role pill in the title bar, labelled status bar controls, a cycling Appearance control.
    await expect(header(page).locator('[data-role-pill]')).toBeVisible();
    await expect(tabBar(page).getByText('Search', { exact: true })).toBeVisible();
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
    // Tours seen stay seen: the Avatar Tour is not offered again.
    await dialog(page).getByRole('button', { name: 'Tours', exact: true }).click();
    await expect(dialog(page).getByRole('switch', { name: 'Avatar Tour' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expectNoPageErrors(pageErrors);
  });
});
