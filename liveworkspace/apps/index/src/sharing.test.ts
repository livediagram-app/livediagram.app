// Sharing over HTTP: links and their levels, tabs, expiry and passwords; what a link opens; Shared with
// me; revoking.
import type { Item, ShareLink, SharedWithItem } from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness();

async function share(auth: string, itemId: string, input: Record<string, unknown> = {}) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input });
  expect(res.status).toBe(201);
  // The app's notice of the new link is notices.test.ts's: these tests follow the revokes.
  await settle();
  h.appCalls = h.appCalls.filter((c) => !c.url.endsWith('/notices'));
  return (await body<{ link: ShareLink }>(res)).link;
}

describe('share links', () => {
  it('makes, lists, rescopes and revokes links, for the owner only', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view', tabId: 'tab-1', expiry: 'week' });
    expect(link).toMatchObject({ itemId: item.id, level: 'view', tabId: 'tab-1', expiry: 'week' });
    expect(link.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{14}$/);
    expect(link.expiresAt! - link.createdAt).toBe(7 * 24 * 60 * 60 * 1000);
    const defaulted = await share(ada.auth, item.id);
    expect(defaulted).toMatchObject({
      level: 'edit',
      tabId: null,
      expiry: 'never',
      expiresAt: null,
    });

    const listed = await body<{ links: ShareLink[]; passwordSet: boolean }>(
      await call(`/items/${item.id}/share`, { auth: ada.auth }),
    );
    expect(listed.links.map((l) => l.code)).toEqual([link.code, defaulted.code]);
    expect(listed.passwordSet).toBe(false);
    expect((await call(`/items/${item.id}/share`, { auth: eve.auth })).status).toBe(404);

    const patched = await body<{ link: ShareLink }>(
      await call(`/share/${link.code}`, {
        method: 'PATCH',
        auth: ada.auth,
        body: { level: 'participate', tabId: null },
      }),
    );
    expect(patched.link).toMatchObject({ level: 'participate', tabId: null });
    expect((await call(`/share/${link.code}`, { method: 'DELETE', auth: eve.auth })).status).toBe(
      404,
    );
    expect((await call(`/share/${link.code}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    await settle();
    expect(h.appCalls).toEqual([
      // The rescope, so the link's visitors reload into what it now opens.
      expect.objectContaining({
        method: 'POST',
        url: `https://liveplanner.app/api/internal/items/${item.id}/revoke`,
        body: { codes: [link.code], reason: 'rescoped' },
      }),
      expect.objectContaining({
        method: 'POST',
        url: `https://liveplanner.app/api/internal/items/${item.id}/revoke`,
        body: { codes: [link.code] },
      }),
    ]);
  });

  it('tells the app nothing when a link is saved unchanged', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view' });
    await call(`/share/${link.code}`, { method: 'PATCH', auth: ada.auth, body: { level: 'view' } });
    await settle();
    expect(h.appCalls).toEqual([]);
  });

  it('refuses a bad level or tab', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const post = (b: unknown) =>
      call(`/items/${item.id}/share`, { method: 'POST', auth: ada.auth, body: b });
    expect(await body(await post({ level: 'owner' }))).toEqual({ error: 'invalid_level' });
    expect(await body(await post({ tabId: 7 }))).toEqual({ error: 'invalid_tab' });
  });

  it('lets a link editor rename, but not move, share or trash', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'edit' });
    const headers = { 'X-Share-Code': link.code };
    const renamed = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: bob.auth,
      headers,
      body: { title: 'Renamed' },
    });
    expect((await body<{ item: Item }>(renamed)).item).toMatchObject({
      title: 'Renamed',
      access: 'edit',
      sharedVia: link.code,
    });
    expect(
      (
        await call(`/items/${item.id}`, {
          method: 'PATCH',
          auth: bob.auth,
          headers,
          body: { folderId: null },
        })
      ).status,
    ).toBe(403);
    expect((await call(`/items/${item.id}/share`, { auth: bob.auth, headers })).status).toBe(403);
    expect(
      (await call(`/items/${item.id}`, { method: 'DELETE', auth: bob.auth, headers })).status,
    ).toBe(403);
  });

  it('keeps a view link to viewing', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view' });
    const res = await call(`/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'X-Share-Code': link.code },
      body: { title: 'x' },
    });
    expect(res.status).toBe(403);
  });

  it('stops an expired link, and extends it', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view', expiry: 'month' });
    h.db.sql
      .prepare('UPDATE share_links SET expires_at = ? WHERE code = ?')
      .run(Date.now() - 1, link.code);
    expect((await call(`/share/${link.code}`)).status).toBe(404);
    expect(
      (
        await call(`/items/${item.id}/grant`, {
          method: 'POST',
          headers: { 'X-Share-Code': link.code },
        })
      ).status,
    ).toBe(404);
    const extended = await body<{ link: ShareLink }>(
      await call(`/share/${link.code}/extend`, { method: 'POST', auth: ada.auth }),
    );
    expect(extended.link.expiresAt).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect((await call(`/share/${link.code}`)).status).toBe(200);
    const never = await share(ada.auth, item.id);
    const res = await call(`/share/${never.code}/extend`, { method: 'POST', auth: ada.auth });
    expect(await body(res)).toEqual({ error: 'never_expires' });
  });

  it('revokes every link at once, telling the app', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const a = await share(ada.auth, item.id);
    const b = await share(ada.auth, item.id);
    expect(
      (await call(`/items/${item.id}/share`, { method: 'DELETE', auth: ada.auth })).status,
    ).toBe(204);
    await settle();
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM share_links').get()).toEqual({ n: 0 });
    expect((h.appCalls[0]!.body as { codes: string[] }).codes.sort()).toEqual(
      [a.code, b.code].sort(),
    );
  });

  it("marks the owner's items that have a live link, in lists", async () => {
    const ada = await person('user_a');
    const shared = await makeItem(ada.auth);
    const plain = await makeItem(ada.auth);
    await share(ada.auth, shared.id);
    const listed = await body<{ items: Item[] }>(await call('/items', { auth: ada.auth }));
    const byId = new Map(listed.items.map((i) => [i.id, i]));
    expect(byId.get(shared.id)!.hasLinks).toBe(true);
    expect(byId.get(plain.id)!.hasLinks).toBe(false);
    // An expired link no longer counts.
    const expired = await makeItem(ada.auth);
    const link = await share(ada.auth, expired.id, { expiry: 'day' });
    h.db.sql.prepare('UPDATE share_links SET expires_at = 1 WHERE code = ?').run(link.code);
    const again = await body<{ items: Item[] }>(await call('/items', { auth: ada.auth }));
    expect(again.items.find((i) => i.id === expired.id)!.hasLinks).toBe(false);
  });

  it('caps the links on one item', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const insert = h.db.sql.prepare(
      'INSERT INTO share_links (code, item_id, level, created_at) VALUES (?, ?, ?, ?)',
    );
    for (let i = 0; i < 100; i++) insert.run(`CODE${i}`, item.id, 'view', i);
    const res = await call(`/items/${item.id}/share`, { method: 'POST', auth: ada.auth, body: {} });
    expect(await body(res)).toEqual({ error: 'share_link_limit' });
  });
});

describe('share passwords', () => {
  it('stores only a hash, and gates link visitors', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view' });
    const set = await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: ' hunter2 ' },
    });
    expect(await body(set)).toEqual({ passwordSet: true });
    const stored = h.db.sql.prepare('SELECT hash FROM share_passwords').get() as { hash: string };
    expect(stored.hash).toMatch(/^pbkdf2-sha256\$100000\$/);
    expect(stored.hash).not.toContain('hunter2');

    const none = await call(`/share/${link.code}`);
    expect(none.status).toBe(401);
    expect(await body(none)).toEqual({ error: 'password_required' });
    const wrong = await call(`/share/${link.code}`, { headers: { 'X-Share-Password': 'nope' } });
    expect(wrong.status).toBe(403);
    expect(await body(wrong)).toEqual({ error: 'password_invalid' });
    const right = await call(`/share/${link.code}`, {
      headers: { 'X-Share-Code': link.code, 'X-Share-Password': 'hunter2' },
    });
    expect(right.status).toBe(200);
    const grant = await call(`/items/${item.id}/grant`, {
      method: 'POST',
      headers: { 'X-Share-Code': link.code, 'X-Share-Password': 'hunter2' },
    });
    expect(grant.status).toBe(200);
    // The owner never needs it.
    expect((await call(`/items/${item.id}/grant`, { method: 'POST', auth: ada.auth })).status).toBe(
      200,
    );

    const listed = await body<{ passwordSet: boolean }>(
      await call(`/items/${item.id}/share`, { auth: ada.auth }),
    );
    expect(listed.passwordSet).toBe(true);
    const cleared = await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: '   ' },
    });
    expect(await body(cleared)).toEqual({ passwordSet: false });
    expect((await call(`/share/${link.code}`)).status).toBe(200);
  });

  it('refuses an overlong password', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const res = await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'x'.repeat(257) },
    });
    expect(await body(res)).toEqual({ error: 'invalid_password' });
  });
});

describe('what a link opens, and Shared with me', () => {
  it('answers the item, level and tab, and records it for a person', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth, { title: 'Board' });
    const link = await share(ada.auth, item.id, { level: 'participate', tabId: 't1' });
    const anon = await body<{ item: Item; level: string; tabId: string }>(
      await call(`/share/${link.code}`),
    );
    expect(anon).toMatchObject({ level: 'participate', tabId: 't1', item: { title: 'Board' } });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM shared_with').get()).toEqual({ n: 0 });

    const seen = await body<{ item: Item }>(
      await call(`/share/${link.code.toLowerCase()}`, { auth: bob.auth }),
    );
    expect(seen.item).toMatchObject({ access: 'participate', sharedVia: link.code });

    // Bob now reaches it without sending the code.
    const got = await body<{ item: Item }>(await call(`/items/${item.id}`, { auth: bob.auth }));
    expect(got.item.access).toBe('participate');
    const shared = await body<{ shared: SharedWithItem[] }>(
      await call('/shared', { auth: bob.auth }),
    );
    expect(shared.shared).toEqual([
      expect.objectContaining({ code: link.code, level: 'participate', tabId: 't1' }),
    ]);
    const viaItems = await body<{ items: Item[] }>(
      await call('/items?view=shared', { auth: bob.auth }),
    );
    expect(viaItems.items.map((i) => i.id)).toEqual([item.id]);

    // The owner opening their own link records nothing.
    await call(`/share/${link.code}`, { auth: ada.auth });
    expect(h.db.sql.prepare('SELECT person_id FROM shared_with').all()).toEqual([
      { person_id: 'user_b' },
    ]);

    // Revoked: Bob loses it.
    await call(`/share/${link.code}`, { method: 'DELETE', auth: ada.auth });
    expect((await call(`/items/${item.id}`, { auth: bob.auth })).status).toBe(404);
    expect(
      (await body<{ shared: unknown[] }>(await call('/shared', { auth: bob.auth }))).shared,
    ).toEqual([]);
  });

  it('forgets a shared item on request', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id);
    await call(`/share/${link.code}`, { auth: bob.auth });
    expect((await call(`/shared/${item.id}`, { method: 'DELETE', auth: bob.auth })).status).toBe(
      204,
    );
    expect(
      (await body<{ shared: unknown[] }>(await call('/shared', { auth: bob.auth }))).shared,
    ).toEqual([]);
  });

  it('hides a trashed item from its link', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id);
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    expect((await call(`/share/${link.code}`)).status).toBe(404);
    expect(
      (await call(`/items/${item.id}`, { headers: { 'X-Share-Code': link.code } })).status,
    ).toBe(404);
  });

  it('refuses a code for another item', async () => {
    const ada = await person('user_a');
    const one = await makeItem(ada.auth);
    const two = await makeItem(ada.auth);
    const link = await share(ada.auth, one.id);
    expect(
      (await call(`/items/${two.id}`, { headers: { 'X-Share-Code': link.code } })).status,
    ).toBe(404);
  });
});
