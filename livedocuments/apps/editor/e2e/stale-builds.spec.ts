import type { Page } from '@playwright/test';
import { BUILD_ID_HEADER } from '@livedocuments/api-schema';
import { expect, test } from './fixtures';

// Stale builds (docs/specs/016-platform/stale-builds.md), in dark mode, on the editor: moving between
// two documents and back once a newer build is live. A deploy is simulated by the api reporting a newer
// build id than the one this export was built with.

const CRASH = "This page couldn't load";
const CANVAS = '[data-canvas-a11y-root]';

// A new blank document (/new?blank=1), which the editor opens at /document/<id>: answers its id.
async function openNewDocument(page: Page): Promise<string> {
  await page.goto('/new?blank=1');
  await page.waitForURL(/\/document\//, { timeout: 30_000 });
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
  return new URL(page.url()).pathname.split('/').pop()!;
}

// Every page load the browser makes (not client transitions).
function pageLoads(page: Page): string[] {
  const loads: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'document') loads.push(new URL(r.url()).pathname.replace(/\/$/, ''));
  });
  return loads;
}

test.describe('stale builds', () => {
  test.describe.configure({ timeout: 60_000 });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('once a newer build is live, another document and back are full page loads', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    const first = await openNewDocument(page);
    // Counted first, so an export built without an id skips at once rather than waiting for a meta
    // tag that never comes.
    const meta = page.locator('meta[name="livedocuments-build"]');
    const ownBuild = (await meta.count()) > 0 ? await meta.getAttribute('content') : null;
    test.skip(!ownBuild, 'this export was built without a build id');
    // The api now reports another build, as it does once the next deploy is live.
    await page.route('**/api/**', async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), [BUILD_ID_HEADER]: `${ownBuild}-next` },
      });
    });
    await page.reload();
    await page.locator(CANVAS).waitFor({ timeout: 30_000 });
    // The editor's own api calls carry the newer id.
    await page.waitForLoadState('networkidle');
    const loads = pageLoads(page);
    await openNewDocument(page);
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/document/${first}$`));
    await expect.poll(() => loads.at(-1)).toBe(`/document/${first}`);
    await expect(page.locator(CANVAS)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(CRASH)).toHaveCount(0);
  });
});
