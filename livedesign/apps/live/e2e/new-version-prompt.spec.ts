import type { Page } from '@playwright/test';
import { DESIGN_FORMAT, DESIGN_FORMAT_HEADER } from '@livedesign/api-schema';
import { expect, expectNoPageErrors, onPage, openBlankPage, paletteTile, test } from './fixtures';

// The new version prompt (docs/specs/016-platform/new-version-prompt.md), in dark mode: this build is
// the "older editor", and the server is made "newer" by raising the design format number every
// api response carries. The prompt offers a reload, reloads only once the edits are saved, never
// over unsaved changes, and steps aside on "Not now".

const CANVAS = '[data-canvas-a11y-root]';
const prompt = (page: Page) =>
  page.getByRole('status').filter({ hasText: /new version|Saving|saved yet/ });
const squares = (page: Page) =>
  page.locator(CANVAS).getByRole('img', { name: 'Square', exact: true });

// Every api response says the server's format is one ahead of this editor; optionally, saves fail.
async function serveNewerFormat(page: Page, { failSaves = false } = {}) {
  await page.route('**/api/**', async (route) => {
    if (failSaves && route.request().method() === 'PUT') {
      await route.fulfill({
        status: 503,
        headers: { [DESIGN_FORMAT_HEADER]: String(DESIGN_FORMAT + 1) },
        body: '{"error":"unavailable"}',
      });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), [DESIGN_FORMAT_HEADER]: String(DESIGN_FORMAT + 1) },
    });
  });
}

async function openBlank(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  // Its page chosen a Logo, so the squares below have a page to land on (fixtures openBlankPage).
  await openBlankPage(page);
}

// One edit: a Square from the Shapes flyout, dropped with a click on the page (a press off every page places
// nothing). Each edit lands a little further right, clear of the last one. Counted per page, so a worker's earlier
// tests never move this test's drops.
const drops = new WeakMap<Page, number>();
async function addSquare(page: Page) {
  const n = drops.get(page) ?? 0;
  drops.set(page, n + 1);
  await (await paletteTile(page, 'Add Square')).click();
  await page.locator(CANVAS).click({ position: await onPage(page, 0.2 + (n % 4) * 0.2, 0.3) });
}

test.describe('new version prompt', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('stays hidden while the server serves this editor’s own format', async ({
    page,
    pageErrors,
  }) => {
    await openBlank(page);
    await addSquare(page);
    await page.waitForTimeout(1_500);
    await expect(prompt(page)).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('offers a reload, saves the edit first, then reloads with it kept', async ({
    page,
    pageErrors,
  }) => {
    await openBlank(page);
    await serveNewerFormat(page);
    await addSquare(page);
    await expect(prompt(page)).toContainText('A new version of livedesign is ready.');
    await page.screenshot({ path: test.info().outputPath('offered.png') });
    // It never takes focus; the keyboard reaches it.
    const reload = prompt(page).getByRole('button', { name: 'Reload' });
    await expect(reload).not.toBeFocused();
    await addSquare(page);
    const reloaded = page.waitForEvent('load');
    await reload.focus();
    await page.keyboard.press('Enter');
    await reloaded;
    await page.locator(CANVAS).waitFor();
    await expect(squares(page)).toHaveCount(2);
    expectNoPageErrors(pageErrors);
  });

  test('never reloads over unsaved changes, and says why', async ({ page }) => {
    test.setTimeout(45_000);
    await openBlank(page);
    await serveNewerFormat(page, { failSaves: true });
    await addSquare(page);
    await expect(prompt(page)).toBeVisible();
    let reloads = 0;
    page.on('load', () => reloads++);
    await prompt(page).getByRole('button', { name: 'Reload' }).click();
    await expect(prompt(page)).toContainText('Saving your changes…');
    await expect(prompt(page)).toContainText(
      "Your latest changes aren't saved yet. Reload once they are.",
      { timeout: 15_000 },
    );
    await page.screenshot({ path: test.info().outputPath('unsaved.png') });
    expect(reloads).toBe(0);
    await expect(squares(page)).toHaveCount(1);
  });

  test('steps aside on Not now', async ({ page, pageErrors }) => {
    await openBlank(page);
    await serveNewerFormat(page);
    await addSquare(page);
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole('button', { name: 'Not now' }).click();
    await expect(prompt(page)).toHaveCount(0);
    await addSquare(page);
    await page.waitForTimeout(1_500);
    await expect(prompt(page)).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});
