import type { Page } from '@playwright/test';
import { expect, test, expectNoPageErrors, openStartBlank } from './fixtures';

// Palette drag-to-canvas (docs/specs/010-palette/palette-drag-ghost.md) from the Palette strip
// (docs/specs/007-editor/toolbar-layout.md): a tile in a category's More popover drags onto the canvas
// like the tile it stands for, whatever its catalogue: a shape from Shapes' full body, a line icon and
// a sticker found by searching their own catalogue's body.

const CANVAS = '[data-canvas-a11y-root]';

// The strip on a category, then its More popover open, searched when the body has a search field.
async function openMore(page: Page, category: string, query?: string): Promise<void> {
  await page.getByRole('button', { name: 'Palette category' }).click();
  await page.locator(`[data-option-id="${category}"]`).click();
  await page.getByRole('button', { name: /^More/ }).click();
  if (query)
    await more(page)
      .getByRole('textbox', { name: /search/i })
      .fill(query);
}

const more = (page: Page) => page.locator('[data-toolbar-more]');

// The elements on the canvas, by accessible name (the canvas a11y root names each one).
const placed = (page: Page, name: RegExp) => page.locator(CANVAS).getByRole('img', { name });

async function dragTileOntoCanvas(page: Page, tileName: string, at: { x: number; y: number }) {
  const tile = more(page).getByRole('button', { name: tileName, exact: true }).first();
  await expect(tile).toHaveAttribute('draggable', 'true');
  await tile.dragTo(page.locator(CANVAS), { targetPosition: at });
}

test.describe('Toolbar strip drag', () => {
  for (const { category, query, tile, placedAs } of [
    { category: 'shapes', query: undefined, tile: 'Add Speech Bubble', placedAs: /speech bubble/i },
    { category: 'icons', query: 'speech', tile: 'Add Message', placedAs: /^Icon$/ },
    { category: 'stickers', query: 'speech', tile: 'Speech balloon', placedAs: /^Sticker$/ },
  ]) {
    test(`a "${tile}" tile from the ${category} More popover drags onto the canvas`, async ({
      page,
      pageErrors,
    }) => {
      await openStartBlank(page);
      await openMore(page, category, query);
      await expect(placed(page, placedAs)).toHaveCount(0);
      await dragTileOntoCanvas(page, tile, { x: 300, y: 500 });
      await expect(placed(page, placedAs)).toHaveCount(1);
      expectNoPageErrors(pageErrors);
    });
  }
});
