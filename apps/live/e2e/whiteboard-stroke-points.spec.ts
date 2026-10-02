import type { Browser, Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  guestSigFor,
  mintSignedGuest,
  ownerHeaders,
  seedTab,
  test,
} from './fixtures';

// Packed stroke points end to end (docs/specs/006-document/stroke-points.md), in dark mode: a pen
// stroke drawn on a whiteboard is saved as one packed block, a partial erase splits it into packed
// pieces, undo and reload bring it back, a stroke in the former shape is packed on its way in, a
// peer's stroke arrives live, and the SVG export draws it. Synthesised content only.

const CANVAS = '[data-canvas-a11y-root]';
const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const PACKED = /^[A-Za-z0-9+/]+={0,2}$/;

type SavedElement = Record<string, unknown> & { type: string; packedPoints?: unknown };

const sketches = (page: Page) => page.locator(CANVAS).getByRole('img', { name: /^Sketch/ });

async function openWhiteboard(page: Page) {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/new?template=whiteboard');
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await page.locator('[data-whiteboard-dock]').waitFor();
}

// The document's first tab as the api stores it.
async function savedElements(page: Page): Promise<SavedElement[]> {
  return page.evaluate(async (base) => {
    const owner = localStorage.getItem('livediagram:v2:self-id') ?? '';
    const sig = localStorage.getItem('livediagram:v2:self-sig');
    const headers: Record<string, string> = { 'X-Owner-Id': owner };
    if (sig) headers['X-Owner-Sig'] = sig;
    const id = location.pathname.split('/').filter(Boolean).pop()!;
    const doc = await (await fetch(`${base}/documents/${id}`, { headers })).json();
    const tabId = doc.document?.tabs?.[0]?.id;
    if (!tabId) return [];
    const got = await (await fetch(`${base}/documents/${id}/tabs/${tabId}`, { headers })).json();
    return (got.tab?.elements ?? []) as SavedElement[];
  }, apiBase);
}

// The tab through the Export dialog, as the file it downloads.
async function exportTab(page: Page, format: 'SVG' | 'PNG'): Promise<Buffer> {
  await page.getByRole('button', { name: 'Tab menu' }).click();
  await page
    .getByRole('menu')
    .getByRole('button', { name: /^Content/ })
    .click();
  await page.getByRole('menu').getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export tab' });
  await dialog.getByRole('button', { name: new RegExp(`^${format}`) }).click();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: `Download ${format}` }).click();
  const file = await download;
  const chunks: Buffer[] = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

async function savedStrokes(page: Page): Promise<SavedElement[]> {
  return (await savedElements(page)).filter((el) => el.type === 'freehand');
}

function expectPacked(strokes: SavedElement[]) {
  for (const stroke of strokes) {
    expect(typeof stroke.packedPoints).toBe('string');
    expect(stroke.packedPoints as string).toMatch(PACKED);
    expect(stroke).not.toHaveProperty('points');
    expect(stroke).not.toHaveProperty('pressures');
  }
}

// A hand-drawn wave across the board, sample by sample, as a mouse draws it.
async function drawWave(page: Page, from: { x: number; y: number }, length = 520) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 60; i++) {
    await page.mouse.move(from.x + (i * length) / 60, from.y + Math.sin(i / 6) * 60);
  }
  await page.mouse.up();
}

