import type { Locator, Page } from '@playwright/test';
import { expect, expectNoPageErrors, mintSignedGuest, test } from './fixtures';
import {
  asGuest,
  box,
  editLink,
  openProject,
  person,
  seedBusyHome,
  seedHomeProject,
  seedLocalProjects,
  seedWithinReach,
  visitorSaves,
} from './home-seed';

// Explorer Home (docs/specs/013-workspace/explorer-home.md), end to end against the real build and
// api worker, as a guest, in dark mode: the Explorer lands on Home, its hero then one column of Jump
// back in and What Happened, each opened by a display heading; Jump Back In is a Within reach set (4
// most used cards under Most Used, 4 recent under Recent, none twice), or a phone strip that
// alternates, holds eight and ends in See More; See More opens Recent, under Home; nothing shifts as
// Home lands.

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

// Jump Back In's projects: the Most Used and Recent lists on a wide screen, the strip on a phone.
const jumpBackIn = (page: Page) =>
  page.getByRole('region', { name: 'Jump Back In' }).getByRole('listitem');
const names = async (list: Locator) =>
  list.getByRole('link').evaluateAll((links) => links.map((l) => l.getAttribute('aria-label')));

test('the Explorer lands on Home: Jump Back In, then What Happened, no Timeline', async ({
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
  // The hero is Home's header: the greeting is the page's heading; the field and New Project sit in it.
  const hero = page.getByRole('region', { name: /what are you planning today\?$/ });
  await expect(hero.getByRole('heading', { level: 1 })).toHaveText(
    /^Good (morning|afternoon|evening), what are you planning today\?$/,
  );
  await expect(hero.getByRole('combobox', { name: 'Filter projects' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Filter projects' })).toHaveCount(1);
  await expect(hero.getByRole('button', { name: 'New Project' })).toBeVisible();
  await expect(page).toHaveTitle('Home | liveplanner');

  const jump = page.getByRole('region', { name: 'Jump Back In' });
  const happened = page.getByRole('region', { name: 'What Happened' });
  await expect(jumpBackIn(page).getByRole('link')).toHaveCount(3);
  await expect(
    jumpBackIn(page).getByRole('link', { name: 'Payments architecture' }),
  ).toHaveAttribute('href', `/project/${payments}`);
  // No Timeline column, no switch; the groups are labelled.
  await expect(page.getByRole('region', { name: 'Timeline' })).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(jump.getByRole('heading', { level: 3 }).first()).toBeVisible();

  // One column: What Happened sits under Jump Back In, the same width.
  const [a, b] = [await jump.boundingBox(), await happened.boundingBox()];
  expect(b!.y).toBeGreaterThan(a!.y + a!.height);
  expect(Math.round(b!.width)).toBe(Math.round(a!.width));

  // Two people on one project: one summary, collapsed, that expands to every action.
  const summary = happened.getByRole('button', {
    name: /^(Sam and Priya|Priya and Sam) commented and edited in Payments architecture/,
  });
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(summary).toContainText('My Projects');
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
  const actions = page.locator(`#${await summary.getAttribute('aria-controls')}`);
  await expect(actions.getByRole('link', { name: /^Priya commented/ })).toBeVisible();
  await expect(actions.getByRole('link', { name: /^Sam edited/ })).toBeVisible();

  expect(await layoutShift(page)).toBe(0);

  // What Happened has no See Timeline link, and the sidebar no Timeline row: the Timeline is gone.
  await expect(happened.getByRole('link', { name: 'See Timeline' })).toHaveCount(0);
  await expect(page.getByRole('treeitem', { name: 'Timeline' })).toHaveCount(0);
  expectNoPageErrors(pageErrors);
});

test('each section opens with a display heading and no rule, in dark and light', async ({
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
      ['Jump Back In', 'See More'],
      ['What Happened', null],
    ] as const) {
      const heading = page.getByRole('heading', { level: 2, name });
      const row = heading.locator('..');
      const style = await row.evaluate((el) => {
        const s = getComputedStyle(el);
        return { width: s.borderBottomWidth, style: s.borderBottomStyle };
      });
      // Every element carries the base style's solid border at no width; a rule would have width.
      expect(style.width, `${scheme} ${name} has no rule`).toBe('0px');
      // The row spans the section; the link sits at its right end.
      const section = page.getByRole('region', { name });
      expect(Math.round((await row.boundingBox())!.width)).toBe(
        Math.round((await section.boundingBox())!.width),
      );
      if (link) {
        const linkBox = await row.getByRole('link', { name: link }).boundingBox();
        const rowBox = await row.boundingBox();
        expect(Math.round(linkBox!.x + linkBox!.width)).toBe(Math.round(rowBox!.x + rowBox!.width));
      }
      expect(await heading.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))).toBe(
        24,
      );
    }
  }
  expectNoPageErrors(pageErrors);
});

