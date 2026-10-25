import { expect, test, expectNoPageErrors, startBlankProject, seedTab } from './fixtures';

// The viewport on tab entry (docs/specs/008-canvas/canvas-and-palette.md "Fit-to-screen"): a tab is framed
// once, when its content has loaded. (The first element dropped on an empty tab came from the diagram palette,
// which Plan does not have; that half is gone with it.)

const CANVAS = '[data-canvas-a11y-root]';

const centre = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

test.describe('Viewport on add', () => {
  test('a reloaded tab is framed on its content', async ({ page, pageErrors }) => {
    await startBlankProject(page);
    // Far from the origin, so only a fit brings it to the middle. seedTab saves it and reloads.
    await seedTab(page, [
      { id: 'sq', type: 'shape', shape: 'square', x: 2400, y: 1800, width: 120, height: 120 },
    ]);
    const square = page.locator(CANVAS).getByRole('img', { name: 'Square', exact: true });
    await expect(square).toHaveCount(1);
    await expect(async () => {
      const after = (await page.locator(CANVAS).boundingBox())!;
      const at = centre((await square.boundingBox())!);
      expect(Math.abs(at.x - (after.x + after.width / 2))).toBeLessThan(40);
    }).toPass({ timeout: 5_000 });
    expectNoPageErrors(pageErrors);
  });
});
