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
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(
    ({ o }) => {
      if (o) {
        localStorage.setItem('livediagram:v2:name-confirmed', '1');
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

// docs/specs/008-canvas/drag-preview.md "An element's isometric side faces ride with it": a collaborator viewing in
// Isometric sees each box's raised side faces move with its top mid-drag, for a drag of a few dozen boxes (each rides
// its own offset) and a whole-board one past RIDE_PLANE_MIN_NODES (200), where the layers carry one offset. The large
// case stays at 300: under Isometric, Chromium's compositing of a moving 3D scene grows faster than linearly with the
// board (measured on a dev build at 4x CPU throttle, a peer's first drag frame took 0.1 s at 300 boxes, 0.9 s at 600 and 5.7 s at
// 1,200, the same with or without the side faces riding), so 1,200 outran the poll on CI without telling us anything
// about the side faces. IsometricDepthLayer.ride.test.tsx covers the 1,200-element ride.
const gridOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    type: 'shape',
    shape: 'square',
    x: 200 + (i % 40) * 140,
    y: 200 + Math.floor(i / 40) * 100,
    width: 100,
    height: 60,
    fillColor: '#ffffff',
  }));

// Where a page draws a box's top and its side faces, in canvas px, read in one go so both come from the same frame.
const topAndSides = (page: Page, id: string) =>
  page.locator(CANVAS).evaluate((root, id) => {
    const at = (el: HTMLElement | null) => {
      if (!el) return NaN;
      const plane = el.parentElement?.closest<HTMLElement>('[data-ride-plane]');
      const carried = /translate\(([-\d.e]+)px/.exec(plane?.style.transform ?? '');
      return (
        parseFloat(el.style.left || 'NaN') +
        (parseFloat(el.style.translate) || 0) +
        (carried ? parseFloat(carried[1]!) : 0)
      );
    };
    return {
      top: at(root.querySelector<HTMLElement>(`[data-element-id="${id}"]`)),
      sides: at(root.querySelector<HTMLElement>(`[data-iso-column][data-ride-id="${id}"]`)),
    };
  }, id);

// The box the owner presses and the collaborator watches: the middle of the first row. Selecting everything opens
// the Quick Style panel on the left, which covers the first boxes of a board this wide.
const HELD = 'm20';

for (const n of [62, 300]) {
  test(`a collaborator in Isometric sees side faces move with their tops in a ${n}-element drag`, async ({
    page,
    browser,
    baseURL,
  }) => {
    test.slow();
    const { ownerPage, peerPage, savedX } = await sharedBoard(page, browser, baseURL!, gridOf(n));
    await expect(box(peerPage, HELD)).toBeAttached();
    await peerPage.locator(CANVAS).click({ position: { x: 5, y: 5 } });
    await peerPage.keyboard.press('i');
    await expect(peerPage.locator(`${CANVAS} [data-iso-column]`).first()).toBeAttached();
    const start = await topAndSides(peerPage, HELD);
    expect(start.sides).toBe(start.top);

    await ownerPage.keyboard.press('v');
    await ownerPage.locator(CANVAS).click({ position: { x: 5, y: 5 } });
    await ownerPage.keyboard.press('ControlOrMeta+a');
    const r = (await box(ownerPage, HELD).boundingBox())!;
    await ownerPage.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await ownerPage.mouse.down();
    for (let i = 1; i <= 15; i++)
      await ownerPage.mouse.move(r.x + r.width / 2 + i * 10, r.y + r.height / 2);

    await expect
      .poll(async () => (await topAndSides(peerPage, HELD)).top, { timeout: 5_000 })
      .toBeGreaterThan(start.top + 20);
    const mid = await topAndSides(peerPage, HELD);
    expect(mid.sides).toBeCloseTo(mid.top, 2);
    if (SHOTS) await peerPage.screenshot({ path: `${SHOTS}/drag-live-peer-isometric-${n}.png` });

    await ownerPage.mouse.up();
    // Together once it lands too, the preview handing over to the saved board.
    await expect.poll(() => savedX(HELD), { timeout: 10_000 }).toBeGreaterThan(start.top);
    const saved = (await savedX(HELD))!;
    await expect
      .poll(async () => (await topAndSides(peerPage, HELD)).top, { timeout: 5_000 })
      .toBeCloseTo(saved, 2);
    const landed = await topAndSides(peerPage, HELD);
    expect(landed.sides).toBeCloseTo(landed.top, 2);
  });
}
