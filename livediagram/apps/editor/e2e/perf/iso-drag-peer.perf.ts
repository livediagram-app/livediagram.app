import { mkdirSync, writeFileSync } from 'node:fs';
import type { Browser, Page } from '@playwright/test';
import {
  describeReading,
  readMainThreadProbe,
  startMainThreadProbe,
  startProbeTrace,
  throttleCpu,
  type MainThreadReading,
} from '@liveworkspace/e2e-kit/perf/main-thread-probe';
import {
  adoptGuest,
  dismissQuickTour,
  documentHeaders,
  expect,
  mintGuest,
  seedDocumentItem,
  test,
} from '../fixtures';

// The collaborator's side of a whole-board drag (docs/specs/008-canvas/isometric-view.md "A collaborator's
// view of a big drag"): the owner drags every box of an n-element board while a collaborator watches, in
// Isometric or in Flat view, with the collaborator's CPU throttled. Reports the collaborator's longest task
// and longest frame gap from the drag's first move until its preview has drawn and held for a second.
// Reports only; never fails on a number. drag-live.spec.ts holds the 1,200-element case in CI.
// Run with `E2E_PERF=1 pnpm exec playwright test --project=perf iso-drag-peer`.

const OUT = 'test-results/perf';
const CANVAS = '[data-canvas-a11y-root]';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const SIZES = (process.env.ISO_PERF_SIZES ?? '300,600,1200').split(',').map(Number);
const THROTTLE = Number(process.env.ISO_PERF_THROTTLE ?? 4);
const HELD = 'm20';

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

async function openAs(browser: Browser, baseURL: string, url: string, owner: string | null) {
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  });
  if (owner) {
    await adoptGuest(ctx, owner);
    await ctx.addInitScript(() => localStorage.setItem('livediagram:v2:name-confirmed', '1'));
  }
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

