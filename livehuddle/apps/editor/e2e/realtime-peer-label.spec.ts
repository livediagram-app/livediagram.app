import type { Browser, Page } from '@playwright/test';
import {
  adoptGuest,
  dismissQuickTour,
  expect,
  documentHeaders,
  mintGuest,
  seedDocumentItem,
  test,
} from './fixtures';
import type { StoredTab } from './stored';

// Work Tracker 862: a peer's label typed just after the owner moves a box must stay
// (docs/specs/007-editor/editor-app.md "Held until the holder's change lands", as livediagram's own
// realtime-peer-label.spec.ts since Work Tracker 659). The owner moves a sticky and lets go of it; the peer opens it
// and types. Without the hold the owner's lock ended at once while its save of the move (the autosave's delay, the tab
// write, then the room ordering its element ops) was still on its way, so that save reached the room after the peer's
// label and its whole-element write replaced the label on both screens and in storage. Now the owner holds the sticky
// until the move has landed, so the peer's label is the later write.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';
// The gaps (ms) between the owner letting go and the peer's first try: at once, inside the owner's autosave delay,
// across its save, and after it.
const WINDOWS = (process.env.E2E_PEER_LABEL_WINDOWS ?? '0,150,400,1200').split(',').map(Number);

async function openAs(browser: Browser, baseURL: string, url: string, owner: string | null) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  if (owner) {
    await adoptGuest(ctx, owner);
    await ctx.addInitScript(() => localStorage.setItem('livehuddle:v2:name-confirmed', '1'));
  }
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

const elementOf = (page: Page, id: string) =>
  page.locator(`${CANVAS} [data-element-id="${id}"]`).first();

// Where `id` sits relative to the element nobody moves, in that element's widths (zoom-proof).
async function offset(page: Page, id: string): Promise<[number, number]> {
  const [moved, still] = [
    (await elementOf(page, id).boundingBox())!,
    (await elementOf(page, 'still').boundingBox())!,
  ];
  return [(moved.x - still.x) / still.width, (moved.y - still.y) / still.width];
}

for (const gap of WINDOWS) {
  test(`a peer's label typed ${gap} ms after the owner moves the box is kept`, async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const owner = await mintGuest(page.request);
    const id = crypto.randomUUID();
    const tabId = crypto.randomUUID();
    // livehuddle's boards hold stickies (it keeps no diagram shapes).
    const sticky = (elId: string, x: number) => ({
      id: elId,
      type: 'sticky',
      x,
      y: 200,
      width: 160,
      height: 100,
    });
    const seeded = await seedDocumentItem(page.request, owner, {
      id,
      name: 'Room',
      tabs: [{ id: tabId, name: 'Board', elements: [sticky('box', 500), sticky('still', 1000)] }],
    });
    expect(seeded.ok()).toBe(true);
    const headers = await documentHeaders(page.request, owner, id, {
      Origin: new URL(baseURL!).origin,
    });
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
    for (const p of [a, b]) {
      await dismissQuickTour(p);
      await p.keyboard.press('Escape');
      await p.keyboard.press('v');
    }

    // 1. The owner drags the sticky 150 px down; it stays selected on the owner's screen.
    const start = (await elementOf(a, 'box').boundingBox())!;
    const [x, y] = [start.x + start.width / 2, start.y + start.height / 2];
    await a.mouse.move(x, y);
    await a.mouse.down();
    await a.mouse.move(x, y + 75, { steps: 4 });
    await a.mouse.move(x, y + 150, { steps: 4 });
    await a.mouse.up();

    // 2. Once both screens agree, the owner's selection holds the sticky: the peer's double-click opens no editor.
    await expect
      .poll(
        async () => {
          const [mine, theirs] = [await offset(a, 'box'), await offset(b, 'box')];
          return Math.max(Math.abs(mine[0] - theirs[0]), Math.abs(mine[1] - theirs[1]));
        },
        { timeout: 10_000 },
      )
      .toBeLessThan(0.15);
    const editor = b.locator(`${CANVAS} [contenteditable="true"]`);
    await elementOf(b, 'box').dblclick();
    await expect(editor).toHaveCount(0);

    // 3. The owner lets go while its save of the move may still be on its way; `gap` later the peer tries to open the
    // sticky, again and again until the lock lets it (once the owner's move has landed), and types.
    await a.keyboard.press('Escape');
    if (gap > 0) await b.waitForTimeout(gap);
    await expect
      .poll(
        async () => {
          await elementOf(b, 'box').dblclick();
          return editor.count();
        },
        { timeout: 15_000, intervals: [50] },
      )
      .toBe(1);
    await b.keyboard.type('Peer text');
    await b.keyboard.press('Escape');

    // 4. The label stays on both screens past the owner's autosave, in storage, and after a reload.
    for (const p of [a, b]) {
      await expect(elementOf(p, 'box')).toContainText('Peer text', { timeout: 10_000 });
    }
    await a.waitForTimeout(3_000);
    for (const p of [a, b]) await expect(elementOf(p, 'box')).toContainText('Peer text');
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, {
            headers,
          });
          const tab = ((await res.json()) as StoredTab<{ id: string; label?: string }>).tab;
          return tab?.elements?.find((el) => el.id === 'box')?.label;
        },
        { timeout: 10_000 },
      )
      .toBe('Peer text');
    await a.reload();
    await a.locator(CANVAS).waitFor();
    await expect(elementOf(a, 'box')).toContainText('Peer text');

    await a.context().close();
    await b.context().close();
  });
}
