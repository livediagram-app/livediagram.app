import type { Browser, Page } from '@playwright/test';
import { presetSetup } from '@livediagram/items';
import {
  dismissQuickTour,
  expect,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  test,
} from './fixtures';

// Two people set up one Plan board at once (docs/specs/012-collaboration/collab-race-hardening.md, phase 6).
// Column cogs edit the board without selecting it, so the selection lock never heads off a collision; each
// person's change travels as only what changed, so both renames survive on both screens and in D1.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

async function openAs(
  browser: Browser,
  baseURL: string,
  url: string,
  owner: string | null,
): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(
    ({ o, sig }) => {
      if (o) {
        localStorage.setItem('livediagram:v2:self-id', o);
        if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
        localStorage.setItem('livediagram:v2:name-confirmed', '1');
      }
      localStorage.setItem(
        'livediagram:user-preferences:v1',
        JSON.stringify({ planTourSeen: true }),
      );
    },
    { o: owner, sig: owner ? guestSigFor(owner) : null },
  );
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

const heads = (page: Page) =>
  page
    .locator('[data-plan-board]')
    .first()
    .getByRole('button', { name: / column settings$/ })
    .evaluateAll((ns) =>
      ns.map((n) => (n.getAttribute('aria-label') ?? '').replace(' column settings', '')),
    );

async function toPlan(page: Page) {
  await page.getByRole('button', { name: /^Editor mode: / }).click();
  await page.getByRole('menuitemradio', { name: /^Plan/ }).click();
}

async function startRename(page: Page, from: string, to: string) {
  await page
    .locator('[data-plan-board]')
    .first()
    .getByRole('button', { name: `${from} column settings` })
    .click();
  const name = page.getByLabel('Column name');
  await name.fill(to);
  return name;
}

test('two people renaming different columns of one board both keep their rename', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await mintSignedGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin });
  const seeded = await page.request.post(`${apiBase}/documents`, {
    headers,
    data: {
      id,
      name: 'Board room',
      tabs: [
        {
          id: tabId,
          name: 'Board',
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
    },
  });
  expect(seeded.ok()).toBe(true);
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'edit' },
  });
  const code = ((await share.json()) as { link: { code: string } }).link.code;

  const a = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await a.locator(CANVAS).waitFor();
  const b = await openAs(browser, baseURL!, `/document/shared?s=${code}`, null);
  await b.getByRole('button', { name: /^join$/i }).click();
  await b.locator(CANVAS).waitFor();
  await dismissQuickTour(a);
  await dismissQuickTour(b);
  await toPlan(a);
  await toPlan(b);
  await expect.poll(() => heads(b)).toContain('Review');

  // Both rename at once, each a different column.
  const onA = await startRename(a, 'To do', 'Ready');
  const onB = await startRename(b, 'Review', 'Checking');
  await Promise.all([onA.press('Enter'), onB.press('Enter')]);
  await a.keyboard.press('Escape');
  await b.keyboard.press('Escape');

  for (const p of [a, b]) {
    await expect
      .poll(() => heads(p))
      .toEqual(['Backlog', 'Ready', 'In progress', 'Checking', 'Done']);
  }
  // D1 keeps both: a reload shows them.
  await expect
    .poll(async () => {
      await a.reload();
      await a.locator('[data-plan-board]').first().waitFor();
      await toPlan(a);
      return heads(a);
    })
    .toEqual(['Backlog', 'Ready', 'In progress', 'Checking', 'Done']);

  await a.context().close();
  await b.context().close();
});

// A late joiner sees cards already held (docs/specs/026-plan/plan-mode.md "Collaboration"): the room keeps
// no holds, so the holder says its card again when someone new joins.
test('someone who joins after a card was opened sees it held', async ({
  page,
  browser,
  baseURL,
}) => {
  // Two browsers, a share-link join and a held card: more than the default 30 seconds on a slow runner.
  test.setTimeout(60_000);
  const owner = await mintSignedGuest(page.request);
  const id = crypto.randomUUID();
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin });
  const seeded = await page.request.post(`${apiBase}/documents`, {
    headers,
    data: {
      id,
      name: 'Held card',
      tabs: [
        {
          id: crypto.randomUUID(),
          name: 'Board',
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
    },
  });
  expect(seeded.ok()).toBe(true);
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'edit' },
  });
  const code = ((await share.json()) as { link: { code: string } }).link.code;

  // A adds a card and opens it: the card is held before B arrives.
  const a = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await a.locator(CANVAS).waitFor();
  await dismissQuickTour(a);
  await toPlan(a);
  const boardA = a.locator('[data-plan-board]').first();
  await boardA
    .getByRole('button', { name: /add card/i })
    .nth(1)
    .click();
  // The Add a Card menu's tiles are menu items (the shared menu tiles).
  await a.getByRole('menuitem', { name: /^Task$/ }).click();
  await boardA.getByText('New task').first().click();
  await expect(a.getByRole('dialog')).toBeVisible();

  // B joins late, and sees A's tag on that card without A doing anything more.
  const b = await openAs(browser, baseURL!, `/document/shared?s=${code}`, null);
  await b.getByRole('button', { name: /^join$/i }).click();
  await b.locator(CANVAS).waitFor();
  await dismissQuickTour(b);
  await toPlan(b);
  const cardB = b.locator('[data-plan-board] [data-plan-card]').filter({ hasText: 'New task' });
  await expect(cardB.locator('[data-presence-tag]')).toBeVisible({ timeout: 10_000 });

  // A closes the card: the tag goes for B too.
  await a.keyboard.press('Escape');
  await expect(cardB.locator('[data-presence-tag]')).toHaveCount(0);

  await a.context().close();
  await b.context().close();
});
