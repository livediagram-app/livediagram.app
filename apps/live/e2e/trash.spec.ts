import { test, expect, expectNoPageErrors } from './fixtures';

// The Trash (docs/specs/013-workspace/trash.md), end to end against the real
// build and api worker: a delete confirms with the one quiet line, the
// diagram leaves the lists for Settings › Trash, its share link reads as
// deleted, an open editor is told, and Restore / Delete permanently / Empty
// Trash do what they say.

const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

async function seed(
  page: import('@playwright/test').Page,
  baseURL: string,
  owner: string,
  name: string,
): Promise<string> {
  const id = crypto.randomUUID();
  const res = await page.request.post(`${apiBase}/diagrams`, {
    headers: { 'X-Owner-Id': owner, Origin: new URL(baseURL).origin },
    data: { id, name, tabs: [{ id: crypto.randomUUID(), name: 'Tab 1', elements: [] }] },
  });
  expect(res.ok()).toBe(true);
  return id;
}

async function asOwner(page: import('@playwright/test').Page, owner: string) {
  await page.addInitScript((id) => {
    localStorage.setItem('livediagram:v2:self-id', id);
    localStorage.setItem('livediagram:v2:name-confirmed', '1');
  }, owner);
}

test('delete, find it in Settings › Trash, restore it', async ({ page, baseURL, pageErrors }) => {
  const owner = crypto.randomUUID();
  const id = await seed(page, baseURL!, owner, 'Quarterly plan');
  await asOwner(page, owner);

  await page.goto('/explorer/unsorted');
  await page.getByRole('button', { name: 'Menu for Quarterly plan' }).click();
  await page.getByRole('menu').last().getByText('Delete', { exact: true }).click();
  const confirm = page.getByRole('dialog');
  await expect(confirm).toContainText('It can be restored from Settings › Trash for 30 days.');
  await confirm.getByRole('button', { name: 'Delete diagram' }).click();
  await expect(page.getByRole('button', { name: 'Menu for Quarterly plan' })).toHaveCount(0);

  // The share of lists: gone from the api's list too. The row leaves at once and the delete follows in
  // the background, so the api is asked until it has landed.
  await expect
    .poll(async () => {
      const list = await page.request.get(`${apiBase}/diagrams`, {
        headers: { 'X-Owner-Id': owner },
      });
      return ((await list.json()) as { diagrams: { id: string }[] }).diagrams.map((d) => d.id);
    })
    .not.toContain(id);

  // Settings › Account › Open Trash, the one way in.
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('button', { name: /^Account/ }).click();
  await settings.getByRole('link', { name: 'Open Trash' }).click();
  await expect(page).toHaveURL(/\/explorer\/trash/);
  const group = page.getByRole('region', { name: 'Your diagrams' });
  await expect(group).toContainText('Quarterly plan');
  await expect(group).toContainText('30 days left');

  await group.getByRole('button', { name: 'Restore Quarterly plan' }).click();
  await expect(page.getByText('The Trash is empty')).toBeVisible();
  const back = await page.request.get(`${apiBase}/diagrams/${id}`, {
    headers: { 'X-Owner-Id': owner },
  });
  expect(back.status()).toBe(200);
  expectNoPageErrors(pageErrors);
});