test('Jump Back In is 4 most used cards, then 4 recent, none twice', async ({
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
  expect(await names(page.getByRole('list', { name: 'Most Used' }))).toEqual([
    'Atlas, This Browser',
    'Beacon, This Browser',
    'Compass, This Browser',
    'Delta, This Browser',
  ]);
  expect(await names(page.getByRole('list', { name: 'Recent' }))).toEqual([
    'Server two',
    'Server one',
    'Echo, This Browser',
    'Foxtrot, This Browser',
  ]);
  // Atlas is both the most used and the newest: it shows once, under most used.
  await expect(list.getByRole('link', { name: /^Atlas/ })).toHaveCount(1);

  // Four across in each group; no sideways scrolling.
  const tops = await list.evaluateAll((items) =>
    items.map((i) => Math.round(i.getBoundingClientRect().top)),
  );
  expect(new Set(tops.slice(0, 4)).size).toBe(1);
  expect(new Set(tops.slice(4)).size).toBe(1);
  expect(tops[4]!).toBeGreaterThan(tops[0]!);
  const region = page.getByRole('region', { name: 'Jump Back In' });
  expect(await region.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

  // See More: the Recent page, under Home in the breadcrumb.
  await page
    .getByRole('region', { name: 'Jump Back In' })
    .getByRole('link', { name: 'See More' })
    .click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Recent' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).first().click();
  await expect(page).toHaveURL(/\/explorer\/home\/?$/);
  expectNoPageErrors(pageErrors);
});

test('on a phone the strip alternates, holds eight and ends in See More', async ({
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
    'Atlas, This Browser',
    'Server two',
    'Beacon, This Browser',
    'Server one',
    'Compass, This Browser',
    'Echo, This Browser',
    'Delta, This Browser',
    'Foxtrot, This Browser',
  ]);
  // One row, sideways.
  const tops = await list.evaluateAll((items) =>
    items.map((i) => Math.round(i.getBoundingClientRect().top)),
  );
  expect(new Set(tops).size).toBe(1);

  // The strip ends in See More, the only one (no heading-row link on a phone).
  const region = page.getByRole('region', { name: 'Jump Back In' });
  const seeMore = region.getByRole('link', { name: 'See More' });
  await expect(seeMore).toHaveCount(1);
  await seeMore.scrollIntoViewIfNeeded();
  const tile = await seeMore.boundingBox();
  const last = await list.last().boundingBox();
  expect(tile!.x).toBeGreaterThan(last!.x);
  await seeMore.click();
  await expect(page).toHaveURL(/\/explorer\/recent\/?$/);
  expectNoPageErrors(pageErrors);
});

test('a project opened from Jump Back In opens in the editor', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeProject(page.request, owner, origin, 'Service map');
  await asGuest(page, owner);

  // Open it once in the editor: that open is what puts it in Jump Back In.
  await page.goto(`/project/${doc.id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor();
  await page.goto('/explorer/home');
  const link = jumpBackIn(page).getByRole('link', { name: 'Service map' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/project/${doc.id}`));
  expectNoPageErrors(pageErrors);
});

test('with fewer than eight, only what exists shows, and nothing shifts', async ({
  page,
  baseURL,
  pageErrors,
}) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeProject(page.request, owner, origin, 'Only one');
  await openProject(page.request, owner, doc);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');

  const list = jumpBackIn(page);
  await expect(list).toHaveCount(1);
  // Jump Back In keeps both groups' height at lg: a label and a row of each. What Happened never moves.
  const groups = page.locator('[data-jump-back-in-group]').first().locator('..');
  expect(Math.round((await groups.boundingBox())!.height)).toBe(330);
  expect(await layoutShift(page)).toBe(0);
  expectNoPageErrors(pageErrors);
});

test('a project stored only in this browser joins Jump Back In with its pill', async ({
  page,
  pageErrors,
}) => {
  const owner = await mintSignedGuest(page.request);
  await asGuest(page, owner);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/explorer/home');
  // Nothing yet: the first run's starts (explorer-home.md "First run"), not an empty Jump Back In.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Welcome to liveplanner. What are you making first?',
  );
  await expect(page.getByRole('region', { name: 'Start Blank' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Blank Diagram/ })).toHaveAttribute(
    'href',
    '/new?template=blank',
  );

  await seedLocalProjects(page, [{ name: 'Kept on this laptop', daysAgo: [0], lastOpenedIn: 0 }]);
  await page.reload();
  const link = jumpBackIn(page).getByRole('link', { name: 'Kept on this laptop, This Browser' });
  await expect(link).toBeVisible();
  await expect(link.getByText('This Browser', { exact: true })).toBeVisible();
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
  // A guest with nothing yet: the read in, Home is the first run's starts (explorer-home.md "First run").
  await expect(page.getByRole('region', { name: 'Start Blank' })).toBeVisible();
  expectNoPageErrors(pageErrors);
});

test('what others did since the last look is marked New', async ({ page, baseURL, pageErrors }) => {
  const origin = new URL(baseURL!).origin;
  const owner = await mintSignedGuest(page.request);
  const doc = await seedHomeProject(page.request, owner, origin, 'Launch plan');
  const code = await editLink(page.request, owner, origin, doc.id);
  await asGuest(page, owner);

  // The first look sets the mark; nothing is new to someone who never looked. With nothing from anyone
  // yet, What Happened is left out (explorer-home.md "What happened").
  await page.goto('/explorer/home');
  await expect(page.getByRole('region', { name: 'Jump Back In' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'What Happened' })).toHaveCount(0);

  const lee = await person(page.request, 'Lee', '#14b8a6');
  await visitorSaves(page.request, lee, code, doc, [box('a', 'Launch day', 40, 40)]);
  await page.reload();
  const entry = page.getByRole('link', { name: /^Lee edited Launch plan/ });
  await expect(entry).toBeVisible();
  await expect(entry.getByText('New', { exact: true })).toBeVisible();
  expectNoPageErrors(pageErrors);
});
