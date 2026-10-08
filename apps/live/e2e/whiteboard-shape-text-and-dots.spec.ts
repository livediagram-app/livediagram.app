import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, test } from './fixtures';

// docs/specs/023-draw-mode/draw-mode.md: a whiteboard shape is picked by its outline, yet a
// double-click anywhere inside it writes in it, selected or not ("Selecting"); a tap with a marker
// leaves a dot ("Pens"); and a cylinder's label grows down its body, under the lid
// (docs/specs/008-canvas/canvas-and-palette.md "Shape primitives"). Dark mode.

test.use({ colorScheme: 'dark' });

async function openBoard(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem(
      'livediagram:user-preferences:v1',
      JSON.stringify({ panelLayout: 'toolbar' }),
    ),
  );
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('/new?template=whiteboard');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
}

const elements = (page: Page) => page.locator('[data-element-id]');
const editor = (page: Page) => page.locator('[contenteditable="true"]');

// Draws a shape by its key, then puts the tool down and steps off it.
async function drawShape(page: Page, key: string, x: number, y: number, w: number, h: number) {
  await page.keyboard.press(key);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + w / 2, y + h / 2, { steps: 4 });
  await page.mouse.move(x + w, y + h, { steps: 4 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.mouse.click(1300, 780);
  return elements(page).last();
}

// Commits the label being edited by stepping off it.
async function commit(page: Page) {
  await page.mouse.click(1300, 780);
  await expect(editor(page)).toHaveCount(0);
}

test('a double-click inside a shape writes in it, selected or not', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  const rect = await drawShape(page, 'r', 200, 250, 200, 140);
  const box = (await rect.boundingBox())!;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  // Not selected: the inside is not the shape's to catch, yet the double-click edits it.
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(rect.locator('[contenteditable="true"]')).toBeVisible();
  await expect(elements(page)).toHaveCount(1);
  await page.keyboard.type('Inside');
  await commit(page);
  await expect(rect).toContainText('Inside');

  // Selected by its outline first: the double-click inside still edits it.
  await page.mouse.click(box.x + 1, centre.y);
  await page.mouse.dblclick(centre.x, centre.y);
  await expect(rect.locator('[contenteditable="true"]')).toBeVisible();
  await expect(elements(page)).toHaveCount(1);
  await commit(page);

  // Beside every shape the double-click still makes a text box.
  await page.mouse.dblclick(700, 650);
  await expect(elements(page)).toHaveCount(2);
  expectNoPageErrors(pageErrors);
});

test('a tap with a marker leaves a dot', async ({ page, pageErrors }) => {
  await openBoard(page);
  await page.keyboard.press('2');
  await page.mouse.click(600, 400);
  await expect(elements(page)).toHaveCount(1);
  const dot = (await elements(page).first().locator('svg path').first().boundingBox())!;
  // A round dot about the pen's width, centred where the pen touched.
  expect(Math.abs(dot.width - dot.height)).toBeLessThan(0.5);
  expect(Math.abs(dot.x + dot.width / 2 - 600)).toBeLessThan(1);
  expect(Math.abs(dot.y + dot.height / 2 - 400)).toBeLessThan(1);
  // The marker stays in hand: the next tap is another dot.
  await page.mouse.click(630, 400);
  await expect(elements(page)).toHaveCount(2);
  expectNoPageErrors(pageErrors);
});

test('a cylinder’s label of many lines grows down its body, under the lid', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  const cylinder = await drawShape(page, 'c', 500, 200, 160, 220);
  const box = (await cylinder.boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.type('Orders');
  for (const line of ['and', 'payments', 'archive']) {
    await page.keyboard.press('Enter');
    await page.keyboard.type(line);
  }
  await commit(page);
  const first = (await cylinder.getByText('Orders').boundingBox())!;
  // The lid's lower edge is 27% down the box.
  expect(first.y).toBeGreaterThanOrEqual(box.y + box.height * 0.27 - 1);
  expectNoPageErrors(pageErrors);
});
