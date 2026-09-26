import type { Locator, Page } from '@playwright/test';
import { expect, test, dismissQuickTour, expectNoPageErrors } from './fixtures';

// Settings reopens where it was left (docs/specs/007-editor/user-preferences.md): the same category, and the
// same row at the same spot, even after a resize reflowed every row. Unit
// tests fake the geometry; only a real layout can show the anchor holds.

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Application settings' }).click();
  await dialog(page).waitFor();
}

// The top-most visible row, and its top relative to the pane's top edge.
function topRow(scroller: Locator): Promise<{ key: string; offset: number }> {
  return scroller.evaluate((pane) => {
    const top = pane.getBoundingClientRect().top;
    for (const row of pane.querySelectorAll<HTMLElement>('[data-settings-row]')) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom > top) {
        return { key: row.dataset.settingsRow ?? '', offset: Math.round(rect.top - top) };
      }
    }
    return { key: '', offset: 0 };
  });
}

// Wheel it to the bottom and wait for the pane to settle, as a reader would:
// the dialog learns where it is from the scroll events that follow.
async function scrollToEnd(page: Page, scroller: Locator): Promise<void> {
  await scroller.hover();
  await page.mouse.wheel(0, 5000);
  await expect
    .poll(() => scroller.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop))
    .toBeLessThanOrEqual(1);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

test('Settings reopens on the last category and row, across a resize', async ({
  page,
  pageErrors,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/new');
  await page.getByRole('button', { name: /^just draw$/i }).click();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);

  await openSettings(page);
  await dialog(page).getByRole('button', { name: 'Appearance' }).click();
  const scroller = dialog(page)
    .locator('[data-settings-row]')
    .first()
    .locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]');
  // Leave it scrolled down, as a reader would, and note where the row sits.
  await scrollToEnd(page, scroller);
  const leftAt = await topRow(scroller);
  // Below the first row, so rows above it reflow and a pixel offset would drift.
  expect(leftAt.key).not.toBe('');
  expect(leftAt.key).not.toBe('appearance');
  const leftScrollTop = await scroller.evaluate((el) => el.scrollTop);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  // Narrower and shorter: every row reflows, so a pixel offset would miss.
  await page.setViewportSize({ width: 680, height: 600 });
  await openSettings(page);
  await expect(dialog(page).getByRole('switch', { name: 'Show Minimap' })).toBeVisible();
  await expect(async () => {
    const back = await topRow(scroller);
    expect(back.key).toBe(leftAt.key);
    // Sub-pixel rounding either side.
    expect(Math.abs(back.offset - leftAt.offset)).toBeLessThanOrEqual(1);
  }).toPass();
  // ...by a different pixel offset: the reflow moved the row, the anchor followed.
  expect(await scroller.evaluate((el) => el.scrollTop)).not.toBe(leftScrollTop);

  expectNoPageErrors(pageErrors);
});

// The dialog scales in from 0.96 as it opens, and the pane re-applies the
// anchor on the first frames of that (a ResizeObserver fires on observe).
// Rects are shrunk by the scale but scrollTop is not, so an unscaled measure
// lands short by 4% of how far the row's top sits above the pane: several
// pixels deep inside a tall row, as Appearance's first row is.
test('Settings reopens deep inside a tall row without drifting', async ({ page, pageErrors }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/new');
  await page.getByRole('button', { name: /^just draw$/i }).click();
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);

  await openSettings(page);
  await dialog(page).getByRole('button', { name: 'Appearance' }).click();
  const scroller = dialog(page)
    .locator('[data-settings-row]')
    .first()
    .locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]');
  await scroller.hover();
  await page.mouse.wheel(0, 200);
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(150);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const leftAt = await topRow(scroller);
  expect(leftAt.key).toBe('appearance');
  expect(leftAt.offset).toBeLessThan(-150);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  await openSettings(page);
  await dialog(page).evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)),
  );
  const back = await topRow(scroller);
  expect(back.key).toBe(leftAt.key);
  expect(Math.abs(back.offset - leftAt.offset)).toBeLessThanOrEqual(1);

  expectNoPageErrors(pageErrors);
});
