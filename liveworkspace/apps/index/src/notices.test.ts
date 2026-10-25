// What the index tells an item's app for its emails (notices.ts): a share link made, a person's first
// time in through a link (by the share route or an open), and a person's count of items made.
import type { ShareLink } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness();

const notices = () =>
  h.appCalls
    .filter((c) => c.url.endsWith('/notices'))
    .map((c) => ({ url: c.url, body: c.body, key: c.headers.get('Authorization') }));

async function share(auth: string, itemId: string, level = 'edit') {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: { level } });
  expect(res.status).toBe(201);
  return (await body<{ link: ShareLink }>(res)).link;
}

describe('notices', () => {
  it('tells the app each share link made, with who made it', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await share(ada.auth, item.id);
    await settle();
    expect(notices()).toEqual([
      {
        url: `https://liveplanner.app/api/internal/items/${item.id}/notices`,
        body: { type: 'shared', actorId: 'user_a' },
        key: 'Bearer lp-key',
      },
    ]);
  });

  it("tells the app a person's first time in through a link, once, by either door", async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const cy = await person('user_c');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, 'view');
    await settle();
    h.appCalls = [];

    // Bob resolves the code, then opens: one notice.
    expect((await call(`/share/${link.code}`, { auth: bob.auth })).status).toBe(200);
    expect(
      (
        await call(`/items/${item.id}/open`, {
          method: 'POST',
          auth: bob.auth,
          headers: { 'X-Share-Code': link.code },
        })
      ).status,
    ).toBe(204);
    expect((await call(`/share/${link.code}`, { auth: bob.auth })).status).toBe(200);
    // Cy opens by the plan's address, never resolving the code: one notice too.
    await call(`/items/${item.id}/open`, {
      method: 'POST',
      auth: cy.auth,
      headers: { 'X-Share-Code': link.code },
    });
    // The owner and someone with no identity are no one joining.
    await call(`/share/${link.code}`, { auth: ada.auth });
    await call(`/share/${link.code}`);
    await settle();
    expect(notices().map((n) => n.body)).toEqual([
      { type: 'joined', personId: 'user_b', level: 'view' },
      { type: 'joined', personId: 'user_c', level: 'view' },
    ]);
  });

  it('never fails the request when the app is down', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    h.appAnswer = () => new Response(null, { status: 503 });
    await share(ada.auth, item.id);
    await settle();
    expect(notices()).toHaveLength(1);
  });
});

describe('a person’s count of items made', () => {
  const count = (personId: string, query = '', app = 'liveplanner', key = 'lp-key') =>
    call(`/app/people/${personId}/count${query}`, { auth: key, headers: { 'X-Index-App': app } });

  it("counts the calling app's items, the Trash's too, up to the limit", async () => {
    const ada = await person('user_a');
    for (let i = 0; i < 4; i++) await makeItem(ada.auth);
    const trashed = await makeItem(ada.auth);
    await call(`/items/${trashed.id}`, { method: 'DELETE', auth: ada.auth });
    await makeItem(ada.auth, { app: 'livediagram', kind: 'canvas' });
    expect(await body(await count('user_a'))).toEqual({ count: 5 });
    expect(await body(await count('user_a', '?limit=3'))).toEqual({ count: 3 });
    expect(await body(await count('user_a', '', 'livediagram', 'ld-key'))).toEqual({ count: 1 });
    expect(await body(await count('user_nobody'))).toEqual({ count: 0 });
  });

  it('refuses a bad limit and a caller without the key', async () => {
    const ada = await person('user_a');
    expect((await count('user_a', '?limit=0')).status).toBe(400);
    expect((await count('user_a', '?limit=1001')).status).toBe(400);
    expect((await count('user_a', '', 'liveplanner', 'wrong')).status).toBe(401);
    expect((await call('/app/people/user_a/count', { auth: ada.auth })).status).toBe(401);
  });

  it('stays cheap for someone with thousands of items', async () => {
    const now = Date.now();
    const insert = h.db.sql.prepare(
      `INSERT INTO items (id, app, kind, owner_id, scope, title, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', 'user_big', 'p:user_big', 't', ?, ?)`,
    );
    for (let i = 0; i < 5000; i++) insert.run(`big-${i}`, now, now);
    const started = performance.now();
    expect(await body(await count('user_big', '?limit=11'))).toEqual({ count: 11 });
    const bounded = performance.now() - started;
    expect(bounded).toBeLessThan(50);
  });
});
