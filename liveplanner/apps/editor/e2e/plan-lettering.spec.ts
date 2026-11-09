import type { Locator, Page } from '@playwright/test';
import { defaultCatalogue, presetSetup } from '@liveplanner/items';
import { adoptGuest, dismissQuickTour, expect, mintGuest, seedPlan, test } from './fixtures';

// The lettering rule (docs/specs/004-interface-design/fonts.md "On boards and cards" and "On Dashboards and views")
// end to end: headings take the tab's face, everything read small the UI face. The unit tests can only see the
// custom properties a root sets (jsdom resolves no var()), so whether a title really draws in Bodoni Moda while a
// pill beside it does not needs a browser's computed style.

const CANVAS = '[data-canvas-a11y-root]';
// The tab's face, and the family name its stack resolves to.
const FONT_ID = 'abril-fatface';
const FACE = /Bodoni Moda/;

const fontOf = (el: Locator) => el.evaluate((n) => getComputedStyle(n).fontFamily);

async function open(page: Page, owner: string, id: string): Promise<void> {
  await adoptGuest(page, owner);
  await page.addInitScript(() => {
    localStorage.setItem('liveplanner:v2:name-confirmed', '1');
    localStorage.setItem(
      'liveplanner:user-preferences:v1',
      JSON.stringify({ planTourSeen: true, planTourTracks: ['boards', 'sheets'] }),
    );
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/project/${id}`);
  await page.locator(CANVAS).waitFor();
  await dismissQuickTour(page);
}

test('a card’s title draws in the tab’s face and its pills in the UI face', async ({ page }) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedPlan(page.request, owner, {
    id,
    name: 'Lettering board',
    itemTypes: defaultCatalogue(),
    tabs: [
      {
        id: crypto.randomUUID(),
        name: 'Board',
        kind: 'board',
        font: FONT_ID,
        elements: [
          {
            id: 'board',
            type: 'shape',
            shape: 'plan-board',
            x: 100,
            y: 100,
            width: 1100,
            height: 560,
            planBoard: presetSetup('kanban'),
          },
        ],
      },
    ],
  });
  expect(seeded.ok()).toBe(true);
  await open(page, owner, id);

  const board = page.locator('[data-plan-board]').first();
  await board
    .getByRole('button', { name: /add card/i })
    .nth(1)
    .click();
  await page.getByRole('menuitem', { name: /^Task$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  const card = board.locator('[data-plan-card]').filter({ hasText: 'New task' }).first();
  await expect(card).toBeVisible();
  // The webfont arrives after first paint; the computed family is there from the start, but wait for it anyway so a
  // failure shot shows the real face.
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => fontOf(card.getByText('New task', { exact: true }))).toMatch(FACE);

  // A pill: every other line of text on the card (its number, type chip, dates) is in the UI face.
  const others = await card.evaluate((root) => {
    const out: { text: string; font: string }[] = [];
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      const own = [...el.childNodes].some((c) => c.nodeType === 3 && c.textContent?.trim());
      const text = el.textContent.trim();
      if (!own || text === 'New task') continue;
      out.push({ text, font: getComputedStyle(el).fontFamily });
    }
    return out;
  });
  expect(others.length, 'the card shows a pill beside its title').toBeGreaterThan(0);
  for (const pill of others) expect(pill.font, pill.text).not.toMatch(FACE);
  // A column's name is a heading too.
  expect(await fontOf(board.getByText('Backlog', { exact: true }).first())).toMatch(FACE);
});

test('a Dashboard letters its headings in the tab’s face and its figures in the UI face', async ({
  page,
}) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedPlan(page.request, owner, {
    id,
    name: 'Lettering dashboard',
    itemTypes: defaultCatalogue(),
    tabs: [
      {
        id: crypto.randomUUID(),
        name: 'Overview',
        kind: 'dashboard',
        font: FONT_ID,
        elements: [
          {
            id: 'metric',
            type: 'shape',
            shape: 'plan-view',
            x: 0,
            y: 0,
            width: 320,
            height: 200,
            planView: { view: 'metric:count' },
          },
        ],
        dashboard: {
          rows: [
            {
              id: 'r1',
              height: 320,
              slots: [
                {
                  id: 's1',
                  span: 6,
                  content: { type: 'note', title: 'Launch Notes', text: '12 cards open' },
                },
                { id: 's2', span: 6, content: { type: 'element', elementId: 'metric' } },
              ],
            },
          ],
        },
      },
    ],
  });
  expect(seeded.ok()).toBe(true);
  await open(page, owner, id);

  const dashboard = page.getByRole('region', { name: 'Overview dashboard' });
  await expect(dashboard).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The Note's heading takes the tab's face; its text does not.
  await expect.poll(() => fontOf(dashboard.getByLabel('Note heading'))).toMatch(FACE);
  expect(await fontOf(dashboard.getByLabel('Note text'))).not.toMatch(FACE);
  // A metric is a figure and a small label: the UI face, its figure included.
  const tile = dashboard.locator('[role="group"][aria-label*=":"]').first();
  await expect(tile).toBeVisible();
  expect(await fontOf(tile)).not.toMatch(FACE);
  expect(await fontOf(tile.locator('.tabular-nums').first())).not.toMatch(FACE);
});
