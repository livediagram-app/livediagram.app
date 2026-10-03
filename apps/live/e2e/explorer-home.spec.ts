import type { Page } from '@playwright/test';
import { expect, expectNoPageErrors, mintSignedGuest, test } from './fixtures';
import { asGuest, seedBusyHome, seedHomeDocument } from './home-seed';

// Explorer Home (docs/specs/013-workspace/explorer-home.md), end to end against the real build and
// api worker, as a guest, in dark mode: the Explorer lands on Home; Jump back in, What happened and
// the Timeline column draw what the api holds; a summary expands; See all activity reaches the
// feed; a document stored only in this browser joins the strip with its pill; a phone switches
// between Recent and Timeline; nothing shifts as Home lands.

test.use({ colorScheme: 'dark' });

async function layoutShift(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          })[]) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve(total), 500);
      }),
  );
}

test('the Explorer lands on Home, with Recent beside the Timeline', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const { owner, payments } = await seedBusyHome(page.request, origin);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });

  await page.goto('/explorer');
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  await expect(page).toHaveTitle('Home | livediagram');

  const recent = page.getByRole('region', { name: 'Recent' });
  const timeline = page.getByRole('region', { name: 'Timeline' });
  const strip = recent.getByRole('list', { name: 'Jump back in' });
  await expect(strip.getByRole('link')).toHaveCount(3);
  await expect(strip.getByRole('link', { name: 'Payments architecture' })).toHaveAttribute(
    'href',
    `/document/${payments}`,
  );

  // Two people on one document: one summary, collapsed, that expands to every action.
  const summary = recent.getByRole('button', {
    name: /^(Sam and Priya|Priya and Sam) commented and edited in Payments architecture/,
  });
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toContainText('My documents');
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  const actions = page.locator(`#${await summary.getAttribute('aria-controls')}`);
  await expect(actions.getByRole('link', { name: /^Priya commented/ })).toBeVisible();
  await expect(actions.getByRole('link', { name: /^Sam edited/ })).toBeVisible();

  // The person's own documents, created today, on alternating sides of the line.
  const entries = timeline.getByRole('list', { name: 'Timeline' }).getByRole('link');
  await expect(entries).toHaveCount(3);
  await expect(entries.first()).toHaveAttribute('aria-label', /, created at /);
  await expect(timeline.getByText('Today', { exact: true })).toBeVisible();

  expect(await layoutShift(page)).toBe(0);

  // See all activity: the feed, titled All activity, leading back to Home.
  await recent.getByRole('link', { name: 'See all activity' }).click();
  await expect(page).toHaveURL(/\/explorer\/timeline\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'All activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).first().click();
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  expectNoPageErrors(pageErrors);
});

test('a document opened from Jump back in opens in the editor', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeDocument(page.request, owner, origin, 'Service map');
  await asGuest(page, owner);

  // Open it once in the editor: that open is what puts it in Jump back in.
  await page.goto(`/document/${doc.id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await page.goto('/explorer/home');
  const link = page
    .getByRole('list', { name: 'Jump back in' })
    .getByRole('link', { name: 'Service map' });
  await expect(link).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Timeline' }).getByRole('link', { name: /^Service map, / }),
  ).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/document/${doc.id}`));
  expectNoPageErrors(pageErrors);
});

test('a document stored only in this browser joins Jump back in with its pill', async ({
  page,
  pageErrors,
}) => {
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.goto('/explorer/home');
  await expect(page.getByText('The documents you open most will gather here.')).toBeVisible();

  // A local document, opened today, written as the editor writes it.
  await page.evaluate(async () => {
    const day = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('livediagram-offline', 2);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction('documents', 'readwrite');
        tx.objectStore('documents').put({
          id: crypto.randomUUID(),
          name: 'Kept on this laptop',
          folderId: null,
          createdAt: now,
          savedAt: now,
          tabs: [{ id: 't1', name: 'Tab 1', elements: [] }],
          opens: { openDays: 1, lastOpenDay: day, lastOpenedAt: now, frecencyKey: now },
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  const link = page
    .getByRole('list', { name: 'Jump back in' })
    .getByRole('link', { name: 'Kept on this laptop, Local only' });
  await expect(link).toBeVisible();
  await expect(link.getByText('Local only')).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('a phone switches between Recent and Timeline, Recent first', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const { owner } = await seedBusyHome(page.request, origin);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/explorer/home');

  const tabs = page.getByRole('tablist', { name: 'Home sections' });
  const recentTab = tabs.getByRole('tab', { name: 'Recent' });
  const timelineTab = tabs.getByRole('tab', { name: 'Timeline' });
  await expect(recentTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel').getByText('Jump back in')).toBeVisible();

  await recentTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(timelineTab).toHaveAttribute('aria-selected', 'true');
  await expect(timelineTab).toBeFocused();
  await expect(page.getByRole('tabpanel').getByRole('list', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('tabpanel').getByText('Jump back in')).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('more of the Timeline loads as the reader scrolls to its end', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  for (let i = 0; i < 35; i += 1) {
    await seedHomeDocument(page.request, owner, origin, `Sketch ${i + 1}`, []);
  }
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');

  const entries = page.getByRole('list', { name: 'Timeline' }).getByRole('link');
  await expect(entries).toHaveCount(30);
  await page.getByTestId('home-timeline-paging').scrollIntoViewIfNeeded();
  await expect(entries).toHaveCount(35);
  await expect(page.getByTestId('home-timeline-paging')).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('a failed read says so, and Try again reads again', async ({ page, pageErrors }) => {
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.route('**/api/home?*', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/explorer/home');
  const failed = page.getByText('Home could not load. Check your connection and try again.');
  await expect(failed).toBeVisible({ timeout: 20_000 });

  await page.unroute('**/api/home?*');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(failed).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Recent' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
