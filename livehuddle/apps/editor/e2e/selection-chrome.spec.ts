// docs/specs/008-canvas/canvas-performance.md "A selection change re-renders what it touches": the
// selection chrome reads the selection store, and follows it through select, reselect, select-all,
// delete and undo. livehuddle draws no quick-connect pluses
// (docs/specs/002-project-scope/not-in-livehuddle.md#quick-connect), so the resize grips stand for the chrome.
import { expect, expectNoPageErrors, seedTab, startBlankDocument, test } from './fixtures';

const square = (id: string, label: string, x: number, y: number) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y,
  width: 120,
  height: 90,
  label,
});
const board = [square('a', 'Alpha', 200, 200), square('b', 'Beta', 500, 200)];
const SHOTS = process.env.E2E_SHOTS_DIR;
const shot = async (page: import('@playwright/test').Page, n: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/selection-${n}.png` });
};

test('the selection chrome follows the selection', async ({ page, pageErrors }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'dark' });
  await startBlankDocument(page);
  await seedTab(page, board);
  const plus = page.getByRole('button', { name: 'Quick add and connect' });
  const grip = page.getByRole('button', { name: /^Resize/ });
  const box = (id: string) => page.locator(`[data-element-id="${id}"]`).first();
  const centre = async (id: string) => {
    const b = (await box(id).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  // Nothing selected: no grips, no union box.
  await expect(grip).toHaveCount(0);
  await shot(page, '0-none');

  // A single box: its resize grips, and never a plus.
  const a = await centre('a');
  await page.mouse.click(a.x, a.y);
  await expect(grip.first()).toBeVisible();
  await expect(plus).toHaveCount(0);
  await shot(page, '1-single');

  // Another box: the grips follow it.
  const b = await centre('b');
  await page.mouse.click(b.x, b.y);
  await expect(grip.first()).toBeVisible();
  const gripBox = (await grip.first().boundingBox())!;
  expect(Math.abs(gripBox.x - b.x)).toBeLessThan(200);
  await shot(page, '2-reselect');

  // Escape: everything goes.
  await page.keyboard.press('Escape');
  await expect(grip).toHaveCount(0);

  // Select all: the union box and the multi toolbar; no pluses.
  await page.keyboard.press('ControlOrMeta+a');
  await expect(page.locator('.border-dashed').first()).toBeVisible();
  await expect(plus).toHaveCount(0);
  await shot(page, '3-select-all');
  await page.keyboard.press('Escape');

  // Delete the selected box, then undo: chrome comes back with it.
  await page.mouse.click(a.x, a.y);
  await page.keyboard.press('Delete');
  await expect(box('a')).toHaveCount(0);
  await expect(grip).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(box('a')).toHaveCount(1);

  // A tab switch leaves nothing selected, here or back on the first tab.
  await page.mouse.click(b.x, b.y);
  await expect(grip.first()).toBeVisible();
  await page.locator('[data-tour-id="add-tab"]').click();
  await expect(grip).toHaveCount(0);
  await page.locator('[data-tab-key]', { hasText: /^Tab 1$/ }).click();
  await expect(box('b')).toBeVisible();
  await expect(grip).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});
