import type { Page } from '@playwright/test';
import { expect, test, expectNoPageErrors, openBlankSession, openStartBlank } from './fixtures';

// Palette drag-to-canvas (docs/specs/010-palette/palette-drag-ghost.md) from the Palette strip
// (docs/specs/007-editor/toolbar-layout.md "The category bar"): a tile in a category's flyout drags onto the canvas
// like the tile it stands for, whatever its catalogue: a shape from Shapes' flyout, a line icon and
// a sticker found by searching their own catalogue's body.

const CANVAS = '[data-canvas-a11y-root]';

// A category's flyout on the category bar, searched when the body has a search field.
async function openMore(page: Page, category: string, query?: string): Promise<void> {
  await page.locator(`[data-category-bar-button][aria-label="${category}"]`).click();
  await more(page).waitFor();
  if (query)
    await more(page)
      .getByRole('textbox', { name: /search/i })
      .fill(query);
}

const more = (page: Page) => page.locator('[data-category-flyout]');

// The elements on the canvas, by accessible name (the canvas a11y root names each one).
const placed = (page: Page, name: RegExp) => page.locator(CANVAS).getByRole('img', { name });

async function dragTileOntoCanvas(page: Page, tileName: string, at: { x: number; y: number }) {
  const tile = more(page).getByRole('button', { name: tileName, exact: true }).first();
  await expect(tile).toHaveAttribute('draggable', 'true');
  await tile.dragTo(page.locator(CANVAS), { targetPosition: at });
}

test.describe('Toolbar strip drag', () => {
  for (const { category, query, tile, placedAs, open } of [
    {
      category: 'Shapes',
      query: undefined,
      tile: 'Add Speech Bubble',
      placedAs: /speech bubble/i,
      open: openStartBlank,
    },
    {
      category: 'Icons',
      query: 'speech',
      tile: 'Add Message',
      placedAs: /^Icon$/,
      open: openStartBlank,
    },
    {
      category: 'Stickers',
      query: 'speech',
      tile: 'Speech balloon',
      placedAs: /^Sticker$/,
      open: openBlankSession,
    },
  ]) {
    test(`a "${tile}" tile from the ${category} flyout drags onto the canvas`, async ({
      page,
      pageErrors,
    }) => {
      await open(page);
      await openMore(page, category, query);
      await expect(placed(page, placedAs)).toHaveCount(0);
      await dragTileOntoCanvas(page, tile, { x: 300, y: 500 });
      await expect(placed(page, placedAs)).toHaveCount(1);
      expectNoPageErrors(pageErrors);
    });
  }
});
