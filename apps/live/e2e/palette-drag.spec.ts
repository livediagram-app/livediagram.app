import type { Page } from '@playwright/test';
import { expect, test, dismissQuickTour, expectNoPageErrors } from './fixtures';

// Palette drag-to-canvas (docs/specs/010-palette/palette-drag-ghost.md) from the Toolbar layout's strip
// (docs/specs/007-editor/toolbar-layout.md): a row found by searching the More popover drags onto the
// canvas like the tile it stands for, whatever its catalogue (shape, line icon, sticker).

const CANVAS = '[data-canvas-a11y-root]';

async function openToolbarBoard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'livediagram:user-preferences:v1';
    const prefs = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...prefs, panelLayout: 'toolbar' }));
  });
  await page.goto('/new');
  // Retried: on a cold dev server the first click can land before hydration.
  await expect(async () => {
    await page.getByRole('button', { name: /^just draw$/i }).click({ timeout: 2_000 });
    await page.locator(CANVAS).waitFor({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await dismissQuickTour(page);
}

async function searchMore(page: Page, query: string): Promise<void> {
  await page.getByRole('button', { name: /^More/ }).click();
  await page
    .getByRole('searchbox')
    .or(page.getByRole('textbox', { name: /search/i }))
    .first()
    .fill(query);
}

// The elements on the canvas, by accessible name (the canvas a11y root names each one).
const placed = (page: Page, name: RegExp) => page.locator(CANVAS).getByRole('img', { name });

async function dragRowOntoCanvas(page: Page, rowName: string, at: { x: number; y: number }) {
  const row = page.getByRole('option', { name: rowName, exact: true }).first();
  await expect(row).toHaveAttribute('draggable', 'true');
  await row.dragTo(page.locator(CANVAS), { targetPosition: at });
}

test.describe('Toolbar strip drag', () => {
  for (const { row, placedAs } of [
    { row: 'Add speech bubble', placedAs: /speech bubble/i },
    { row: 'Add Message', placedAs: /^Icon$/ },
    { row: 'Add Speech balloon', placedAs: /^Icon$/ },
  ]) {
    test(`a searched "${row}" row drags onto the canvas`, async ({ page, pageErrors }) => {
      await openToolbarBoard(page);
      await searchMore(page, 'speech');
      await expect(placed(page, placedAs)).toHaveCount(0);
      await dragRowOntoCanvas(page, row, { x: 300, y: 500 });
      await expect(placed(page, placedAs)).toHaveCount(1);
      expectNoPageErrors(pageErrors);
    });
  }
});
