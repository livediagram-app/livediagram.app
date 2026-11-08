import type { Browser, Locator, Page } from '@playwright/test';
import {
  adoptGuest,
  documentHeaders,
  expect,
  markModeToursSeen,
  mintGuest,
  seedTab,
  serverNewUrl,
  test,
} from './fixtures';

// A game of ping-pong between two browsers (docs/specs/009-elements/social-pieces.md "A game", "The wire"): the owner
// and a guest walk into a Space, sit at either end of a Ping-Pong Table, and play to 11, each moving their paddle with
// the mouse over the table. The owner meets every ball but the first one served to them; the guest misses every
// ball. Both screens must end on the same won game with the same score: the ball is simulated on each screen from
// the moments the room relays, so this is the one check of the whole wire end to end.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';
const SPACE = 'team-pod';
const TABLE = 'pp';
// The table top on the art's grid (PING_PONG_TOP in @livehuddle/document): the paddle's 0 to 1 runs down it.
const GRID_H = 112;
const TOP_Y = 30;
const TOP_H = 44;

async function personIn(browser: Browser, baseURL: string, owner: string | null): Promise<Page> {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(
    ({ o }) => {
      if (o) localStorage.setItem('livehuddle:v2:name-confirmed', '1');
    },
    { o: owner },
  );
  await markModeToursSeen(ctx);
  return ctx.newPage();
}

const self = (page: Page) => page.locator('[data-avatar="self"]');
const table = (page: Page) => page.locator(`[data-element-id="${TABLE}"]`).first();
const board = (page: Page) => table(page).getByRole('status');

// Walk to one end of the table and sit there: a walking click near that end, then the seat it arrives at.
async function sitAt(page: Page, end: 'left' | 'right'): Promise<void> {
  const box = (await table(page).boundingBox())!;
  const x = box.x + box.width * (end === 'left' ? 0.08 : 0.92);
  await page.mouse.click(x, box.y + box.height * 0.62);
  await expect(table(page).getByRole('img', { name: /\bYou\b.* sitting$/ })).toBeVisible({
    timeout: 15_000,
  });
}

// The ball's height on the table, 0 to 1, from its drawn transform; null while there is none.
async function ballY(page: Page): Promise<number | null> {
  return page
    .locator('[data-pong-ball]')
    .evaluate(
      (g, [top, h]) => {
        const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform') ?? '');
        const y = m ? Number(m[2]) : -999;
        return y < 0 ? null : (y - top) / h;
      },
      [TOP_Y, TOP_H] as const,
    )
    .catch(() => null);
}

// Hold the paddle at a height over the table: the pointer over the table moves it.
async function paddleTo(page: Page, control: Locator, axis: number): Promise<void> {
  const box = await control.boundingBox();
  if (!box) return;
  const y = box.y + box.height * ((TOP_Y + Math.min(1, Math.max(0, axis)) * TOP_H) / GRID_H);
  await page.mouse.move(box.x + box.width / 2, y);
}

// One player's hand until the game is won: `meets` follows the ball, otherwise keeps away from it.
async function play(page: Page, meets: (score: string) => boolean): Promise<void> {
  const control = page.locator('[data-pong-control]');
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    const status = await board(page)
      .getAttribute('data-pong-status')
      .catch(() => null);
    if (status === 'won') return;
    const score =
      (await board(page)
        .getAttribute('data-pong-score')
        .catch(() => null)) ?? '0-0';
    const y = await ballY(page);
    if (y !== null) await paddleTo(page, control, meets(score) ? y : y > 0.5 ? 0 : 1);
    else await page.waitForTimeout(20);
  }
}

test('two people play ping-pong to 11 and both see the same score', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  const owner = await mintGuest(page.request);
  const ownerPage = await personIn(browser, baseURL!, owner);
  await ownerPage.goto(await serverNewUrl(ownerPage, `/new?template=${SPACE}`));
  await ownerPage.locator(CANVAS).waitFor({ timeout: 30_000 });
  await expect(self(ownerPage)).toHaveCount(1, { timeout: 15_000 });
  // A pad to arrive on and a table above it, nothing in the way: the pad's Receptionist is asked to leave, as his
  // welcome bubble (docs/specs/008-canvas/receptionist.md) would open over the table and take the clicks.
  await seedTab(ownerPage, [
    {
      id: 'pad',
      type: 'shape',
      shape: 'avatar-pad',
      x: 360,
      y: 420,
      width: 96,
      height: 64,
      receptionistLeft: true,
    },
    {
      id: TABLE,
      type: 'shape',
      shape: 'ping-pong-table',
      x: 316,
      y: 200,
      width: 184,
      height: 112,
    },
  ]);
  const id = new URL(ownerPage.url()).pathname.split('/').filter(Boolean).pop()!;
  const headers = await documentHeaders(page.request, owner, id, {
    Origin: new URL(baseURL!).origin,
  });
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'participate' },
  });
  expect(share.ok(), `share: ${share.status()}`).toBe(true);
  const code = ((await share.json()) as { link: { code: string } }).link.code;
  await ownerPage.reload();
  await ownerPage.locator(CANVAS).waitFor();
  await expect(self(ownerPage)).toHaveCount(1, { timeout: 15_000 });

  // The guest joins as a Participant, who plays.
  const guestPage = await personIn(browser, baseURL!, null);
  await guestPage.goto(`/document/shared?s=${code}`);
  await guestPage.getByRole('button', { name: /^join$/i }).click();
  await guestPage.locator(CANVAS).waitFor();
  await expect(self(guestPage)).toHaveCount(1, { timeout: 15_000 });

  await sitAt(ownerPage, 'left');
  await sitAt(guestPage, 'right');
  // Both screens can play: Ready, then the left player serves.
  await expect(board(ownerPage)).toBeVisible({ timeout: 15_000 });
  await expect(board(guestPage)).toBeVisible({ timeout: 15_000 });
  await expect(board(guestPage)).toHaveAttribute('data-pong-score', /^\d+-\d+$/, {
    timeout: 15_000,
  });

  // The owner lets the guest's first serve by, then meets everything; the guest meets nothing.
  await Promise.all([
    play(ownerPage, (score) => score.split('-')[1] !== '0'),
    play(guestPage, () => false),
  ]);

  await expect(board(ownerPage)).toHaveAttribute('data-pong-status', 'won');
  await expect(board(guestPage)).toHaveAttribute('data-pong-status', 'won', { timeout: 10_000 });
  const ownerScore = await board(ownerPage).getAttribute('data-pong-score');
  const guestScore = await board(guestPage).getAttribute('data-pong-score');
  expect(ownerScore).toBe('11-1');
  expect(guestScore).toBe(ownerScore);
  await expect(board(ownerPage)).toHaveText('You Win');
  await expect(board(guestPage)).toHaveText(/ Wins$/);

  await ownerPage.screenshot({ path: test.info().outputPath('owner.png') });
  await guestPage.screenshot({ path: test.info().outputPath('guest.png') });
  await ownerPage.context().close();
  await guestPage.context().close();
});