test('a trashed diagram shows the deleted card, with Restore for its owner', async ({
  page,
  browser,
  baseURL,
}) => {
  const owner = crypto.randomUUID();
  const id = await seed(page, baseURL!, owner, 'Architecture');
  const link = await page.request.post(`${apiBase}/diagrams/${id}/share`, {
    headers: { 'X-Owner-Id': owner, Origin: new URL(baseURL!).origin },
    data: { role: 'view' },
  });
  const code = ((await link.json()) as { link: { code: string } }).link.code;
  const del = await page.request.delete(`${apiBase}/diagrams/${id}`, {
    headers: { 'X-Owner-Id': owner, Origin: new URL(baseURL!).origin },
  });
  expect(del.status()).toBe(204);

  // A visitor on the share link: deleted, nothing to restore.
  const visitor = await browser.newPage();
  await visitor.goto(`/diagram/${id}?s=${code}`);
  await expect(visitor.getByRole('heading', { name: 'This diagram was deleted' })).toBeVisible();
  await expect(visitor.getByRole('button', { name: 'Restore' })).toHaveCount(0);

  // The owner opening it: deleted, and Restore brings it back.
  await asOwner(page, owner);
  await page.goto(`/diagram/${id}`);
  await expect(page.getByRole('heading', { name: 'This diagram was deleted' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.getByRole('heading', { name: 'This diagram was deleted' })).toHaveCount(0);
  await expect(page.locator('main, [data-canvas], svg').first()).toBeVisible();

  // And the share link works again.
  await visitor.reload();
  await expect(visitor.getByRole('heading', { name: 'This diagram was deleted' })).toHaveCount(0);
  await visitor.close();
});

test('delete permanently and Empty Trash, each confirmed', async ({ page, baseURL }) => {
  const owner = crypto.randomUUID();
  const headers = { 'X-Owner-Id': owner, Origin: new URL(baseURL!).origin };
  const ids = [
    await seed(page, baseURL!, owner, 'Old sketch'),
    await seed(page, baseURL!, owner, 'Draft A'),
    await seed(page, baseURL!, owner, 'Draft B'),
  ];
  for (const id of ids) await page.request.delete(`${apiBase}/diagrams/${id}`, { headers });
  await asOwner(page, owner);
  await page.goto('/explorer/trash');
  const group = page.getByRole('region', { name: 'Your diagrams' });

  await group.getByRole('button', { name: 'Delete Old sketch permanently' }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).last().click();
  await expect(group).not.toContainText('Old sketch');

  await group.getByRole('button', { name: 'Empty Trash' }).click();
  await expect(page.getByText('Delete 2 diagrams in your Trash for good?')).toBeVisible();
  await page.getByRole('button', { name: 'Empty Trash' }).last().click();
  await expect(page.getByText('The Trash is empty')).toBeVisible();

  const trash = await page.request.get(`${apiBase}/trash`, { headers });
  expect(await trash.json()).toEqual({ trash: [] });
});

test('an editor left open is told when the diagram goes to the Trash', async ({
  page,
  baseURL,
}) => {
  const owner = crypto.randomUUID();
  const headers = { 'X-Owner-Id': owner, Origin: new URL(baseURL!).origin };
  const id = await seed(page, baseURL!, owner, 'Live board');
  // Shared, so the editor joins its realtime room.
  await page.request.post(`${apiBase}/diagrams/${id}/share`, { headers, data: { role: 'edit' } });
  await asOwner(page, owner);
  await page.goto(`/diagram/${id}`);
  await expect(page.getByRole('heading', { name: 'This diagram was deleted' })).toHaveCount(0);
  await page.waitForTimeout(1500);

  // Deleted elsewhere (another device, a teammate, a script).
  const del = await page.request.delete(`${apiBase}/diagrams/${id}`, { headers });
  expect(del.status()).toBe(204);

  await expect(page.getByRole('heading', { name: 'This diagram was deleted' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restore' })).toBeVisible();
});

// Trashed between the editor's load and its join to the realtime room: the room refuses the join rather than
// telling it, so the editor asks the api, which names the reason. The page's WebSockets are held back until
// after the delete, which is the order a slow join produces.
test('an editor whose room join is refused is told too', async ({ page, baseURL }) => {
  const owner = crypto.randomUUID();
  const headers = { 'X-Owner-Id': owner, Origin: new URL(baseURL!).origin };
  const id = await seed(page, baseURL!, owner, 'Slow join');
  await page.request.post(`${apiBase}/diagrams/${id}/share`, { headers, data: { role: 'edit' } });
  await asOwner(page, owner);
  await page.addInitScript(() => {
    const Real = window.WebSocket;
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    (window as unknown as { releaseSockets: () => void }).releaseSockets = release;
    class Held extends EventTarget {
      readyState = 0;
      private socket: WebSocket | null = null;
      private queue: string[] = [];
      constructor(url: string | URL, protocols?: string | string[]) {
        super();
        void gate.then(() => {
          const ws = (this.socket = new Real(url, protocols));
          for (const type of ['open', 'message', 'close', 'error'] as const) {
            ws.addEventListener(type, (e) => {
              this.readyState = ws.readyState;
              const copy =
                type === 'message'
                  ? new MessageEvent('message', { data: (e as MessageEvent).data })
                  : type === 'close'
                    ? new CloseEvent('close', {
                        code: (e as CloseEvent).code,
                        reason: (e as CloseEvent).reason,
                      })
                    : new Event(type);
              this.dispatchEvent(copy);
              if (type === 'open') for (const d of this.queue.splice(0)) ws.send(d);
            });
          }
        });
      }
      send(data: string) {
        if (this.socket?.readyState === 1) this.socket.send(data);
        else this.queue.push(data);
      }
      close(code?: number, reason?: string) {
        this.socket?.close(code, reason);
      }
    }
    Object.assign(Held, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    (window as unknown as { WebSocket: unknown }).WebSocket = Held;
  });
  await page.goto(`/diagram/${id}`);
  await page.locator('[data-canvas-a11y-root]').waitFor();

  const del = await page.request.delete(`${apiBase}/diagrams/${id}`, { headers });
  expect(del.status()).toBe(204);
  await page.evaluate(() => (window as unknown as { releaseSockets: () => void }).releaseSockets());

  await expect(page.getByRole('heading', { name: 'This diagram was deleted' })).toBeVisible();
});
