import type { Locator, Page } from '@playwright/test';
import { auditContrast } from './contrast';
import { dismissQuickTour, expect, expectNoPageErrors, startBlankDiagram, test } from './fixtures';

// Tooltips and hover cards (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md), in a real
// browser: the 1 s tooltip delay, instant keyboard focus, the instant hover
// card, Escape, and hoverability. Dark mode, so the inverse pill is checked
// against the dark palette.
test.use({ colorScheme: 'dark' });

const TOOLTIP = '[role="tooltip"][data-hint="tooltip"]';
const HOVER_CARD = '[role="tooltip"][data-hint="hover-card"]';
// Well under the 1 s delay, and well over a frame: "instant" means this.
const INSTANT_MS = 300;

const squareTile = (page: Page) => page.getByRole('button', { name: 'Add square', exact: true });

// A blank diagram with the quick tour out of the way: its dialog would cover
// the palette mid-hover.
async function openEditor(page: Page) {
  await startBlankDiagram(page);
  await dismissQuickTour(page);
}

// Park the pointer on empty canvas, away from every trigger.
async function parkPointer(page: Page) {
  await page.mouse.move(700, 500);
}

// Focus a control by keyboard, so :focus-visible holds as it does for a user.
async function keyboardFocus(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(target).toBeFocused();
}

test.describe('Tooltip on a palette tile', () => {
  test('names the tile only after a 1 s hover', async ({ page, pageErrors }) => {
    await openEditor(page);
    await parkPointer(page);
    await squareTile(page).hover();

    await page.waitForTimeout(600);
    await expect(page.locator(TOOLTIP)).toHaveCount(0);

    const tooltip = page.locator(TOOLTIP);
    await expect(tooltip).toBeVisible({ timeout: 1_500 });
    await expect(tooltip).toHaveText('Add square');
    expectNoPageErrors(pageErrors);
  });

  test('opens at once on keyboard focus, and Escape dismisses it', async ({ page, pageErrors }) => {
    await openEditor(page);
    await parkPointer(page);
    const tile = squareTile(page);
    await keyboardFocus(page, tile);

    const tooltip = page.locator(TOOLTIP);
    await expect(tooltip).toBeVisible({ timeout: INSTANT_MS });
    await expect(tooltip).toHaveText('Add square');

    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    await expect(tile).toBeFocused();
    expectNoPageErrors(pageErrors);
  });

  test('stays open while the pointer moves onto it', async ({ page, pageErrors }) => {
    await openEditor(page);
    await parkPointer(page);
    await squareTile(page).hover();
    const tooltip = page.locator(TOOLTIP);
    await expect(tooltip).toBeVisible({ timeout: 1_500 });

    const box = (await tooltip.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(400);
    await expect(tooltip).toBeVisible();

    await parkPointer(page);
    await expect(tooltip).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});

test.describe('Hover card', () => {
  test('opens at once on hover, with its title and description', async ({ page, pageErrors }) => {
    await openEditor(page);
    await parkPointer(page);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).hover();

    const card = page.locator(HOVER_CARD);
    await expect(card).toBeVisible({ timeout: INSTANT_MS });
    await expect(card).toContainText('Zoom in');
    await expect(card).toContainText('Zoom in by 10%.');
    expectNoPageErrors(pageErrors);
  });
});

// A hint's colours as sRGB bytes, and the palette tokens they should resolve to, read in the page.
// Painting through a 1x1 canvas reads every colour space Tailwind v4 computes (lab, oklch).
async function hintColours(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
    const rgb = (value: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = value;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)).join(',');
    };
    const token = (name: string) =>
      rgb(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
    const style = getComputedStyle(el);
    return {
      surface: rgb(style.backgroundColor),
      border: rgb(style.borderTopColor),
      borderWidth: style.borderTopWidth,
      slate900: token('--color-slate-900'),
      slate800: token('--color-slate-800'),
      slate700: token('--color-slate-700'),
    };
  });
}

// Dark mode paints hints in the dark chrome's own colours (Steel), never a lighter card
// (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md, Dark mode).
test.describe('Hints in dark mode', () => {
  test('a tooltip is the dark chrome surface with a dark border, and reads at 4.5:1', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      true,
    );
    await parkPointer(page);
    await squareTile(page).hover();
    await expect(page.locator(TOOLTIP)).toBeVisible({ timeout: 1_500 });

    const dark = await hintColours(page, TOOLTIP);
    expect(dark.surface).toBe(dark.slate900);
    expect(dark.border).toBe(dark.slate700);
    expect(dark.borderWidth).toBe('1px');
    const report = await auditContrast(page, TOOLTIP);
    expect(report.measured).toBeGreaterThan(0);
    expect(report.lowest).toBeGreaterThanOrEqual(4.5);

    // The same pill without .dark is the light inverse pill: the variant is what switched.
    await page.evaluate(() => document.documentElement.classList.remove('dark'));
    const light = await hintColours(page, TOOLTIP);
    expect(light.surface).toBe(light.slate900);
    expect(light.surface).not.toBe(dark.surface);
    expect(light.borderWidth).toBe('0px');
    expect((await auditContrast(page, TOOLTIP)).lowest).toBeGreaterThanOrEqual(4.5);
    expectNoPageErrors(pageErrors);
  });

  test('a hover card is the dark card surface with a dark border, and reads at 4.5:1', async ({
    page,
    pageErrors,
  }) => {
    await openEditor(page);
    await parkPointer(page);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).hover();
    await expect(page.locator(HOVER_CARD)).toBeVisible({ timeout: INSTANT_MS });

    const dark = await hintColours(page, HOVER_CARD);
    expect(dark.surface).toBe(dark.slate800);
    expect(dark.border).toBe(dark.slate700);
    const report = await auditContrast(page, HOVER_CARD);
    expect(report.measured).toBe(2); // title and description
    expect(report.lowest).toBeGreaterThanOrEqual(4.5);
    expectNoPageErrors(pageErrors);
  });
});
