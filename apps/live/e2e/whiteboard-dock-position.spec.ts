import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, settledBox, test } from './fixtures';

// Where the whiteboard dock sits (docs/specs/023-whiteboard/whiteboard.md "Where the dock sits"):
// the top by default, the bottom by choice in Settings, Editor, Whiteboard; flyouts open on the
// board side, and top corner panels give way to a top dock.

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');

async function openWhiteboard(page: Page, viewport = { width: 1600, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/new?template=whiteboard');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await dock(page).waitFor();
}

test.describe('whiteboard dock position', () => {
  test('sits at the top, opens its flyouts below, and moves to the bottom from Settings', async ({
    page,
    pageErrors,
  }) => {
    await openWhiteboard(page);
    await expect(dock(page)).toHaveAttribute('data-dock-position', 'top');
    const top = (await dock(page).boundingBox())!;
    expect(top.y).toBeLessThan(120);

    await dock(page).getByRole('button', { name: 'Settings' }).click();
    const flyout = page.locator('#whiteboard-flyout-settings');
    await expect(flyout).toHaveAttribute('data-side', 'below');
    expect((await settledBox(flyout)).y).toBeGreaterThan(top.y + top.height);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Settings' }).last().click();
    const dialog = page.getByRole('dialog');
    await dialog
      .getByRole('button', { name: /^Editor/ })
      .first()
      .click();
    await dialog.getByText('Dock Position', { exact: true }).scrollIntoViewIfNeeded();
    await dialog.getByRole('radio', { name: 'Bottom' }).click();
    await expect(dock(page)).toHaveAttribute('data-dock-position', 'bottom');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    const bottom = (await dock(page).boundingBox())!;
    expect(bottom.y).toBeGreaterThan(600);
    await dock(page).getByRole('button', { name: 'Settings' }).click();
    await expect(flyout).toHaveAttribute('data-side', 'above');
    const above = await settledBox(flyout);
    expect(above.y + above.height).toBeLessThan(bottom.y);

    // Synced like every preference: a reload keeps the choice.
    await page.reload();
    await dock(page).waitFor();
    await expect(dock(page)).toHaveAttribute('data-dock-position', 'bottom');
    expectNoPageErrors(pageErrors);
  });

  test('moves the Explorer below a top dock that would reach it', async ({ page, pageErrors }) => {
    await openWhiteboard(page, { width: 1024, height: 768 });
    const box = (await dock(page).boundingBox())!;
    const explorer = (await page
      .getByRole('tablist', { name: 'Explorer sections' })
      .locator('xpath=ancestor::*[@data-floating-panel][1]')
      .boundingBox())!;
    expect(explorer.y).toBeGreaterThanOrEqual(box.y + box.height);
    expectNoPageErrors(pageErrors);
  });

  test('keeps the whole dock in view on a portrait tablet, clear of the menu button', async ({
    page,
    pageErrors,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'livediagram:user-preferences:v1',
        JSON.stringify({ panelLayout: 'toolbar' }),
      ),
    );
    await openWhiteboard(page, { width: 820, height: 1180 });
    const scroller = dock(page).locator('[data-dock-scroller]');
    const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBe(0);
    const menu = (await page.getByRole('button', { name: 'Explorer' }).boundingBox())!;
    expect((await dock(page).boundingBox())!.x).toBeGreaterThan(menu.x + menu.width);
    expectNoPageErrors(pageErrors);
  });
});
