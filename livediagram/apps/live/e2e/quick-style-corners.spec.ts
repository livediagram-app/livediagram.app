import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, seedTab, test } from './fixtures';

// docs/specs/008-canvas/corner-radius.md and quick-style-panel.md "Corners": a small rounded square
// stays a rounded square (corners never past a quarter of its side), and a whiteboard's quick
// style panel offers Corners. Dark mode; synthesised board.
const SHOTS = process.env.E2E_SHOTS_DIR;

const square = (id: string, x: number, size: number, borderRadius?: string) => ({
  id,
  type: 'shape',
  shape: 'square',
  x,
  y: 140,
  width: size,
  height: size,
  ...(borderRadius ? { borderRadius } : {}),
});

const BOARD = [
  square('tiny-1', 600, 14, 'lg'),
  square('tiny-2', 630, 14, 'md'),
  square('tiny-3', 660, 14),
  square('small', 700, 40, 'lg'),
  square('big', 780, 160, 'lg'),
  square('pill', 1000, 14, 'full'),
];

async function openBoard(page: Page) {
  await page.emulateMedia({ colorScheme: 'dark' });
  // Wide enough that the fitted board sits clear of the quick style panel.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/new?template=whiteboard');
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, BOARD);
}

const radiusOf = (page: Page, id: string) =>
  page
    .locator(`[data-element-id="${id}"]`)
    .first()
    .evaluate((el) => {
      // The element's own box carries its corner (element-variant.ts).
      const box = [el, ...el.querySelectorAll<HTMLElement>('*')].find(
        (n) =>
          /px$/.test(getComputedStyle(n).borderTopLeftRadius) &&
          getComputedStyle(n).borderTopLeftRadius !== '0px',
      );
      return box ? getComputedStyle(box).borderTopLeftRadius : '0px';
    });

test('small rounded squares stay rounded squares; Corners restyles them', async ({
  page,
  pageErrors,
}) => {
  await openBoard(page);
  expect(await radiusOf(page, 'tiny-1')).toBe('3.5px');
  expect(await radiusOf(page, 'tiny-2')).toBe('3.5px');
  expect(await radiusOf(page, 'tiny-3')).toBe('3.5px');
  expect(await radiusOf(page, 'small')).toBe('10px');
  expect(await radiusOf(page, 'big')).toBe('24px');
  expect(await radiusOf(page, 'pill')).toBe('9999px');

  await page.keyboard.press('v');
  await page
    .locator('[data-element-id="big"]')
    .first()
    .click({ position: { x: 4, y: 80 } });
  const panel = page.getByRole('region', { name: 'Quick style' });
  const corners = panel.getByRole('radiogroup', { name: 'Corners' });
  await expect(corners).toBeVisible();
  await expect(corners.getByRole('radio', { name: 'Large' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  if (SHOTS) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/corners-before.png` });
  }
  await corners.getByRole('radio', { name: 'Small' }).click();
  await expect(corners.getByRole('radio', { name: 'Small' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(await radiusOf(page, 'big')).toBe('4px');
  if (SHOTS) {
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/corners-after.png` });
  }
  expectNoPageErrors(pageErrors);
});
