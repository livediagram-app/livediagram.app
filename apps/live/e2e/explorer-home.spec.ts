import type { Locator, Page } from '@playwright/test';
import { expect, expectNoPageErrors, mintSignedGuest, test } from './fixtures';
import {
  asGuest,
  box,
  editLink,
  openDocument,
  person,
  seedBusyHome,
  seedHomeDocument,
  seedLocalDocuments,
  seedWithinReach,
  visitorSaves,
} from './home-seed';

// Explorer Home (docs/specs/013-workspace/explorer-home.md), end to end against the real build and
// api worker, as a guest, in dark mode: the Explorer lands on Home, one column of Jump back in then
// What happened, each opened by a heading with a rule; Jump back in is a Within reach set (4 most
// used on top, 4 recent below, none twice) as a 4 by 2 grid, or a phone strip that alternates,
// holds eight and ends in See more; See more opens Recent, under Home; nothing shifts as Home lands.

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

const jumpBackIn = (page: Page) => page.getByRole('list', { name: 'Jump back in' });
const names = async (list: Locator) =>
  list.getByRole('link').evaluateAll((links) => links.map((l) => l.getAttribute('aria-label')));

test('the Explorer lands on Home: Jump back in, then What happened, no Timeline', async ({
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

  const jump = page.getByRole('region', { name: 'Jump back in' });
  const happened = page.getByRole('region', { name: 'What happened' });
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(3);
  await expect(
    jumpBackIn(page).getByRole('link', { name: 'Payments architecture' }),
  ).toHaveAttribute('href', `/document/${payments}`);
  // No Timeline column, no switch, no group titles.
  await expect(page.getByRole('region', { name: 'Timeline' })).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(jump.getByText(/most used/i)).toHaveCount(0);

  // One column: What happened sits under Jump back in, the same width.
  const [a, b] = [await jump.boundingBox(), await happened.boundingBox()];
  expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  expect(Math.round(b!.width)).toBe(Math.round(a!.width));

  // Two people on one document: one summary, collapsed, that expands to every action.
  const summary = happened.getByRole('button', {
    name: /^(Sam and Priya|Priya and Sam) commented and edited in Payments architecture/,
  });
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toContainText('My documents');
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  const actions = page.locator(`#${await summary.getAttribute('aria-controls')}`);
  await expect(actions.getByRole('link', { name: /^Priya commented/ })).toBeVisible();
  await expect(actions.getByRole('link', { name: /^Sam edited/ })).toBeVisible();

  expect(await layoutShift(page)).toBe(0);

  // See all activity: the feed, titled All activity, leading back to Home.
  await happened.getByRole('link', { name: 'See all activity' }).click();
  await expect(page).toHaveURL(/\/explorer\/timeline\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'All activity' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).first().click();
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  expectNoPageErrors(pageErrors);
});

test('each section opens with a heading with a rule, in dark and light', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const { owner } = await seedBusyHome(page.request, origin);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(3);

  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.evaluate(
      (s) => document.documentElement.classList.toggle('dark', s === 'dark'),
      scheme,
    );
    for (const [name, link] of [
      ['Jump back in', 'See more'],
      ['What happened', 'See all activity'],
    ] as const) {
      const heading = page.getByRole('heading', { level: 2, name });
      const row = heading.locator('..');
      const style = await row.evaluate((el) => {
        const s = getComputedStyle(el);
        return { width: s.borderBottomWidth, style: s.borderBottomStyle };
      });
      expect(style, `${scheme} ${name} rule`).toEqual({ width: '1px', style: 'solid' });
      // The rule spans the section; the link sits at the row's right end.
      const section = page.getByRole('region', { name });
      expect(Math.round((await row.boundingBox())!.width)).toBe(
        Math.round((await section.boundingBox())!.width),
      );
      const linkBox = await row.getByRole('link', { name: link }).boundingBox();
      const rowBox = await row.boundingBox();
      expect(Math.round(linkBox!.x + linkBox!.width)).toBe(Math.round(rowBox!.x + rowBox!.width));
      expect(await heading.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBe(
        16,
      );
    }
  }
  expectNoPageErrors(pageErrors);
});

