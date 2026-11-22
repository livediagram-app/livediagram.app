import type { Page } from '@playwright/test';
import { DOCUMENT_FORMAT, DOCUMENT_FORMAT_HEADER } from '@liveknowledge/api-schema';
import { expect, expectNoPageErrors, test } from './fixtures';
import { newServerKnowledgebase, paragraphs, writeLines } from './knowledgebase';

// The new version prompt (docs/specs/016-platform/new-version-prompt.md), in dark mode: this build is
// the "older editor", and the server is made "newer" by raising the document format number every
// api response carries. The prompt offers a reload, reloads only once the edits are saved, never
// over unsaved changes, and steps aside when closed (its close button is "Not now").

const CANVAS = '[data-canvas-a11y-root]';
const prompt = (page: Page) =>
  page.getByRole('status').filter({ hasText: /new version|Saving|saved yet/ });
const lines = (page: Page) => paragraphs(page).filter({ hasText: /^Line \d+$/ });

// Every api response says the server's format is one ahead of this editor; optionally, saves fail.
async function serveNewerFormat(page: Page, { failSaves = false } = {}) {
  await page.route('**/api/**', async (route) => {
    if (failSaves && route.request().method() === 'PUT') {
      await route.fulfill({
        status: 503,
        headers: { [DOCUMENT_FORMAT_HEADER]: String(DOCUMENT_FORMAT + 1) },
        body: '{"error":"unavailable"}',
      });
      return;
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), [DOCUMENT_FORMAT_HEADER]: String(DOCUMENT_FORMAT + 1) },
    });
  });
  // And the editor a reload would load is a newer build than this one (the e2e build's id is fixed), so
  // the prompt offers it (docs/specs/016-platform/new-version-prompt.md "When the prompt shows"): the
  // editor's own check of its page answers so, while the reload itself loads the real page.
  await page.route(
    (url) => url.pathname.startsWith('/document/'),
    async (route) => {
      // Only that check: never a page load, nor the router's own payload requests (an `RSC` header).
      const request = route.request();
      if (request.resourceType() !== 'fetch' || request.headers()['rsc'] !== undefined) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        contentType: 'text/html',
        body: '<head><meta name="liveknowledge-build" content="e2e-newer"/></head>',
      });
    },
  );
}

async function openBlank(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  // On liveknowledge, not Offline: the prompt answers what the api's responses say.
  await newServerKnowledgebase(page);
}

// One edit: a line written under the last.
async function addLine(page: Page) {
  const written = await lines(page).count();
  await writeLines(page, `Line ${written + 1}`);
  await expect(lines(page)).toHaveCount(written + 1);
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
    await addLine(page);
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
    await addLine(page);
    await expect(prompt(page)).toContainText('A new version of liveknowledge is ready.');
    await page.screenshot({ path: test.info().outputPath('offered.png') });
    // It never takes focus; the keyboard reaches it.
    const reload = prompt(page).getByRole('button', { name: 'Reload' });
    await expect(reload).not.toBeFocused();
    await addLine(page);
    const reloaded = page.waitForEvent('load');
    await reload.focus();
    await page.keyboard.press('Enter');
    await reloaded;
    await page.locator(CANVAS).waitFor();
    await expect(lines(page)).toHaveCount(2);
    expectNoPageErrors(pageErrors);
  });

  test('never reloads over unsaved changes, and says why', async ({ page }) => {
    test.setTimeout(45_000);
    await openBlank(page);
    await serveNewerFormat(page, { failSaves: true });
    await addLine(page);
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
    await expect(lines(page)).toHaveCount(1);
  });

  test('steps aside when closed', async ({ page, pageErrors }) => {
    await openBlank(page);
    await serveNewerFormat(page);
    await addLine(page);
    await expect(prompt(page)).toBeVisible();
    await prompt(page).getByRole('button', { name: 'Dismiss' }).click();
    await expect(prompt(page)).toHaveCount(0);
    await addLine(page);
    await page.waitForTimeout(1_500);
    await expect(prompt(page)).toHaveCount(0);
    expectNoPageErrors(pageErrors);
  });
});
