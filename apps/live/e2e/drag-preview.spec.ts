import type { Page } from '@playwright/test';
import {
  dismissQuickTour,
  expect,
  expectNoPageErrors,
  seedTab,
  test,
  pageOwnerHeaders,
} from './fixtures';

// docs/specs/008-canvas/drag-preview.md: while a drag lasts, the moved box and the arrow pinned to it
// move on screen while nothing is written; the document changes once, on release; Escape puts the box
// back; one undo takes the drag back. Dark mode; synthesised board.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';

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

async function savedX(page: Page, id: string): Promise<number | undefined> {
  const headers = await pageOwnerHeaders(page);
  return page.evaluate(
    async ({ base, id, headers }) => {
      const docId = location.pathname.split('/').filter(Boolean).pop()!;
      const doc = await (await fetch(`${base}/documents/${docId}`, { headers })).json();
      const tabId = doc.document?.tabs?.[0]?.id;
      const got = await (
        await fetch(`${base}/documents/${docId}/tabs/${tabId}`, { headers })
      ).json();
      return (got.tab?.elements ?? []).find((el: { id: string }) => el.id === id)?.x;
    },
    { base: apiBase, id, headers },
  );
}

const box = (page: Page, id: string) => page.locator(`${CANVAS} [data-element-id="${id}"]`).first();
const arrowPath = (page: Page) =>
  page.locator(`${CANVAS} svg[data-arrow-svg] path[d]`).first().getAttribute('d');

async function openBoard(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/new?blank=1');
  await page.locator(CANVAS).waitFor({ timeout: 30_000 });
  await dismissQuickTour(page);
  await seedTab(page, BOARD);
  await page.keyboard.press('v');
  await expect(box(page, 'a')).toBeVisible();
  // Let the seeded board's own save settle before measuring what a drag writes.
  await page.waitForTimeout(1200);
}

async function grab(page: Page) {
  const r = (await box(page, 'a').boundingBox())!;
  const start = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(start.x + i * 10, start.y);
  return { start, before: r };
}

test.describe('drag preview', () => {
  test('moves the box and its arrow on screen while writing nothing, then writes once on release', async ({
    page,
    pageErrors,
  }) => {
    await openBoard(page);
    const pathBefore = await arrowPath(page);
    const { before } = await grab(page);

    // Mid-drag: drawn where the pointer is, the arrow follows, nothing saved (past the autosave's wait).
    const mid = (await box(page, 'a').boundingBox())!;
    expect(mid.x).toBeGreaterThan(before.x + 60);
    expect(await arrowPath(page)).not.toBe(pathBefore);
    await page.waitForTimeout(1500);
    expect(await savedX(page, 'a')).toBe(300);

    await page.mouse.up();
    await expect.poll(() => savedX(page, 'a'), { timeout: 10_000 }).toBeGreaterThan(300);
    expectNoPageErrors(pageErrors);
  });

  test('puts the box back and writes nothing when Escape cancels', async ({ page, pageErrors }) => {
    await openBoard(page);
    const { before } = await grab(page);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect.poll(async () => (await box(page, 'a').boundingBox())!.x).toBeCloseTo(before.x, 0);
    await page.waitForTimeout(1500);
    expect(await savedX(page, 'a')).toBe(300);
    expectNoPageErrors(pageErrors);
  });

  test('takes the whole drag back with one undo', async ({ page, pageErrors }) => {
    await openBoard(page);
    const { before } = await grab(page);
    await page.mouse.up();
    await expect
      .poll(async () => (await box(page, 'a').boundingBox())!.x)
      .toBeGreaterThan(before.x + 60);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => (await box(page, 'a').boundingBox())!.x).toBeCloseTo(before.x, 0);
    expectNoPageErrors(pageErrors);
  });
});
