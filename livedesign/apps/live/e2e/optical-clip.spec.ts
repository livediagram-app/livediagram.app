import type { Locator, Page } from '@playwright/test';
import { expect, test, dismissQuickTour, expectNoPageErrors } from './fixtures';

// A trimmed label that also clips (`text-optical-line` + `truncate`) must keep its ink
// (docs/specs/004-interface-design/blueprints/optical-alignment.md, "Truncated label"): the trim puts
// the content edge on the baseline, so the clip edge has to sit in the padding given back below it.
// The proof is pixels: the label paints the same with its overflow released.

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });

async function clippedLabels(scope: Locator): Promise<Locator[]> {
  const all = await scope.locator('.text-optical-line').all();
  const clipped: Locator[] = [];
  for (const label of all) {
    const overflow = await label.evaluate((el) => getComputedStyle(el).overflowY);
    if (overflow !== 'visible') clipped.push(label);
  }
  return clipped;
}

// Ink may spill this far past the label's sides (an italic overhang) and still be the label's; the
// row's next item (a category's icon tile) sits a 12px gap away, outside the frame.
const SIDE_SPILL_PX = 4;

async function paintsFullInk(label: Locator): Promise<boolean> {
  // The row's full height, so a descender spilling below the label's box is in frame, across the
  // label's own columns only: re-painting the label after its overflow flips may re-blend a
  // neighbour's anti-aliased edge, which says nothing about the label's ink.
  const row = (await label.locator('xpath=..').boundingBox())!;
  const box = (await label.boundingBox())!;
  const clip = {
    x: box.x - SIDE_SPILL_PX,
    y: row.y,
    width: box.width + 2 * SIDE_SPILL_PX,
    height: row.height,
  };
  const shot = () => label.page().screenshot({ clip, animations: 'disabled', caret: 'hide' });
  const clipped = await shot();
  await label.evaluate((el) => {
    el.style.overflow = 'visible';
    el.style.textOverflow = 'clip';
  });
  const released = await shot();
  await label.evaluate((el) => {
    el.style.overflow = '';
    el.style.textOverflow = '';
  });
  return clipped.equals(released);
}

test('Settings category labels keep their descenders', async ({ page, pageErrors }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 720 });
  // Straight to a blank canvas: the /new?blank=1 bypass (Start Blank).
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);

  await page.getByRole('button', { name: 'Application settings' }).click();
  const rail = dialog(page).getByRole('navigation', { name: 'Settings categories' });
  await rail.waitFor();

  const labels = await clippedLabels(rail);
  // Appearance, Keyboard, Accessibility, Privacy: the ones with descenders.
  expect(labels.length).toBeGreaterThanOrEqual(4);
  const cut: string[] = [];
  for (const label of labels) {
    if (!(await paintsFullInk(label))) cut.push((await label.textContent()) ?? '');
  }
  expect(cut).toEqual([]);

  expectNoPageErrors(pageErrors);
});
