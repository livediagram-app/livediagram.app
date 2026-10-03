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
const xOf = async (page: Page, id: string) => (await box(page, id).boundingBox())!.x;

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
  const peerStart = await xOf(peerPage, 'a');
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
  await expect.poll(() => xOf(peerPage, 'a'), { timeout: 5_000 }).toBeGreaterThan(peerStart + 60);
  expect(
    await peerPage.locator(`${CANVAS} svg[data-arrow-svg] path[d]`).first().getAttribute('d'),
  ).not.toBe(peerPath);
  expect(await savedX()).toBe(300);

  await ownerPage.mouse.up();
  await expect.poll(savedX, { timeout: 10_000 }).toBeGreaterThan(300);
  // Landed for the collaborator, where the owner released it, and staying there.
  const ownerFinal = await xOf(ownerPage, 'a');
  await expect.poll(() => xOf(peerPage, 'a'), { timeout: 5_000 }).toBeCloseTo(ownerFinal, 0);
  await peerPage.waitForTimeout(2500);
  expect(await xOf(peerPage, 'a')).toBeCloseTo(ownerFinal, 0);
});
