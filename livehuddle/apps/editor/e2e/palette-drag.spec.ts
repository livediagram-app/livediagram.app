import type { Page } from '@playwright/test';
import { expect, test, expectNoPageErrors, openStartBlank } from './fixtures';

// Palette drag-to-canvas (docs/specs/010-palette/palette-drag-ghost.md) from the Palette strip
// (docs/specs/007-editor/toolbar-layout.md "The category bar"): a tile in a category's flyout drags onto the canvas
// like the tile it stands for, here a sticky note from Write's flyout. Stickers have no flyout of their own: they are
// found through Search.

const CANVAS = '[data-canvas-a11y-root]';

const more = (page: Page) => page.locator('[data-category-flyout]');

// The elements on the canvas, by accessible name (the canvas a11y root names each one).
const placed = (page: Page, name: RegExp) => page.locator(CANVAS).getByRole('img', { name });

test.describe('Toolbar strip drag', () => {
  test('a "Add Sticky Note" tile from the Write flyout drags onto the canvas', async ({
    page,
    pageErrors,
  }) => {
    await openStartBlank(page);
    await page.locator('[data-category-bar-button][aria-label="Write"]').click();
    await more(page).waitFor();
    await expect(placed(page, /^Sticky note$/)).toHaveCount(0);
    const tile = more(page).getByRole('button', { name: 'Add Sticky Note', exact: true }).first();
    await expect(tile).toHaveAttribute('draggable', 'true');
    await tile.dragTo(page.locator(CANVAS), { targetPosition: { x: 300, y: 500 } });
    await expect(placed(page, /^Sticky note$/)).toHaveCount(1);
    expectNoPageErrors(pageErrors);
  });
});