async function sharedBoard(page: Page, browser: Browser, baseURL: string, n: number) {
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedDocumentItem(page.request, owner, {
    id,
    name: 'Board',
    tabs: [{ id: crypto.randomUUID(), name: 'Board', elements: gridOf(n) }],
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
  return { ownerPage, peerPage };
}

// Where the collaborator draws the held box, the plane's carried offset included.
const leftOf = (page: Page) =>
  page.locator(`${CANVAS} [data-element-id="${HELD}"]`).evaluate((el) => {
    const plane = el.parentElement?.closest<HTMLElement>('[data-ride-plane]');
    const carried = /translate\(([-\d.e]+)px/.exec(plane?.style.transform ?? '');
    return (
      parseFloat((el as HTMLElement).style.left || 'NaN') +
      (parseFloat((el as HTMLElement).style.translate) || 0) +
      (carried ? parseFloat(carried[1]!) : 0)
    );
  });

const results: Record<string, MainThreadReading> = {};

for (const view of ['isometric', 'flat'] as const) {
  for (const n of SIZES) {
    test(`a collaborator's longest task in ${view} view while ${n} boxes are dragged`, async ({
      page,
      browser,
      baseURL,
    }) => {
      test.setTimeout(240_000);
      const { ownerPage, peerPage } = await sharedBoard(page, browser, baseURL!, n);
      await expect(peerPage.locator(`${CANVAS} [data-element-id="${HELD}"]`)).toBeAttached();
      await peerPage.locator(CANVAS).click({ position: { x: 5, y: 5 } });
      if (view === 'isometric') {
        await peerPage.keyboard.press('i');
        await expect(peerPage.locator(`${CANVAS} [data-iso-column]`).first()).toBeAttached();
      }
      await peerPage.waitForTimeout(1500);
      // ISO_PERF_SHOTS=<dir> keeps what the collaborator sees before the drag, for comparing two builds.
      if (process.env.ISO_PERF_SHOTS)
        await peerPage.screenshot({
          path: `${process.env.ISO_PERF_SHOTS}/iso-peer-${view}-${n}.png`,
        });
      const start = await leftOf(peerPage);
      const cdp = await throttleCpu(peerPage, THROTTLE);

      await ownerPage.keyboard.press('v');
      await ownerPage.locator(CANVAS).click({ position: { x: 5, y: 5 } });
      await ownerPage.keyboard.press('ControlOrMeta+a');
      const r = (await ownerPage.locator(`${CANVAS} [data-element-id="${HELD}"]`).boundingBox())!;
      await ownerPage.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await ownerPage.mouse.down();
      await startMainThreadProbe(peerPage);
      // ISO_PERF_TRACE=1 also keeps a Chromium trace of the collaborator's drag, for naming what the long task is.
      const tracing = process.env.ISO_PERF_TRACE === '1';
      if (tracing)
        await startProbeTrace(browser, peerPage, `${OUT}/iso-drag-peer-${view}-${n}.trace.json`);
      for (let i = 1; i <= 15; i++)
        await ownerPage.mouse.move(r.x + r.width / 2 + i * 10, r.y + r.height / 2);
      await expect.poll(() => leftOf(peerPage), { timeout: 60_000 }).toBeGreaterThan(start + 20);
      await peerPage.waitForTimeout(1000);
      const probe = await readMainThreadProbe(peerPage);
      if (tracing) await browser.stopTracing();
      results[`${view} ${n}`] = probe;
      await ownerPage.mouse.up();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      console.log(describeReading(`${view} ${n}`, THROTTLE, probe));
      mkdirSync(OUT, { recursive: true });
      writeFileSync(`${OUT}/iso-drag-peer.json`, JSON.stringify(results, null, 2));
      await ownerPage.context().close();
      await peerPage.context().close();
    });
  }
}

// ISO_PERF_SHOTS=<dir>: a small board of every kind of column (rectangles, rounded and curved outlines, clipped
// silhouettes, a sticky, close neighbours whose columns overlap), shot in Isometric at the default angle and an
// orbited one, for comparing how two builds draw the side faces.
const KINDS = ['square', 'rounded', 'circle', 'diamond', 'cylinder', 'hexagon', 'stadium', 'star'];
const COLOURS = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
];
test('the side faces of every kind of column, for a look', async ({ page, browser, baseURL }) => {
  const dir = process.env.ISO_PERF_SHOTS;
  test.skip(!dir, 'ISO_PERF_SHOTS names where the shots go');
  const elements = [
    ...KINDS.map((shape, i) => ({
      id: `k${i}`,
      type: 'shape',
      shape,
      x: 200 + (i % 4) * 170,
      y: 200 + Math.floor(i / 4) * 150,
      width: 110,
      height: 80,
      fillColor: '#ffffff',
      strokeColor: COLOURS[i],
    })),
    { id: 'n1', type: 'sticky', x: 900, y: 200, width: 120, height: 120, text: 'Note' },
    // Close neighbours: their columns overlap, so the nearer one must cover the one behind.
    ...[0, 1, 2].map((i) => ({
      id: `c${i}`,
      type: 'shape',
      shape: 'square',
      x: 900 + i * 40,
      y: 380 + i * 40,
      width: 90,
      height: 60,
      fillColor: '#ffffff',
      strokeColor: COLOURS[i + 3],
    })),
  ];
  const owner = await mintGuest(page.request);
  const id = crypto.randomUUID();
  const seeded = await seedDocumentItem(page.request, owner, {
    id,
    name: 'Board',
    tabs: [{ id: crypto.randomUUID(), name: 'Board', elements }],
  });
  expect(seeded.ok()).toBe(true);
  const p = await openAs(browser, baseURL!, `/document/${id}`, owner);
  await p.locator(CANVAS).waitFor();
  await dismissQuickTour(p);
  await p.locator(CANVAS).click({ position: { x: 5, y: 5 } });
  await p.keyboard.press('i');
  await expect(p.locator(`${CANVAS} [data-iso-column]`).first()).toBeAttached();
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${dir}/iso-kinds-default.png` });
  // Orbit: Shift-drag on the canvas spins and tilts the camera.
  await p.keyboard.down('Shift');
  await p.mouse.move(700, 450);
  await p.mouse.down();
  await p.mouse.move(820, 400, { steps: 8 });
  await p.mouse.up();
  await p.keyboard.up('Shift');
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${dir}/iso-kinds-orbited.png` });
  await p.context().close();
});
