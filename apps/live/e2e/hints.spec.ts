import type { Locator, Page } from '@playwright/test';
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
  test('names the tile only after a 1 s hover, in the dark pill', async ({ page, pageErrors }) => {
    await openEditor(page);
    await parkPointer(page);
    await squareTile(page).hover();

    await page.waitForTimeout(600);
    await expect(page.locator(TOOLTIP)).toHaveCount(0);

    const tooltip = page.locator(TOOLTIP);
    await expect(tooltip).toBeVisible({ timeout: 1_500 });
    await expect(tooltip).toHaveText('Add square');

    // Dark-aware: the pill is the dark palette's slate 700, not the light one's slate 900.
    expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(
      true,
    );
    const [pill, expected] = await tooltip.evaluate((el) => {
      const probe = document.createElement('div');
      probe.className = 'dark:bg-slate-700';
      document.body.append(probe);
      const colours = [
        getComputedStyle(el).backgroundColor,
        getComputedStyle(probe).backgroundColor,
      ];
      probe.remove();
      return colours;
    });
    expect(pill).toBe(expected);
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
