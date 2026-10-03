import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// The shape slots (docs/specs/023-draw-mode/draw-mode.md "Shape slots"), a Within reach set
// (docs/specs/004-interface-design/within-reach.md) worked out by the shared `withinReach`. On a
// wide screen the dock lays the slots out inline after the pins: the recent row, then the most
// used. With the default pins, Most used starts Ellipse, Diamond, Cylinder and Recent starts
// Line; a picked kind leads Most used and leaves Recent, which fills from the next kind. Dark mode.

test.use({ colorScheme: 'dark' });

const shapes = (page: Page) =>
  page
    .locator('[data-whiteboard-dock]')
    .getByRole('toolbar', { name: 'Shapes' })
    .getByRole('button')
    .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent));

test('the shape slots fill Most used, then Recent, none twice', async ({ page, pageErrors }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/new?template=whiteboard');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  const bar = page.locator('[data-whiteboard-dock]').getByRole('toolbar', { name: 'Shapes' });
  await bar.waitFor();

  // Pins, then Recent (fallback after the most used), then Most used.
  await expect
    .poll(() => shapes(page))
    .toEqual([
      'Arrow',
      'Rectangle',
      'Line',
      'Parallelogram',
      'Hexagon',
      'Ellipse',
      'Diamond',
      'Cylinder',
    ]);

  // Pick Line: now used, it leads Most used and leaves Recent; no kind shows twice.
  await bar.getByRole('button', { name: 'Line', exact: true }).click();
  await expect
    .poll(async () => (await shapes(page)).slice(5))
    .toEqual(['Line', 'Ellipse', 'Diamond']);
  const all = await shapes(page);
  expect(all.slice(2, 5)).not.toContain('Line');
  expect(new Set(all).size).toBe(all.length);
  expectNoPageErrors(pageErrors);
});
