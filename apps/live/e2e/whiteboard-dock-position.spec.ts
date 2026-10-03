import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  settledBox,
  test,
  chooseToolbarLayout,
} from './fixtures';

// Where the whiteboard dock sits (docs/specs/023-draw-mode/draw-mode.md "Where the dock sits"):
// the top by default, the bottom by choice in Settings, Editor › Draw; flyouts open on the board
// side, take the focus on a press and give it back on Escape; top corner panels give way to a top
// dock.

const dock = (page: Page) => page.locator('[data-whiteboard-dock]');

async function openWhiteboard(page: Page, viewport = { width: 1600, height: 900 }) {
  // The dock is the Toolbar layout's (docs/specs/023-draw-mode/draw-mode.md).
  await chooseToolbarLayout(page);
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

    const opener = dock(page).getByRole('button', { name: 'Settings' });
    await opener.click();
    const flyout = page.locator('#whiteboard-flyout-settings');
    await expect(flyout).toHaveAttribute('data-side', 'below');
    expect((await settledBox(flyout)).y).toBeGreaterThan(top.y + top.height);
    // A press hands the focus to the flyout (its choice in force), and Escape hands it back.
    await expect(flyout.locator('[aria-pressed="true"]').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(flyout).toHaveCount(0);
    await expect(opener).toBeFocused();

    await page.getByRole('button', { name: 'Settings' }).last().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Editor', exact: true }).click();
    await dialog
      .getByRole('group', { name: 'Editor' })
      .getByRole('button', { name: 'Draw', exact: true })
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

  // The Toolbar layout keeps its Explorer behind the menu button, so the corner panel here is the
  // Map, docked top-left (docs/specs/007-editor/panel-docking.md): it shows from four elements.
  test('moves a top-left panel below a top dock that would reach it', async ({
    page,
    pageErrors,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'livediagram:panel-layout:v1',
        JSON.stringify({
          corners: {
            'top-left': ['minimap'],
            'top-right': [],
            'bottom-left': [],
            'bottom-right': [],
          },
          free: {},
        }),
      ),
    );
    await openWhiteboard(page, { width: 1024, height: 768 });
    await seedTab(
      page,
      [0, 1, 2, 3].map((i) => ({
        id: `stroke-${i}`,
        type: 'freehand',
        x: 300,
        y: 320 + i * 60,
        width: 400,
        height: 40,
        points: [
          { nx: 0, ny: 0.5 },
          { nx: 1, ny: 0.5 },
        ],
        closed: false,
        penWidth: 2.5,
        streamline: 0,
        penColour: 'blue',
      })),
    );
    const map = page
      .getByRole('button', { name: 'Collapse map' })
      .locator('xpath=ancestor::*[@data-floating-panel][1]');
    const box = (await dock(page).boundingBox())!;
    const panel = await settledBox(map);
    // The dock reaches into the corner's columns, so the panel has to give way.
    expect(panel.x + panel.width).toBeGreaterThan(box.x);
    expect(panel.y).toBeGreaterThanOrEqual(box.y + box.height);
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
