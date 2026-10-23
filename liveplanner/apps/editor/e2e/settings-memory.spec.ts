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

// Wheel the pane until the row's top sits `depth` px above the pane's top edge, deep inside the
// row, however many rows the category holds above or below it.
async function scrollDeepInto(
  page: Page,
  scroller: Locator,
  key: string,
  depth: number,
): Promise<void> {
  const row = scroller.locator(`[data-settings-row="${key}"]`);
  const offset = () =>
    row.evaluate((el) => {
      const pane = el.closest('[class*="overflow-y-auto"]')!;
      return Math.round(el.getBoundingClientRect().top - pane.getBoundingClientRect().top);
    });
  await scroller.hover();
  await page.mouse.wheel(0, (await offset()) + depth);
  await expect.poll(offset).toBe(-depth);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
}

test('Settings reopens on the last category and row, across a resize', async ({
  page,
  pageErrors,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  // Short, so the pane's scroll range runs past the category's first row (a tall one) whatever the
  // font: at 720px CI's Linux metrics left the end of the range inside it.
  await page.setViewportSize({ width: 1280, height: 520 });
  // Straight to a blank canvas: the /new?blank=1 bypass (Start Blank).
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);

  await openSettings(page);
  await dialog(page).getByRole('button', { name: 'Appearance', exact: true }).click();
  const scroller = dialog(page)
    .locator('[data-settings-row]')
    .first()
    .locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]');
  // Leave it scrolled down, as a reader would, and note where the row sits.
  await scrollToEnd(page, scroller);
  const leftAt = await topRow(scroller);
  // Below the first row, so rows above it reflow and a pixel offset would drift.
  expect(leftAt.key).not.toBe('');
  const firstRow = await scroller.evaluate(
    (pane) => pane.querySelector<HTMLElement>('[data-settings-row]')?.dataset.settingsRow ?? '',
  );
  expect(leftAt.key).not.toBe(firstRow);
  const leftScrollTop = await scroller.evaluate((el) => el.scrollTop);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  // Down to a phone: the pane loses a quarter of its width, so every row
  // above the anchor reflows and a pixel offset would miss. (A desktop resize
  // can't promise that: the dialog is capped at 672px and the phone layout
  // starts below 640px, and a 50px change in pane width only rewraps a
  // footnote when the font's metrics happen to fall that way. It did on
  // macOS and not on CI's Linux.) Short too, so the pane still has the scroll
  // range to put the row back where it was rather than clamping at the end.
  await page.setViewportSize({ width: 390, height: 560 });
  await openSettings(page);
  await expect(dialog(page).locator('[data-settings-row]').first()).toBeVisible();
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
// pixels deep inside a tall row: Appearance's tallest, three quarters into it, deep yet still the top
// row. A window short enough that the pane holds more below the row than that.
test('Settings reopens deep inside a tall row without drifting', async ({ page, pageErrors }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1280, height: 640 });
  // Straight to a blank canvas: the /new?blank=1 bypass (Start Blank).
  await page.goto('/new?blank=1');
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await dismissQuickTour(page);

  await openSettings(page);
  await dialog(page).getByRole('button', { name: 'Appearance', exact: true }).click();
  const scroller = dialog(page)
    .locator('[data-settings-row]')
    .first()
    .locator('xpath=ancestor::div[contains(@class, "overflow-y-auto")][1]');
  // The category's tallest row, three quarters of the way in.
  const tallest = await scroller.evaluate((pane) => {
    let best = { key: '', height: 0 };
    for (const row of pane.querySelectorAll<HTMLElement>('[data-settings-row]')) {
      const height = row.getBoundingClientRect().height;
      if (height > best.height) best = { key: row.dataset.settingsRow ?? '', height };
    }
    return best;
  });
  const depth = Math.floor(tallest.height * 0.75);
  expect(depth).toBeGreaterThan(40);
  await scrollDeepInto(page, scroller, tallest.key, depth);
  const leftAt = await topRow(scroller);
  expect(leftAt.key).toBe(tallest.key);
  expect(leftAt.offset).toBeLessThan(-(depth - 40));
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
