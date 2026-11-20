import type { Locator, Page } from '@playwright/test';
import { presetSetup } from '@liveplanner/items';
import { auditContrast } from '@liveworkspace/e2e-kit/contrast';
import { expect, expectNoPageErrors, seedTab, startBlankProject, test } from './fixtures';

// Tooltips and hover cards (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md), in a real
// browser: the 1 s tooltip delay, instant keyboard focus, the instant hover
// card, Escape, and hoverability. Dark mode, so the inverse pill is checked
// against the dark palette.
test.use({ colorScheme: 'dark' });

const TOOLTIP = '[role="tooltip"][data-hint="tooltip"]';
const HOVER_CARD = '[role="tooltip"][data-hint="hover-card"]';
// Well under the 1 s delay, and well over a frame: "instant" means this.
const INSTANT_MS = 300;

// A control with a tooltip: a board's Edit Widgets, whose tooltip names what its glyph only draws. (These tests used
// the title bar's role pill, gone with the header bar, and before that the diagram palette's tiles, which Plan does not
// have; the element menu's Clear Styles shows only where a Quick Style panel publishes it, which Plan has none of.)
const TOOLTIP_TEXT = 'Edit Widgets';
const editWidgets = (page: Page) =>
  page
    .locator('[data-plan-board]')
    .first()
    .getByRole('button', { name: 'Edit Widgets', exact: true });

// A plan with a square on its tab, so the canvas and its zoom controls show (Start Planning covers an empty tab).
async function openEditor(page: Page) {
  await startBlankProject(page);
  await seedTab(page, [
    { id: 'sq', type: 'shape', shape: 'square', x: 400, y: 300, width: 120, height: 120 },
  ]);
  await expect(page.getByRole('button', { name: 'Theme and canvas', exact: true })).toBeVisible();
}

// The editor with a kanban board on its tab, whose header holds Edit Widgets.
async function openTile(page: Page) {
  await startBlankProject(page);
  await seedTab(page, [
    {
      id: 'board',
      type: 'shape',
      shape: 'plan-board',
      x: 100,
      y: 100,
      width: 900,
      height: 460,
      planBoard: presetSetup('kanban'),
    },
  ]);
  await expect(editWidgets(page)).toBeVisible();
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

test.describe('Tooltip on a control', () => {
  test('names it only after a 500 ms hover', async ({ page, pageErrors }) => {
    await openTile(page);
    await parkPointer(page);
    await editWidgets(page).hover();

    await page.waitForTimeout(500);
    await expect(page.locator(TOOLTIP)).toHaveCount(0);

    const tooltip = page.locator(TOOLTIP);
    await expect(tooltip).toBeVisible({ timeout: 1_500 });
    await expect(tooltip).toHaveText(TOOLTIP_TEXT);
    expectNoPageErrors(pageErrors);
  });

  test('opens at once on keyboard focus, and Escape dismisses it', async ({ page, pageErrors }) => {
    await openTile(page);
    await parkPointer(page);
    const tile = editWidgets(page);
    await keyboardFocus(page, tile);

    const tooltip = page.locator(TOOLTIP);
    await expect(tooltip).toBeVisible({ timeout: INSTANT_MS });
    await expect(tooltip).toHaveText(TOOLTIP_TEXT);

    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('never takes a press: it lets the pointer through, and leaving the tile closes it', async ({
    page,
    pageErrors,
  }) => {
    await openTile(page);
    await parkPointer(page);
    await editWidgets(page).hover();
    const tooltip = page.locator(TOOLTIP);
    await expect(tooltip).toBeVisible({ timeout: 1_500 });

    await expect(tooltip).toHaveCSS('pointer-events', 'none');
    const box = (await tooltip.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    // A press where it sits reaches what is beneath it, never the tooltip.
    const hit = await page.evaluate(
      ([px, py]) => document.elementFromPoint(px, py)?.closest('[data-hint="tooltip"]') ?? null,
      [x, y] as const,
    );
    expect(hit).toBeNull();
    await parkPointer(page);
    await expect(tooltip).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});

test.describe('Hover card', () => {
  test('opens at once on hover, with its title and description', async ({ page, pageErrors }) => {
    await openEditor(page);
    await parkPointer(page);
    await page.getByRole('button', { name: 'Theme and canvas', exact: true }).hover();

    const card = page.locator(HOVER_CARD);
    await expect(card).toBeVisible({ timeout: INSTANT_MS });
    await expect(card).toContainText('Theme & Canvas');
    await expect(card).toContainText("Change this tab's theme and canvas background.");
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
    await openTile(page);
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      true,
    );
    await parkPointer(page);
    await editWidgets(page).hover();
    await expect(page.locator(TOOLTIP)).toBeVisible({ timeout: 1_500 });

    const dark = await hintColours(page, TOOLTIP);
    expect(dark.surface).toBe(dark.slate900);
    expect(dark.border).toBe(dark.slate700);
    expect(dark.borderWidth).toBe('1px');
    const report = await auditContrast(page, TOOLTIP);
    expect(report.measured).toBeGreaterThan(0);
    expect(report.lowest).toBeGreaterThanOrEqual(4.5);

    // The same tooltip without .dark is the light inverse pill: the variant is what switched.
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
    await page.getByRole('button', { name: 'Theme and canvas', exact: true }).hover();
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
