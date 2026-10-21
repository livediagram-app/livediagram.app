import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// The shape slots (docs/specs/023-draw-mode/draw-mode.md "Shape slots"), a Within reach set
// (docs/specs/004-interface-design/within-reach.md) worked out by the shared `withinReach`. The dock
// bar shows the pins and the Shapes button; the six slots live in the Shapes flyout, the recent row
// over the most used. With the default pins, Most used starts Ellipse, Diamond, Cylinder and Recent
// starts Line; a picked kind leads Most used and leaves Recent, which fills from the next kind.
// Dark mode.

test.use({ colorScheme: 'dark' });

const bar = (page: Page) =>
  page.locator('[data-whiteboard-dock]').getByRole('toolbar', { name: 'Shapes' });
const names = (buttons: Element[]) =>
  buttons.map((b) => b.getAttribute('aria-label') ?? b.textContent);
const barShapes = (page: Page) => bar(page).getByRole('button').evaluateAll(names);
const flyout = (page: Page) => page.locator('#whiteboard-flyout-shapes');
// The flyout's slots, in reading order: the recent row, then the most used.
const slots = (page: Page) =>
  flyout(page).getByRole('listbox', { name: 'Shapes' }).getByRole('option').evaluateAll(names);

async function openShapes(page: Page) {
  await bar(page).getByRole('button', { name: 'Shapes', exact: true }).click();
  await expect(flyout(page)).toBeVisible();
}

test('the shape slots fill Most used, then Recent, none twice', async ({ page, pageErrors }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/new?template=whiteboard');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await bar(page).waitFor();

  // The bar: the pins, then the Shapes button.
  await expect.poll(() => barShapes(page)).toEqual(['Arrow', 'Rectangle', 'Shapes']);
  // The flyout: Recent (fallback after the most used), then Most used.
  await openShapes(page);
  await expect
    .poll(() => slots(page))
    .toEqual(['Line', 'Parallelogram', 'Hexagon', 'Ellipse', 'Diamond', 'Cylinder']);

  // Pick Line: now used, it leads Most used and leaves Recent; no kind shows twice.
  await flyout(page).getByRole('option', { name: 'Line', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(flyout(page)).toHaveCount(0);
  await openShapes(page);
  await expect
    .poll(async () => (await slots(page)).slice(3))
    .toEqual(['Line', 'Ellipse', 'Diamond']);
  const all = [...(await barShapes(page)), ...(await slots(page))];
  expect(all.slice(0, 2)).not.toContain('Line');
  expect((await slots(page)).slice(0, 3)).not.toContain('Line');
  expect(new Set(all).size).toBe(all.length);
  expectNoPageErrors(pageErrors);
});
