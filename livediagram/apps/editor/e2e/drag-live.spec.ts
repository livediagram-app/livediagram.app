import type { Browser, Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  test,
} from './fixtures';

// docs/specs/008-canvas/drag-preview.md "Live movement for collaborators": while the owner drags a box,
// a collaborator on an edit link sees it move (and the arrow on it follow) before anything is saved,
// and sees it land where it was released. Dark mode; synthesised board.

const CANVAS = '[data-canvas-a11y-root]';
// Set to keep what the collaborator sees mid-drag and after it, for a review.
const SHOTS = process.env.E2E_SHOTS_DIR;
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

const BOARD = [
  {
    id: 'a',
    type: 'shape',
    shape: 'square',
    x: 300,
    y: 300,
    width: 120,
    height: 80,
    fillColor: '#ffffff',
  },
  {
    id: 'b',
    type: 'shape',
    shape: 'square',
    x: 800,
    y: 300,
    width: 120,
    height: 80,
    fillColor: '#ffffff',
  },
  {
    id: 'ab',
    type: 'arrow',
    from: { kind: 'pinned', elementId: 'a', anchor: 'e' },
    to: { kind: 'pinned', elementId: 'b', anchor: 'w' },
  },
];

async function openAs(browser: Browser, baseURL: string, url: string, owner: string | null) {
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  await ctx.addInitScript(
    ({ o, sig }) => {
      if (o) {
        localStorage.setItem('livediagram:v2:name-confirmed', '1');
        localStorage.setItem('livediagram:v2:self-id', o);
        if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
      }
    },
    { o: owner, sig: owner ? guestSigFor(owner) : null },
  );
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

const box = (page: Page, id: string) => page.locator(`${CANVAS} [data-element-id="${id}"]`).first();
// Where a page draws a box, in canvas px (its left style): comparable across two browsers whatever
// each one's pan and zoom.
const leftOf = async (page: Page, id: string) =>
  parseFloat((await box(page, id).evaluate((el) => (el as HTMLElement).style.left)) || 'NaN');

test('a collaborator sees a drag live, and where it lands', async ({ page, browser, baseURL }) => {
  const owner = await mintSignedGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin });
  const seeded = await page.request.post(`${apiBase}/documents`, {
    headers,
    data: { id, name: 'Board', tabs: [{ id: tabId, name: 'Board', elements: BOARD }] },
  });
  expect(seeded.ok()).toBe(true);
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'edit' },
  });
  const code = ((await share.json()) as { link: { code: string } }).link.code;
  const savedX = async () => {
    const res = await page.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, { headers });
    const tab = ((await res.json()) as { tab: { elements: { id: string; x?: number }[] } }).tab;
    return tab.elements.find((el) => el.id === 'a')?.x;
  };

  const ownerPage = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await ownerPage.locator(CANVAS).waitFor();
  const peerPage = await openAs(browser, baseURL!, `/document/shared?s=${code}`, null);
  await peerPage.getByRole('button', { name: /^join$/i }).click();
  await peerPage.locator(CANVAS).waitFor();
  await dismissQuickTour(ownerPage);
  await dismissQuickTour(peerPage);
  await expect
    .poll(() => ownerPage.locator('[role="img"][aria-label$="(Online)"]').count())
    .toBeGreaterThanOrEqual(2);
  await expect(box(peerPage, 'a')).toBeVisible();
  expect(await leftOf(peerPage, 'a')).toBe(300);
  const peerPath = await peerPage
    .locator(`${CANVAS} svg[data-arrow-svg] path[d]`)
    .first()
    .getAttribute('d');

  await ownerPage.keyboard.press('v');
  const r = (await box(ownerPage, 'a').boundingBox())!;
  await ownerPage.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await ownerPage.mouse.down();
  for (let i = 1; i <= 15; i++)
    await ownerPage.mouse.move(r.x + r.width / 2 + i * 10, r.y + r.height / 2);

  // Mid-drag on the collaborator's screen: moved, arrow following, nothing saved.
  await expect.poll(() => leftOf(peerPage, 'a'), { timeout: 5_000 }).toBeGreaterThan(360);
  expect(
    await peerPage.locator(`${CANVAS} svg[data-arrow-svg] path[d]`).first().getAttribute('d'),
  ).not.toBe(peerPath);
  expect(await savedX()).toBe(300);
  if (SHOTS) {
    await peerPage.screenshot({ path: `${SHOTS}/drag-live-peer-mid.png` });
    await ownerPage.screenshot({ path: `${SHOTS}/drag-live-owner-mid.png` });
  }

  const lastSeen = await leftOf(peerPage, 'a');
  await ownerPage.mouse.up();
  // From the release until the save lands, the collaborator keeps the box where the drag left it: it
  // never jumps back to where it started.
  const seen: number[] = [];
  const watch = setInterval(() => void leftOf(peerPage, 'a').then((x) => seen.push(x)), 50);
  await expect.poll(savedX, { timeout: 10_000 }).toBeGreaterThan(300);
  const landed = (await savedX())!;
  await expect.poll(() => leftOf(peerPage, 'a'), { timeout: 5_000 }).toBe(landed);
  clearInterval(watch);
  expect(seen.filter((x) => x < lastSeen - 1)).toEqual([]);
  // And it stays there.
  await peerPage.waitForTimeout(2500);
  expect(await leftOf(peerPage, 'a')).toBe(landed);
});
