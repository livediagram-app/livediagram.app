import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, serverNewUrl, test } from './fixtures';

// The role pill (docs/specs/007-editor/editor-app.md#role-pill), and the chrome everyone gets now Power user mode is
// retired (docs/specs/007-editor/power-user-mode.md), in a real browser, dark mode.
test.use({ colorScheme: 'dark' });

const TOOLTIP = '[role="tooltip"][data-hint="tooltip"]';
const PREFS_KEY = 'liveplanner:user-preferences:v1';

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });
const tabBar = (page: Page) => page.locator('[data-editor-tabbar]');
const header = (page: Page) => page.locator('header');

async function openEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  // Straight to a blank canvas: the /new?blank=1 bypass (Start Blank), on liveplanner.
  await page.goto(await serverNewUrl(page, '/new?blank=1'));
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

test.describe('Retired power user keys', () => {
  test('a stored blob with them loads the default chrome and keeps every other setting', async ({
    page,
    pageErrors,
  }) => {
    // What a person who had Power user mode on carries: the mode, its baseline, Minimal chrome, the offer's latch,
    // and the preset's values (the Plan and Forms tours seen).
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
            formTourSeen: { before: {}, applied: { formTourSeen: true } },
          },
          planTourSeen: true,
          formTourSeen: true,
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

    // Settings: no Editor category (it held only the mode's rows); the preset's tours stay seen.
    await page.getByRole('button', { name: 'Application settings' }).click();
    await expect(dialog(page).getByRole('button', { name: 'Editor', exact: true })).toHaveCount(0);
    await dialog(page).getByRole('button', { name: 'Tours', exact: true }).click();
    await expect(dialog(page).getByText('Power User', { exact: true })).toHaveCount(0);
    await expect(dialog(page).getByRole('switch', { name: 'Power User Mode' })).toHaveCount(0);
    await expect(dialog(page).getByRole('switch', { name: /^Plan Tours/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    await expect(dialog(page).getByRole('switch', { name: /^Forms Tour/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expectNoPageErrors(pageErrors);
  });
});
