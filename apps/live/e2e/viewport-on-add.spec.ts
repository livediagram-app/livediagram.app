import type { Page } from '@playwright/test';
import { expect, test, dismissQuickTour, expectNoPageErrors } from './fixtures';

// The viewport on tab entry (docs/specs/008-canvas/canvas-and-palette.md "Fit-to-screen"): a tab is framed
// once, when its content has loaded; what the user then adds, the first element on an empty tab
// included, never moves the view.

const CANVAS = '[data-canvas-a11y-root]';

// The Toolbar layout keeps the canvas clear of floating panels, which refuse a drop.
async function justDraw(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const key = 'livediagram:user-preferences:v1';
    const prefs = JSON.parse(localStorage.getItem(key) ?? '{}');
    localStorage.setItem(key, JSON.stringify({ ...prefs, panelLayout: 'toolbar' }));
  });
  await page.goto('/new');
  // Retried: on a cold dev server the first click can land before hydration.
  await expect(async () => {
    await page.getByRole('button', { name: /^just draw$/i }).click({ timeout: 2_000 });
    await page.locator(CANVAS).waitFor({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
  await dismissQuickTour(page);
}

const centre = (b: { x: number; y: number; width: number; height: number }) => ({
  x: b.x + b.width / 2,
  y: b.y + b.height / 2,
});

test.describe('Viewport on add', () => {
  test('the first element dropped on an empty tab stays where it was dropped', async ({
    page,
    pageErrors,
  }) => {
    await justDraw(page);
    const canvas = page.locator(CANVAS);
    const box = (await canvas.boundingBox())!;
    const drop = { x: 200, y: 260 };
    await page
      .getByRole('button', { name: 'Add square', exact: true })
      .first()
      .dragTo(canvas, { targetPosition: drop });
    const square = canvas.getByRole('img', { name: 'Square', exact: true });
    await expect(square).toHaveCount(1);
    // Past the frame the entry fit used to land on.
    await page.waitForTimeout(300);
    const at = centre((await square.boundingBox())!);
    expect(Math.abs(at.x - (box.x + drop.x))).toBeLessThan(4);
    expect(Math.abs(at.y - (box.y + drop.y))).toBeLessThan(4);
    expectNoPageErrors(pageErrors);
  });

  test('a reloaded tab is framed on its content', async ({ page, pageErrors }) => {
    await justDraw(page);
    const canvas = page.locator(CANVAS);
    // Dropped at the far corner, so only a fit would bring it back to the middle.
    const box = (await canvas.boundingBox())!;
    await page
      .getByRole('button', { name: 'Add square', exact: true })
      .first()
      .dragTo(canvas, { targetPosition: { x: 80, y: box.height - 80 } });
    await page.keyboard.press('Escape');
    // Let the autosave land before reloading.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const headers = { 'X-Owner-Id': localStorage.getItem('livediagram:v2:self-id') ?? '' };
          const id = location.pathname.split('/').filter(Boolean).pop();
          const tabId = new URLSearchParams(location.hash.slice(1)).get('t');
          const res = await fetch(`/api/diagrams/${id}/tabs/${tabId}`, { headers });
          return res.ok ? ((await res.json()).tab?.elements?.length ?? 0) : 0;
        }),
      )
      .toBe(1);
    await page.reload();
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
