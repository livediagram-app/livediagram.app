import type { Page } from '@playwright/test';
import { dismissQuickTour, expect, expectNoPageErrors, seedTab, test } from './fixtures';

// docs/specs/008-canvas/canvas-performance.md "A still canvas does nothing": with a board open and a
// selection showing its toolbar (and, on a whiteboard, the Quick Style panel), a still second asks
// for no animation frames. Counted, not timed, so it is deterministic. Dark mode; synthesised board.

const square = (i: number) => ({
  id: `sq-${i}`,
  type: 'shape',
  shape: 'square',
  x: 200 + (i % 8) * 160,
  y: 160 + Math.floor(i / 8) * 140,
  width: 100,
  height: 80,
  fillColor: '#ffffff',
});
const arrow = (i: number) => ({
  id: `ar-${i}`,
  type: 'arrow',
  from: { kind: 'pinned', elementId: `sq-${i}`, anchor: 'e' },
  to: { kind: 'pinned', elementId: `sq-${i + 1}`, anchor: 'w' },
});
const BOARD = [
  ...Array.from({ length: 32 }, (_, i) => square(i)),
  ...Array.from({ length: 24 }, (_, i) => arrow(i)),
];

async function openStill(page: Page, path: string) {
  // Counts every animation-frame request the page makes, from before the app loads.
  await page.addInitScript(() => {
    const w = window as unknown as { __frameRequests: number };
    w.__frameRequests = 0;
    const request = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => {
      w.__frameRequests += 1;
      return request(cb);
    };
  });
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.goto(path);
  await page.locator('[data-canvas-a11y-root]').waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, BOARD);
  await page.keyboard.press('v');
  await page.locator('[data-element-id="sq-9"]').first().click();
  await expect(page.locator('[data-testid="selection-popover"]')).toBeVisible();
  // Let the selection settle: toolbars placed, transitions done.
  await page.waitForTimeout(1500);
}

const framesOverAStillSecond = async (page: Page) => {
  // The counter is live: loading the board and settling the selection asked for frames.
  expect(
    await page.evaluate(() => (window as unknown as { __frameRequests: number }).__frameRequests),
  ).toBeGreaterThan(0);
  const before = await page.evaluate(
    () => (window as unknown as { __frameRequests: number }).__frameRequests,
  );
  await page.waitForTimeout(1000);
  const after = await page.evaluate(
    () => (window as unknown as { __frameRequests: number }).__frameRequests,
  );
  return after - before;
};

test.describe('a still canvas', () => {
  test('asks for no frames on a still whiteboard with a selection', async ({
    page,
    pageErrors,
  }) => {
    await openStill(page, '/new?template=whiteboard');
    expect(await framesOverAStillSecond(page)).toBe(0);
    expectNoPageErrors(pageErrors);
  });

  test('asks for no frames on a still diagram with a selection', async ({ page, pageErrors }) => {
    await openStill(page, '/new?blank=1');
    expect(await framesOverAStillSecond(page)).toBe(0);
    expectNoPageErrors(pageErrors);
  });
});
