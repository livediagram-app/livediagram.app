import type { Browser, Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  adoptGuest,
  mintGuest,
  documentHeaders,
  seedDocumentItem,
  test,
} from './fixtures';

// docs/specs/008-canvas/drag-preview.md "Live movement for collaborators": while the owner drags a box,
// a collaborator on an edit link sees it move before anything is saved,
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
];

async function openAs(browser: Browser, baseURL: string, url: string, owner: string | null) {
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(
    ({ o }) => {
      if (o) {
        localStorage.setItem('livehuddle:v2:name-confirmed', '1');
      }
    },
    { o: owner },
  );
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

const box = (page: Page, id: string) => page.locator(`${CANVAS} [data-element-id="${id}"]`).first();
// Where a page draws a box, in canvas px (its left style, plus the offset a move rides and the one its
// layer carries, docs/specs/008-canvas/drag-preview.md "Moves ride an offset", "A very large move rides as
// one layer"): comparable across two browsers whatever each one's pan and zoom.
const leftOf = async (page: Page, id: string) =>
  box(page, id).evaluate((el) => {
    const { left, translate } = (el as HTMLElement).style;
    const plane = el.parentElement?.closest<HTMLElement>('[data-ride-plane]');
    const carried = /translate\(([-\d.e]+)px/.exec(plane?.style.transform ?? '');
    return (
      parseFloat(left || 'NaN') +
      (parseFloat(translate) || 0) +
      (carried ? parseFloat(carried[1]!) : 0)
    );
  });

// The owner's board shared on an edit link, open in the owner's browser and a collaborator's.
async function sharedBoard(
  page: Page,
  browser: Browser,
  baseURL: string,
  elements: readonly unknown[],
) {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const seeded = await seedDocumentItem(page.request, owner, {
    id,
    name: 'Board',
    tabs: [{ id: tabId, name: 'Board', elements }],
  });
  expect(seeded.ok()).toBe(true);
  const headers = await documentHeaders(page.request, owner, id, {
    Origin: new URL(baseURL).origin,
  });
  const share = await page.request.post(`${apiBase}/documents/${id}/share`, {
    headers,
    data: { role: 'edit' },
  });
  const code = ((await share.json()) as { link: { code: string } }).link.code;
  const savedX = async (elementId: string) => {
    const res = await page.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, { headers });
    const tab = ((await res.json()) as { tab: { elements: { id: string; x?: number }[] } }).tab;
    return tab.elements.find((el) => el.id === elementId)?.x;
  };
  const ownerPage = await openAs(browser, baseURL, `/document/${id}`, owner);
  await ownerPage.locator(CANVAS).waitFor();
  const peerPage = await openAs(browser, baseURL, `/document/shared?s=${code}`, null);
  await peerPage.getByRole('button', { name: /^join$/i }).click();
  await peerPage.locator(CANVAS).waitFor();
  await dismissQuickTour(ownerPage);
  await dismissQuickTour(peerPage);
  await expect
    .poll(() => ownerPage.locator('[role="img"][aria-label$="(Online)"]').count())
    .toBeGreaterThanOrEqual(2);
  return { ownerPage, peerPage, savedX };
}

test('a collaborator sees a drag live, and where it lands', async ({ page, browser, baseURL }) => {
  const shared = await sharedBoard(page, browser, baseURL!, BOARD);
  const { ownerPage, peerPage } = shared;
  const savedX = () => shared.savedX('a');
  await expect(box(peerPage, 'a')).toBeVisible();
  expect(await leftOf(peerPage, 'a')).toBe(300);

  await ownerPage.keyboard.press('v');
  const r = (await box(ownerPage, 'a').boundingBox())!;
  await ownerPage.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await ownerPage.mouse.down();
  for (let i = 1; i <= 15; i++)
    await ownerPage.mouse.move(r.x + r.width / 2 + i * 10, r.y + r.height / 2);

  // Mid-drag on the collaborator's screen: moved, nothing saved.
  await expect.poll(() => leftOf(peerPage, 'a'), { timeout: 5_000 }).toBeGreaterThan(360);
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

// docs/specs/008-canvas/drag-preview.md "A very large move goes as one offset": a move of more elements than
// a patch each may carry (DRAG_PREVIEW_MAX_ELEMENTS) shows live too, as one shared offset, and the
// collaborator's layer carries it ("A very large move rides as one layer").
const MANY = Array.from({ length: 250 }, (_, i) => ({
  id: `m${i}`,
  type: 'shape',
  shape: 'square',
  x: 200 + (i % 25) * 140,
  y: 200 + Math.floor(i / 25) * 100,
  width: 100,
  height: 60,
  fillColor: '#ffffff',
}));

test('a collaborator sees a whole-board drag live, as one layer', async ({
  page,
  browser,
  baseURL,
}) => {
  const { ownerPage, peerPage, savedX } = await sharedBoard(page, browser, baseURL!, MANY);
  await expect(box(peerPage, 'm0')).toBeAttached();
  const start = await leftOf(peerPage, 'm0');

  await ownerPage.keyboard.press('v');
  await ownerPage.locator(CANVAS).click({ position: { x: 5, y: 5 } });
  await ownerPage.keyboard.press('ControlOrMeta+a');
  const r = (await box(ownerPage, 'm0').boundingBox())!;
  await ownerPage.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await ownerPage.mouse.down();
  for (let i = 1; i <= 15; i++)
    await ownerPage.mouse.move(r.x + r.width / 2 + i * 10, r.y + r.height / 2);

  await expect.poll(() => leftOf(peerPage, 'm0'), { timeout: 5_000 }).toBeGreaterThan(start + 20);
  // Both layers carry it: the dragger's and the collaborator's.
  for (const p of [ownerPage, peerPage])
    expect(
      await p
        .locator(`${CANVAS} [data-element-plane]`)
        .evaluate((el) => (el as HTMLElement).style.transform),
    ).toMatch(/^translate\(/);
  expect(await savedX('m0')).toBe(200);
  if (SHOTS) await peerPage.screenshot({ path: `${SHOTS}/drag-live-peer-whole-board.png` });

  await ownerPage.mouse.up();
  await expect.poll(() => savedX('m0'), { timeout: 10_000 }).toBeGreaterThan(200);
  const landed = (await savedX('m0'))!;
  // Close to it: the page writes a box's place to six digits.
  await expect.poll(() => leftOf(peerPage, 'm0'), { timeout: 5_000 }).toBeCloseTo(landed, 2);
  expect(
    await peerPage
      .locator(`${CANVAS} [data-element-plane]`)
      .evaluate((el) => (el as HTMLElement).style.transform),
  ).toBe('');
});
