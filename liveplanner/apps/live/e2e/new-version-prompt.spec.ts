import type { Page } from '@playwright/test';
import { PROJECT_FORMAT, PROJECT_FORMAT_HEADER } from '@liveplanner/api-schema';
import { expect, expectNoPageErrors, startBlankProject, test } from './fixtures';

// The new version prompt (docs/specs/016-platform/new-version-prompt.md), in dark mode: this build is
// the "older editor", and the server is made "newer" by raising the project format number every
// api response carries. The prompt offers a reload, reloads only once the edits are saved, never
// over unsaved changes, and steps aside on "Not now".

const CANVAS = '[data-canvas-a11y-root]';
const prompt = (page: Page) =>
  page.getByRole('status').filter({ hasText: /new version|Saving|saved yet/ });
const notes = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /^Sticky note/ });

// Every api response says the server's format is one ahead of this editor; optionally, saves fail.
async function serveNewerFormat(page: Page, { failSaves = false } = {}) {
  await page.route('**/api/**', async (route) => {
    if (failSaves && route.request().method() === 'PUT') {
      await route.fulfill({
        status: 503,
        headers: { [PROJECT_FORMAT_HEADER]: String(PROJECT_FORMAT + 1) },
        body: '{"error":"unavailable"}',
      });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), [PROJECT_FORMAT_HEADER]: String(PROJECT_FORMAT + 1) },
    });
  });
}

async function openBoard(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await startBlankProject(page);
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
}

// N arms a sticky note; a tap drops it, each one a little further along. Escape first, so N never
// types into the note just placed.
let placed = 0;
async function addNote(page: Page) {
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  placed += 1;
  await page.mouse.click(400 + placed * 160, 450);
}

test.describe('new version prompt', () => {
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('stays hidden while the server serves this editor’s own format', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await addNote(page);
    await page.waitForTimeout(1_500);
    await expect(prompt(page)).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });

  test('offers a reload, saves the edit first, then reloads with it kept', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    await serveNewerFormat(page);
    await addNote(page);
    await expect(prompt(page)).toContainText('A new version of liveplanner is ready.');
    await page.screenshot({ path: test.info().outputPath('offered.png') });
    // It never takes focus; the keyboard reaches it.
    const reload = prompt(page).getByRole('button', { name: 'Reload' });
    await expect(reload).not.toBeFocused();
    await addNote(page);
    const reloaded = page.waitForEvent('load');
    await reload.focus();
    await page.keyboard.press('Enter');
    await reloaded;
    await page.locator(CANVAS).waitFor();
    await expect(notes(page)).toHaveCount(2);
    expectNoPageErrors(pageErrors);
  });

  test('never reloads over unsaved changes, and says why', async ({ page }) => {
    test.setTimeout(45_000);
    await openBoard(page);
    await serveNewerFormat(page, { failSaves: true });
    await addNote(page);
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
    await expect(notes(page)).toHaveCount(1);
  });

  test('steps aside on Not now', async ({ page, pageErrors }) => {
    await openBoard(page);
    await serveNewerFormat(page);
    await addNote(page);
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole('button', { name: 'Not now' }).click();
    await expect(prompt(page)).toHaveCount(0);
    await addNote(page);
    await page.waitForTimeout(1_500);
    await expect(prompt(page)).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});
