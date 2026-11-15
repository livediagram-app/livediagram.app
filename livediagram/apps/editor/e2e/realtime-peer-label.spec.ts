import type { Browser, Page } from '@playwright/test';
import {
  adoptGuest,
  documentHeaders,
  expect,
  mintGuest,
  paletteTile,
  seedDocumentItem,
  test,
} from './fixtures';
import type { StoredTab } from './stored';

// Work Tracker 659: a peer's label typed just after the owner adds and moves that box must stay
// (docs/specs/007-editor/editor-app.md "Held until the holder's change lands"). The owner adds a square, moves it and
// lets go of it; the peer opens it and types. The owner's save of the move (the autosave's delay, the tab write, then
// the room ordering its element ops) used to reach the room after the peer's label, and its whole-element write
// replaced the label on both screens and in storage: 2 of 2 runs lost it with the peer typing 400 ms after the owner
// let go, none at 0, 150 or 1200 ms. Now the owner holds the square until the move has landed, so the peer's label is
// the later write.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const CANVAS = '[data-canvas-a11y-root]';
// The gaps (ms) between the owner letting go and the peer's first try: at once, inside the owner's autosave delay
// (600 ms), across its save, and after it.
const WINDOWS = (process.env.E2E_PEER_LABEL_WINDOWS ?? '0,150,400,1200').split(',').map(Number);

async function openAs(browser: Browser, baseURL: string, url: string, owner: string | null) {
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1440, height: 860 } });
  if (owner) await adoptGuest(ctx, owner);
  await ctx.addInitScript(
    ({ o }) => {
      if (o) localStorage.setItem('livediagram:v2:name-confirmed', '1');
      localStorage.setItem(
        'livediagram:user-preferences:v1',
        JSON.stringify({ workshopTourSeen: true }),
      );
    },
    { o: owner },
  );
  const page = await ctx.newPage();
  await page.goto(url);
  return page;
}

const elementIds = (page: Page) =>
  page
    .locator(`${CANVAS} [data-element-id]`)
    .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-element-id')!))]);

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
  test(`a peer's label typed ${gap} ms after the owner adds and moves the box is kept`, async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    const owner = await mintGuest(page.request);
    const id = crypto.randomUUID();
    const tabId = crypto.randomUUID();
    const seeded = await seedDocumentItem(page.request, owner, {
      id,
      name: 'Room',
      tabs: [
        {
          id: tabId,
          name: 'Board',
          elements: [
            { id: 'still', type: 'shape', shape: 'circle', x: 1100, y: 80, width: 80, height: 80 },
          ],
        },
      ],
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
    await expect.poll(() => a.locator('[role="img"][aria-label$="(Online)"]').count()).toBe(2);

    // 1-2. The owner drags a square in and lets it go; the peer adds one too.
    const before = new Set(await elementIds(a));
    await (
      await paletteTile(a, 'Add Square')
    ).dragTo(a.locator(CANVAS), { targetPosition: { x: 500, y: 300 } });
    await a.keyboard.press('Escape');
    await expect.poll(async () => (await elementIds(a)).length).toBe(before.size + 1);
    const box = (await elementIds(a)).find((el) => !before.has(el))!;
    await (
      await paletteTile(b, 'Add Square')
    ).dragTo(b.locator(CANVAS), { targetPosition: { x: 900, y: 600 } });
    await b.keyboard.press('Escape');
    await expect.poll(async () => (await elementIds(a)).length).toBe(before.size + 2);

    // 3. The owner, on the Select tool with nothing selected, drags its square 150 px down. (A selected square would
    // take the `v` as the first letter of its label.)
    await a.keyboard.press('Escape');
    await a.locator(CANVAS).click({ position: { x: 60, y: 700 } });
    await a.keyboard.press('v');
    const start = (await elementOf(a, box).boundingBox())!;
    const [x, y] = [start.x + start.width / 2, start.y + start.height / 2];
    await a.mouse.move(x, y);
    await a.mouse.down();
    await a.mouse.move(x, y + 75, { steps: 4 });
    await a.mouse.move(x, y + 150, { steps: 4 });
    await a.mouse.up();

    // 4. Once both screens agree, the peer double-clicks the owner's square, types and presses Escape.
    await expect
      .poll(
        async () => {
          const [mine, theirs] = [await offset(a, box), await offset(b, box)];
          return Math.max(Math.abs(mine[0] - theirs[0]), Math.abs(mine[1] - theirs[1]));
        },
        { timeout: 10_000 },
      )
      .toBeLessThan(0.15);
    // The owner still holds the square selected: the peer's double-click opens no editor.
    const editor = b.locator(`${CANVAS} [contenteditable="true"]`);
    await elementOf(b, box).dblclick();
    await expect(editor).toHaveCount(0);
    // The owner lets go while its save of the move may still be on its way; `gap` later the peer tries to open the
    // square, again and again until the lock lets it (once the owner's move has landed), and types.
    await a.keyboard.press('Escape');
    if (gap > 0) await b.waitForTimeout(gap);
    await expect
      .poll(
        async () => {
          await elementOf(b, box).dblclick();
          return editor.count();
        },
        { timeout: 15_000, intervals: [50] },
      )
      .toBe(1);
    await b.keyboard.type('Peer text');
    await b.keyboard.press('Escape');

    // 5. The label stays on both screens past the owner's autosave, in storage, and after a reload.
    for (const p of [a, b]) {
      await expect(elementOf(p, box)).toContainText('Peer text', { timeout: 10_000 });
    }
    await a.waitForTimeout(3_000);
    for (const p of [a, b]) await expect(elementOf(p, box)).toContainText('Peer text');
    await expect
      .poll(
        async () => {
          const res = await page.request.get(`${apiBase}/documents/${id}/tabs/${tabId}`, {
            headers,
          });
          const tab = ((await res.json()) as StoredTab<{ id: string; label?: string }>).tab;
          return tab?.elements?.find((el) => el.id === box)?.label;
        },
        { timeout: 10_000 },
      )
      .toBe('Peer text');
    await a.reload();
    await a.locator(CANVAS).waitFor();
    await expect(elementOf(a, box)).toContainText('Peer text');

    await a.context().close();
    await b.context().close();
  });
}
