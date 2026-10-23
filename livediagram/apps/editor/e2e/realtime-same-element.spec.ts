import type { Browser, Page } from '@playwright/test';
import { dismissQuickTour, expect, test, guestTokenFor, mintGuest, ownerHeaders } from './fixtures';

// Two people dragging ONE element at the same moment (docs/specs/012-collaboration/realtime-conflict-resolution.md
// "Same-element edits converge"): the room orders the two moves, and both screens end on the later one. Each used
// to end on the other person's move, and stay there until a reload.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

async function openAs(browser: Browser, baseURL: string, url: string, owner: string | null) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  await ctx.addInitScript(
    ({ o, token }) => {
      if (o) {
        if (token) localStorage.setItem('livediagram:v2:guest-token', token);
        localStorage.setItem('livediagram:v2:name-confirmed', '1');
      }
    },
    { o: owner, token: owner ? guestTokenFor(owner) : null },
  );
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

// Where `id` sits, relative to the element that nobody moves, in that element's widths (zoom-proof).
async function offset(page: Page, id: string): Promise<[number, number]> {
  const box = async (el: string) =>
    (await page.locator(`${CANVAS} [data-element-id="${el}"]`).first().boundingBox())!;
  const [moved, still] = [await box(id), await box('still')];
  return [(moved.x - still.x) / still.width, (moved.y - still.y) / still.width];
}

async function drag(page: Page, id: string, dx: number) {
  const box = (await page.locator(`${CANVAS} [data-element-id="${id}"]`).first().boundingBox())!;
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 3 });
  await page.mouse.move(x + dx, y, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
}

test('two peers dragging the same element at once end on the same position', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin });
  const square = (elId: string, x: number) => ({
    id: elId,
    type: 'shape',
    shape: 'square',
    x,
    y: 200,
    width: 160,
    height: 100,
  });
  const seeded = await page.request.post(`${apiBase}/documents`, {
    headers,
    data: {
      id,
      name: 'Room',
      tabs: [
        {
          id: crypto.randomUUID(),
          name: 'Board',
          elements: [square('a', 500), square('still', 1000)],
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

  const ownerPage = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await ownerPage.locator(CANVAS).waitFor();
  const peerPage = await openAs(browser, baseURL!, `/document/shared?s=${code}`, null);
  await peerPage.getByRole('button', { name: /^join$/i }).click();
  await peerPage.locator(CANVAS).waitFor();
  for (const p of [ownerPage, peerPage]) {
    await dismissQuickTour(p);
    await p.keyboard.press('v');
  }

  // Three rounds: each one a fresh race for the room's order.
  for (let round = 0; round < 3; round++) {
    await Promise.all([drag(ownerPage, 'a', 120), drag(peerPage, 'a', -120)]);
    // Both screens agree, to within a rounding of one tenth of the element's width (the zooms differ).
    await expect
      .poll(
        async () => {
          const [mine, theirs] = [await offset(ownerPage, 'a'), await offset(peerPage, 'a')];
          return Math.max(Math.abs(mine[0] - theirs[0]), Math.abs(mine[1] - theirs[1]));
        },
        { timeout: 10_000 },
      )
      .toBeLessThan(0.15);
  }

  await ownerPage.context().close();
  await peerPage.context().close();
});
