import {
  expect,
  test,
  expectNoPageErrors,
  openStartBlank,
  paletteTile,
  seedTab,
  startBlankDocument,
} from './fixtures';

// The viewport on tab entry (docs/specs/008-canvas/canvas-and-palette.md "Fit-to-screen"): a tab is framed
// once, when its content has loaded; what the user then adds, the first element on an empty tab
// included, never moves the view.

const CANVAS = '[data-canvas-a11y-root]';

const centre = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

test.describe('Viewport on add', () => {
  test('the first element dropped on an empty tab stays where it was dropped', async ({
    page,
    pageErrors,
  }) => {
    await openStartBlank(page);
    const canvas = page.locator(CANVAS);
    const box = (await canvas.boundingBox())!;
    const drop = { x: 200, y: 260 };
    await (await paletteTile(page, 'Add Sticky Note')).dragTo(canvas, { targetPosition: drop });
    const square = canvas.getByRole('img', { name: 'Sticky note', exact: true });
    await expect(square).toHaveCount(1);
    // Past the frame the entry fit used to land on.
    await page.waitForTimeout(300);
    const at = centre((await square.boundingBox())!);
    expect(Math.abs(at.x - (box.x + drop.x))).toBeLessThan(4);
    expect(Math.abs(at.y - (box.y + drop.y))).toBeLessThan(4);
    expectNoPageErrors(pageErrors);
  });

  test('a reloaded tab is framed on its content', async ({ page, pageErrors }) => {
    await startBlankDocument(page);
    // A shape far from the origin and no way to walk (no pad, no Avatar button), so the tab opens on its entry fit
    // rather than walking (docs/specs/008-canvas/avatar-mode.md "Opening walking"); seedTab reloads.
    await seedTab(page, [{ id: 'far', type: 'sticky', x: 3000, y: 2000, width: 100, height: 100 }]);
    const square = page.locator('[data-element-id="far"]').first();
    await expect(async () => {
      const after = (await page.locator(CANVAS).boundingBox())!;
      const at = centre((await square.boundingBox())!);
      expect(Math.abs(at.x - (after.x + after.width / 2))).toBeLessThan(40);
    }).toPass({ timeout: 5_000 });
    expectNoPageErrors(pageErrors);
  });
});
