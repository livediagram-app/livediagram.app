import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  serverNewUrl,
  test,
} from './fixtures';

// docs/specs/008-canvas/corner-radius.md: a small rounded square stays a rounded square (corners never
// past a quarter of its side). Dark mode; synthesised board.

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
  // Wide enough for the whole board.
  await page.setViewportSize({ width: 1600, height: 900 });
  // On livedocuments, not This Browser: seedTab writes the board through the api.
  await page.goto(await serverNewUrl(page, '/new?blank=1'));
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

test('small rounded squares stay rounded squares', async ({ page, pageErrors }) => {
  await openBoard(page);
  expect(await radiusOf(page, 'tiny-1')).toBe('3.5px');
  expect(await radiusOf(page, 'tiny-2')).toBe('3.5px');
  expect(await radiusOf(page, 'tiny-3')).toBe('3.5px');
  expect(await radiusOf(page, 'small')).toBe('10px');
  expect(await radiusOf(page, 'big')).toBe('24px');
  expect(await radiusOf(page, 'pill')).toBe('9999px');

  expectNoPageErrors(pageErrors);
});
