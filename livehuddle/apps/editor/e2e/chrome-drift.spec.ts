import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  paletteTile,
  startBlankDocument,
  test,
} from './fixtures';

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

  // A chair at the bottom edge, then type its label (written under it): the editor sits below the edge.
  await (await paletteTile(page, 'Add Chair')).click();
  await page.mouse.click(viewport.width / 2, viewport.height - 40);
  await page.getByRole('img', { name: 'Chair', exact: true }).dblclick();
  await page.keyboard.type('Hello there');
  await page.keyboard.press('Escape');

  expect(await page.locator('main').evaluate((m) => m.scrollTop)).toBe(0);
  expect((await cluster.boundingBox())?.y).toBe(before?.y);
  expectNoPageErrors(pageErrors);
});
