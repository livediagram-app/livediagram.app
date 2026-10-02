import type { Page } from '@playwright/test';
import { BUILD_ID_HEADER } from '@livediagram/api-schema';
import { expect, test } from './fixtures';

// Stale builds (docs/specs/016-platform/stale-builds.md), in dark mode, on the Explorer, whose
// sections are separate routes with their own code chunks. A deploy is simulated two ways: the code
// chunks this page has not loaded yet answer 404 (the old names are gone), and the api reports a
// newer build id than the one this export was built with.

const CRASH = "This page couldn't load";

async function openExplorer(page: Page, path = '/explorer/activity') {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Recent', exact: true })).toBeVisible({
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

// A deploy, simulated: from now on every code chunk this page has not fetched before answers 404,
// as a removed file does (prefetches included), until a page load of `destination`, whose HTML
// names the chunks the server has.
async function removeUnseenChunks(page: Page, ledger: Set<string>, destination: RegExp) {
  // Frozen now: the ledger goes on recording, the 404s included.
  const seen = new Set(ledger);
  let stale = true;
  page.on('request', (r) => {
    if (r.resourceType() === 'document' && destination.test(new URL(r.url()).pathname)) {
      stale = false;
    }
  });
  await page.route('**/_next/static/chunks/**', (route) =>
    stale && !seen.has(route.request().url())
      ? route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' })
      : route.continue(),
  );
}

// Every code chunk the page fetches, from the start of the test.
function chunkLedger(page: Page): Set<string> {
  const seen = new Set<string>();
  page.on('request', (r) => {
    if (r.url().includes('/_next/static/chunks/')) seen.add(r.url());
  });
  return seen;
}

test.describe('stale builds', () => {
  test.describe.configure({ timeout: 60_000 });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  // The Explorer loads each section's view lazily: Trash's code is a chunk this page never fetched.
  test('a section whose chunk is gone loads in full instead of crashing', async ({ page }) => {
    const seen = chunkLedger(page);
    await openExplorer(page, '/explorer/unsorted');
    await removeUnseenChunks(page, seen, /^\/explorer\/trash/);
    const loads = pageLoads(page);
    await page.getByRole('button', { name: 'Trash', exact: true }).click();
    await expect.poll(() => loads).toEqual(['/explorer/trash']);
    await expect(page.getByRole('heading', { name: 'Trash', level: 1 })).toBeVisible();
    await expect(page.getByText(/This page couldn.t load|Something went wrong/)).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath('recovered.png') });
  });

  test('reloads at most once: a second failure shows the error, never a loop', async ({ page }) => {
    const seen = chunkLedger(page);
    await openExplorer(page, '/explorer/unsorted');
    // This destination was already reloaded for a moment ago.
    await page.evaluate(() =>
      sessionStorage.setItem(
        'livediagram:stale-chunk-reloads',
        JSON.stringify({ '/explorer/trash': Date.now() }),
      ),
    );
    await removeUnseenChunks(page, seen, /^$/);
    const loads = pageLoads(page);
    await page.getByRole('button', { name: 'Trash', exact: true }).click();
    await expect(
      page.getByText(/This page couldn.t load|Something went wrong/).first(),
    ).toBeVisible();
    await page.waitForTimeout(1_500);
    expect(loads).toEqual([]);
    await page.screenshot({ path: test.info().outputPath('gave-up.png') });
  });

  test('once a newer build is live, links and back are full page loads', async ({ page }) => {
    const ownBuild = await (async () => {
      await openExplorer(page);
      return page.locator('meta[name="livediagram-build"]').getAttribute('content');
    })();
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
    await expect(page.getByRole('button', { name: 'Recent', exact: true })).toBeVisible();
    // The Explorer's own api calls carry the newer id.
    await page.waitForLoadState('networkidle');
    const loads = pageLoads(page);
    await page.getByRole('button', { name: 'Recent', exact: true }).click();
    await expect.poll(() => loads).toEqual(['/explorer/recent']);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Activity', exact: true }).click();
    await expect.poll(() => loads).toEqual(['/explorer/recent', '/explorer/activity']);
    await page.waitForLoadState('networkidle');
    await page.goBack();
    await expect.poll(() => loads.length).toBe(3);
    await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
    await expect(page.getByText(CRASH)).toHaveCount(0);
  });
});