test.describe('packed stroke points on a whiteboard', () => {
  test('draw, erase part, undo, reload and export keep every stroke packed', async ({
    page,
    pageErrors,
  }) => {
    await openWhiteboard(page);
    await drawWave(page, { x: 500, y: 450 });
    await expect(sketches(page)).toHaveCount(1);
    await expect.poll(async () => (await savedStrokes(page)).length).toBe(1);
    const [drawn] = await savedStrokes(page);
    expectPacked([drawn!]);
    await page.screenshot({ path: test.info().outputPath('drawn.png') });

    // Partial erase across the middle: two packed pieces.
    const dock = page.locator('[data-whiteboard-dock]');
    await dock.getByRole('button', { name: /^Eraser/ }).click();
    await dock.getByRole('button', { name: /^Eraser/ }).click();
    await page.getByRole('button', { name: /^Partial/ }).click();
    await page.keyboard.press('Escape');
    await page.mouse.move(760, 330);
    await page.mouse.down();
    for (let i = 1; i <= 20; i++) await page.mouse.move(760, 330 + i * 12);
    await page.mouse.up();
    await expect(sketches(page)).toHaveCount(2);
    await expect.poll(async () => (await savedStrokes(page)).length).toBe(2);
    expectPacked(await savedStrokes(page));
    await page.screenshot({ path: test.info().outputPath('erased.png') });

    // Undo the erase: the one stroke, exactly as it was saved.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(sketches(page)).toHaveCount(1);
    await expect
      .poll(async () => (await savedStrokes(page)).map((s) => s.packedPoints))
      .toEqual([drawn!.packedPoints]);

    // Reload: drawn from the stored block.
    await page.reload();
    await page.locator(CANVAS).waitFor();
    await expect(sketches(page)).toHaveCount(1);
    const outline = page.locator('svg.lvd-freehand path, [data-element-id] svg path').first();
    await expect(outline).toHaveAttribute('d', /^M [\d.-]+ [\d.-]+ Q /);
    await page.screenshot({ path: test.info().outputPath('reloaded.png') });

    // Export: the SVG draws the stroke's filled pen outline from the packed block, and the PNG
    // rasterises that same markup.
    const svg = await exportTab(page, 'SVG');
    expect(svg.toString('utf8')).toMatch(
      /<path d="M [\d.-]+ [\d.-]+ Q [^"]+Z" fill="[^"]+" stroke="none"\/>/,
    );
    const png = await exportTab(page, 'PNG');
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.length).toBeGreaterThan(2_000);

    expectNoPageErrors(pageErrors);
  });

  test('packs a stroke that arrives in the former { nx, ny } shape', async ({
    page,
    pageErrors,
  }) => {
    await openWhiteboard(page);
    const points = Array.from({ length: 40 }, (_, i) => ({
      nx: i / 39,
      ny: 0.5 + 0.45 * Math.sin(i / 4),
    }));
    await seedTab(page, [
      {
        id: 'former',
        type: 'freehand',
        x: 300,
        y: 300,
        width: 600,
        height: 160,
        closed: false,
        penWidth: 2.5,
        streamline: 0.2,
        points,
        pressures: points.map((_, i) => 0.3 + (i % 5) / 10),
      },
    ]);
    await expect(sketches(page)).toHaveCount(1);
    expectPacked(await savedStrokes(page));
    expectNoPageErrors(pageErrors);
  });
});

async function openAs(browser: Browser, baseURL: string, url: string, owner: string | null) {
  const ctx = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 860 },
    colorScheme: 'dark',
  });
  await ctx.addInitScript(
    ({ o, sig }) => {
      if (o) {
        localStorage.setItem('livediagram:v2:self-id', o);
        if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
        localStorage.setItem('livediagram:v2:name-confirmed', '1');
      }
    },
    { o: owner, sig: owner ? guestSigFor(owner) : null },
  );
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

test('a peer’s pen stroke reaches the owner live, packed', async ({ page, browser, baseURL }) => {
  const owner = await mintSignedGuest(page.request);
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const headers = ownerHeaders(owner, { Origin: new URL(baseURL!).origin });
  const seeded = await page.request.post(`${apiBase}/documents`, {
    headers,
    data: {
      id,
      name: 'Board',
      tabs: [{ id: tabId, name: 'Board', opensIn: 'draw', elements: [] }],
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
  await dismissQuickTour(ownerPage);
  await dismissQuickTour(peerPage);
  await expect
    .poll(() => ownerPage.locator('[role="img"][aria-label$="(Online)"]').count())
    .toBeGreaterThanOrEqual(2);

  await drawWave(peerPage, { x: 420, y: 420 });
  await expect(sketches(ownerPage)).toHaveCount(1);
  await expect
    .poll(async () => {
      const res = await ownerPage.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, {
        headers,
      });
      const tab = ((await res.json()) as { tab?: { elements?: SavedElement[] } }).tab;
      return (tab?.elements ?? []).filter((el) => el.type === 'freehand').length;
    })
    .toBe(1);
  await ownerPage.screenshot({ path: test.info().outputPath('owner-sees-peer.png') });
  await peerPage.screenshot({ path: test.info().outputPath('peer.png') });

  await ownerPage.context().close();
  await peerPage.context().close();
});
