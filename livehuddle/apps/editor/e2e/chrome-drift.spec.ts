import { dismissQuickTour, expect, expectNoPageErrors, startBlankDocument, test } from './fixtures';

// The canvas never scrolls (docs/specs/008-canvas/canvas-and-palette.md "The canvas never scrolls"):
// editing a label past its bottom edge used to scroll the canvas's box to reveal the editor, and the
// corner chrome positioned in it (the bottom-right cluster, the Map) rode up the screen and stayed.
test('editing a label at the bottom edge leaves the corner chrome where it is', async ({
  page,
  pageErrors,
}) => {
  await startBlankDocument(page);
  await dismissQuickTour(page);
  const viewport = page.viewportSize()!;
  const cluster = page.locator('[data-zoom-cluster]');
  const before = await cluster.boundingBox();

  // A square straddling the bottom edge, then type its label: the editor sits below the edge.
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.keyboard.press('r');
  await page.mouse.move(viewport.width / 2 - 60, viewport.height - 100);
  await page.mouse.down();
  await page.mouse.move(viewport.width / 2 + 80, viewport.height - 10, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.type('Hello there');
  await page.keyboard.press('Escape');

  expect(await page.locator('main').evaluate((m) => m.scrollTop)).toBe(0);
  expect((await cluster.boundingBox())?.y).toBe(before?.y);
  expectNoPageErrors(pageErrors);
});