test('Jump back in is 4 most used on top and 4 recent below, none twice', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await seedWithinReach(page, origin, owner);

  const list = jumpBackIn(page);
  await expect(list.getByRole('link')).toHaveCount(8);
  expect(await names(list)).toEqual([
    'Atlas, Local only',
    'Beacon, Local only',
    'Compass, Local only',
    'Delta, Local only',
    'Server two',
    'Server one',
    'Echo, Local only',
    'Foxtrot, Local only',
  ]);
  // Atlas is both the most used and the newest: it shows once, under most used.
  await expect(list.getByRole('link', { name: /^Atlas/ })).toHaveCount(1);

  // Two rows of four; no sideways scrolling.
  const tops = await list
    .getByRole('listitem')
    .evaluateAll((items) => items.map((i) => Math.round(i.getBoundingClientRect().top)));
  expect(new Set(tops.slice(0, 4)).size).toBe(1);
  expect(new Set(tops.slice(4)).size).toBe(1);
  expect(tops[4]!).toBeGreaterThan(tops[0]!);
  expect(await list.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

  // See more: the Recent page, under Home in the breadcrumb.
  await page
    .getByRole('region', { name: 'Jump back in' })
    .getByRole('link', { name: 'See more' })
    .click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Recent' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).first().click();
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  expectNoPageErrors(pageErrors);
});

test('on a phone the strip alternates, holds eight and ends in See more', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 390, height: 844 });
  await seedWithinReach(page, origin, owner);

  const list = jumpBackIn(page);
  await expect(list.getByRole('link')).toHaveCount(8);
  expect(await names(list)).toEqual([
    'Atlas, Local only',
    'Server two',
    'Beacon, Local only',
    'Server one',
    'Compass, Local only',
    'Echo, Local only',
    'Delta, Local only',
    'Foxtrot, Local only',
  ]);
  // One row, sideways.
  const tops = await list
    .getByRole('listitem')
    .evaluateAll((items) => items.map((i) => Math.round(i.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);

  // The strip ends in See more, the only one (no heading-row link on a phone).
  const region = page.getByRole('region', { name: 'Jump back in' });
  const seeMore = region.getByRole('link', { name: 'See more' });
  await expect(seeMore).toHaveCount(1);
  await seeMore.scrollIntoViewIfNeeded();
  const tile = await seeMore.boundingBox();
  const last = await list.getByRole('listitem').last().boundingBox();
  expect(tile!.x).toBeGreaterThan(last!.x);
  await seeMore.click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
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
  const link = jumpBackIn(page).getByRole('link', { name: 'Service map' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/document/${doc.id}`));
  expectNoPageErrors(pageErrors);
});

test('with fewer than eight, only what exists shows, and nothing shifts', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeDocument(page.request, owner, origin, 'Only one');
  await openDocument(page.request, owner, doc);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');

  const list = jumpBackIn(page);
  await expect(list.getByRole('listitem')).toHaveCount(1);
  // The grid keeps its two rows' height: What happened never moves.
  expect(Math.round((await list.boundingBox())!.height)).toBe(212);
  expect(await layoutShift(page)).toBe(0);
  expectNoPageErrors(pageErrors);
});

test('a document stored only in this browser joins Jump back in with its pill', async ({
  page,
  pageErrors,
}) => {
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');
  await expect(
    page.getByText('The documents you use most and last will gather here.'),
  ).toBeVisible();

  await seedLocalDocuments(page, [{ name: 'Kept on this laptop', daysAgo: [0], lastOpenedIn: 0 }]);
  await page.reload();
  const link = jumpBackIn(page).getByRole('link', { name: 'Kept on this laptop, Local only' });
  await expect(link).toBeVisible();
  await expect(link.getByText('Local only')).toBeVisible();
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
  await expect(page.getByRole('region', { name: 'Jump back in' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('what others did since the last look is marked New', async ({ page, baseURL, pageErrors }) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeDocument(page.request, owner, origin, 'Launch plan');
  const code = await editLink(page.request, owner, origin, doc.id);
  await asGuest(page, owner);

  // The first look sets the mark; nothing is new to someone who never looked.
  await page.goto('/explorer/home');
  await expect(page.getByText('Nothing from others in the last 14 days.')).toBeVisible();

  const lee = await person(page.request, 'Lee', '#14b8a6');
  await visitorSaves(page.request, lee, code, doc, [box('a', 'Launch day', 40, 40)]);
  await page.reload();
  const entry = page.getByRole('link', { name: /^Lee edited Launch plan/ });
  await expect(entry).toBeVisible();
  await expect(entry.getByText('New', { exact: true })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
