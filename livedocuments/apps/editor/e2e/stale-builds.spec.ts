import type { Page } from '@playwright/test';
import { BUILD_ID_HEADER } from '@livedocuments/api-schema';
import { expect, test } from './fixtures';

// Stale builds (docs/specs/016-platform/stale-builds.md), in dark mode, on the Explorer, whose
// sections are separate routes. A deploy is simulated by the api reporting a newer build id than the
// one this export was built with.

const CRASH = "This page couldn't load";

async function openExplorer(page: Page, path = '/explorer/inbox') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(path);
  await expect(page.getByRole('treeitem', { name: /^Home/ })).toBeVisible({
    timeout: 30_000,
  });
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
  // (The tests of a section whose code chunk is gone went with the Explorer's own section views: the shared
  // Explorer draws every section from one chunk.)

  test('once a newer build is live, links and back are full page loads', async ({ page }) => {
    await openExplorer(page);
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
    await expect(page.getByRole('treeitem', { name: /^Home/ })).toBeVisible();
    // The Explorer's own api calls carry the newer id.
    await page.waitForLoadState('networkidle');
    const loads = pageLoads(page);
    await page.getByRole('treeitem', { name: /^Home/ }).click();
    await expect.poll(() => loads).toEqual(['/explorer/home']);
    await page.waitForLoadState('networkidle');
    await page.getByRole('treeitem', { name: /^Inbox/ }).click();
    await expect.poll(() => loads).toEqual(['/explorer/home', '/explorer/inbox']);
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await expect.poll(() => loads.length).toBe(3);
    await expect(page).toHaveURL(/\/explorer\/home\/?$/);
    await expect(page.getByText(CRASH)).toHaveCount(0);
  });
});
