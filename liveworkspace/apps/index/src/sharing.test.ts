// Sharing over HTTP: links and their levels, tabs, expiry and passwords; what a link opens; Shared with
// me; revoking.
import type { Item, ShareLink, SharedWithItem } from '@liveworkspace/index-client';
import { decodeJwt } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { hashSharePassword } from './password-hash';
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

  it('refuses a bad level, tab or expiry', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const post = (b: unknown) =>
      call(`/items/${item.id}/share`, { method: 'POST', auth: ada.auth, body: b });
    expect(await body(await post({ level: 'owner' }))).toEqual({ error: 'invalid_level' });
    expect(await body(await post({ tabId: 7 }))).toEqual({ error: 'invalid_tab' });
    // A value that is no expiry is refused, never made a link that lasts for ever.
    for (const expiry of ['weekly', 7, null])
      expect(await body(await post({ expiry }))).toEqual({ error: 'invalid_expiry' });
    const lasting = await post({});
    expect(lasting.status).toBe(201);
    expect((await body<{ link: { expiry: string } }>(lasting)).link.expiry).toBe('never');
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
    const link = await share(ada.auth, expired.id, { expiry: 'week' });
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
  it('closes a public link behind a password rather than asking for it, and opens it again when cleared', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    const open = await share(ada.auth, item.id, { level: 'view', public: true });
    expect(open.public).toBe(true);
    const ordinary = await share(ada.auth, item.id, { level: 'view' });
    expect(ordinary.public).toBe(false);
    await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'hunter2' },
    });
    // No prompt through the public link, even with the right password: it is closed.
    for (const headers of [{}, { 'X-Share-Password': 'hunter2' }] as Record<string, string>[]) {
      const res = await call(`/share/${open.code}`, { headers });
      expect(res.status).toBe(404);
    }
    const grant = await call(`/items/${item.id}/grant`, {
      method: 'POST',
      auth: eve.auth,
      headers: { 'X-Share-Code': open.code },
    });
    expect(grant.status).toBe(404);
    // An ordinary link still asks.
    expect((await call(`/share/${ordinary.code}`)).status).toBe(401);
    await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: null },
    });
    expect((await call(`/share/${open.code}`)).status).toBe(200);
  });

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

  it('refuses a new password shorter than six characters, and keeps an older short one working', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view' });
    // Counted after trimming: spaces don't make a password longer.
    for (const password of ['abc12', '  abc12  ']) {
      const res = await call(`/items/${item.id}/share-password`, {
        method: 'PUT',
        auth: ada.auth,
        body: { password },
      });
      expect(res.status).toBe(400);
      expect(await body(res)).toEqual({ error: 'password_too_short' });
    }
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM share_passwords').get()).toEqual({ n: 0 });
    const ok = await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password: 'abc123' },
    });
    expect(await body(ok)).toEqual({ passwordSet: true });

    // One set before the minimum still opens.
    h.db.sql
      .prepare('UPDATE share_passwords SET hash = ? WHERE item_id = ?')
      .run(await hashSharePassword('pw'), item.id);
    const opened = await call(`/share/${link.code}`, { headers: { 'X-Share-Password': 'pw' } });
    expect(opened.status).toBe(200);
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

describe('setting a password on links already opened', () => {
  async function openedByBob() {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view' });
    const other = await share(ada.auth, item.id, { level: 'edit' });
    expect((await call(`/share/${link.code}`, { auth: bob.auth })).status).toBe(200);
    await settle();
    h.appCalls = [];
    return { ada, bob, item, link, other };
  }
  const sharedOf = async (auth: string) =>
    (await body<{ shared: SharedWithItem[] }>(await call('/shared', { auth }))).shared;
  const setPassword = (auth: string, itemId: string, password: string | null) =>
    call(`/items/${itemId}/share-password`, { method: 'PUT', auth, body: { password } });

  it('takes the item out of their Shared and Inbox, and ends the link sessions, until they enter it', async () => {
    const { ada, bob, item, link, other } = await openedByBob();
    expect(await sharedOf(bob.auth)).toHaveLength(1);
    await setPassword(ada.auth, item.id, 'opened-1');
    await settle();
    expect(await sharedOf(bob.auth)).toEqual([]);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM shared_with').get()).toEqual({ n: 0 });
    // Every link's sessions reload into what the link now asks: the password.
    expect(h.appCalls).toEqual([
      expect.objectContaining({
        method: 'POST',
        url: `https://liveplanner.app/api/internal/items/${item.id}/revoke`,
        body: { codes: [link.code, other.code], reason: 'rescoped' },
      }),
    ]);
    // Without it, nothing opens for them, by the code or by what they opened before.
    const grant = await call(`/items/${item.id}/grant`, { method: 'POST', auth: bob.auth });
    expect(grant.status).toBe(404);
    // With it, they are back.
    const back = await call(`/share/${link.code}`, {
      auth: bob.auth,
      headers: { 'X-Share-Password': 'opened-1' },
    });
    expect(back.status).toBe(200);
    expect(await sharedOf(bob.auth)).toHaveLength(1);
  });

  it('does the same when the password changes, but not when it is saved unchanged or removed', async () => {
    const { ada, bob, item, link } = await openedByBob();
    await setPassword(ada.auth, item.id, 'opened-2');
    await call(`/share/${link.code}`, {
      auth: bob.auth,
      headers: { 'X-Share-Password': 'opened-2' },
    });
    await settle();
    h.appCalls = [];
    // The same password again changes nothing for anyone.
    await setPassword(ada.auth, item.id, ' opened-2 ');
    await settle();
    expect(h.appCalls).toEqual([]);
    expect(await sharedOf(bob.auth)).toHaveLength(1);
    // A new one cuts them off again.
    await setPassword(ada.auth, item.id, 'opened-3');
    await settle();
    expect(await sharedOf(bob.auth)).toEqual([]);
    expect(h.appCalls).toHaveLength(1);
    // Removing it opens the links wider, so no one is sent away.
    await call(`/share/${link.code}`, {
      auth: bob.auth,
      headers: { 'X-Share-Password': 'opened-3' },
    });
    await settle();
    h.appCalls = [];
    await setPassword(ada.auth, item.id, null);
    await settle();
    expect(h.appCalls).toEqual([]);
    expect(await sharedOf(bob.auth)).toHaveLength(1);
  });
});

describe('share-password guesses', () => {
  // A limiter that allows `allow` calls per key, recording each key it was asked about.
  function limiter(allow: number) {
    const counts = new Map<string, number>();
    const keys: string[] = [];
    return {
      keys,
      limit: vi.fn(async ({ key }: { key: string }) => {
        keys.push(key);
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return { success: n <= allow };
      }),
    };
  }

  async function protectedLink(password: string) {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view' });
    await call(`/items/${item.id}/share-password`, {
      method: 'PUT',
      auth: ada.auth,
      body: { password },
    });
    await settle();
    h.appCalls = [];
    return { item, link };
  }

  it('answers 429 with Retry-After once a visitor has guessed too often, even the right password', async () => {
    const { item, link } = await protectedLink('limit-right-1');
    const visitors = limiter(3);
    const items = limiter(100);
    const env = {
      ...h.db.env,
      SHARE_GUESS_VISITOR_LIMITER: visitors,
      SHARE_GUESS_ITEM_LIMITER: items,
    };
    const guess = (password: string) =>
      call(`/share/${link.code}`, {
        env,
        headers: { 'X-Share-Password': password, 'CF-Connecting-IP': '203.0.113.7' },
      });
    for (const wrong of ['nope-1', 'nope-2', 'nope-3'])
      expect((await guess(wrong)).status).toBe(403);
    const limited = await guess('limit-right-1');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(await body(limited)).toEqual({ error: 'rate_limited' });
    // The grant's door is guarded the same way.
    const grant = await call(`/items/${item.id}/grant`, {
      method: 'POST',
      env,
      headers: {
        'X-Share-Code': link.code,
        'X-Share-Password': 'limit-right-1',
        'CF-Connecting-IP': '203.0.113.7',
      },
    });
    expect(grant.status).toBe(429);
    expect(visitors.keys.every((k) => k === '203.0.113.7')).toBe(true);
    expect(items.keys.every((k) => k === `item:${item.id}`)).toBe(true);
    // Another network still gets its tries.
    const elsewhere = await call(`/share/${link.code}`, {
      env,
      headers: { 'X-Share-Password': 'limit-right-1', 'CF-Connecting-IP': '198.51.100.1' },
    });
    expect(elsewhere.status).toBe(200);
  });

  it('limits every guess at one item, whichever network they come from', async () => {
    const { link } = await protectedLink('limit-right-2');
    const env = {
      ...h.db.env,
      SHARE_GUESS_VISITOR_LIMITER: limiter(100),
      SHARE_GUESS_ITEM_LIMITER: limiter(2),
    };
    const from = (ip: string) =>
      call(`/share/${link.code}`, {
        env,
        headers: { 'X-Share-Password': 'nope', 'CF-Connecting-IP': ip },
      });
    expect((await from('203.0.113.1')).status).toBe(403);
    expect((await from('203.0.113.2')).status).toBe(403);
    expect((await from('203.0.113.3')).status).toBe(429);
  });

  it('counts a visitor by the address their app’s router names, and an app’s server by the item alone', async () => {
    const { link } = await protectedLink('limit-right-3');
    const visitors = limiter(100);
    const items = limiter(100);
    const env = {
      ...h.db.env,
      SHARE_GUESS_VISITOR_LIMITER: visitors,
      SHARE_GUESS_ITEM_LIMITER: items,
    };
    // Through a router: its named address, kept apart from direct callers; IPv6 by its /64.
    await call(`/share/${link.code}`, {
      env,
      headers: {
        'X-Share-Password': 'nope',
        'CF-Connecting-IP': '2a06:98c0::1',
        'CF-Worker': 'livediagram.app',
        'X-Liveworkspace-Client-IP': '2001:db8:1:2:aaaa::1',
      },
    });
    expect(visitors.keys).toEqual(['via:2001:0db8:0001:0002::/64']);
    // An app's server asking for a visitor (a Worker's subrequest, from Cloudflare's own address): the item's limit
    // only, so one visitor can't use up every other visitor's tries.
    await call(`/share/${link.code}`, {
      env,
      headers: { 'X-Share-Password': 'nope', 'CF-Connecting-IP': '2a06:98c0::1', 'CF-Worker': 'x' },
    });
    expect(visitors.keys).toHaveLength(1);
    expect(items.keys).toHaveLength(2);
  });

  it('spends no try on a visit without a password, nor on one this isolate has already checked', async () => {
    const { link } = await protectedLink('limit-right-4');
    const visitors = limiter(100);
    const items = limiter(100);
    const env = {
      ...h.db.env,
      SHARE_GUESS_VISITOR_LIMITER: visitors,
      SHARE_GUESS_ITEM_LIMITER: items,
    };
    expect((await call(`/share/${link.code}`, { env })).status).toBe(401);
    expect(items.limit).not.toHaveBeenCalled();
    const right = { 'X-Share-Password': 'limit-right-4', 'CF-Connecting-IP': '203.0.113.9' };
    expect((await call(`/share/${link.code}`, { env, headers: right })).status).toBe(200);
    expect(items.limit).toHaveBeenCalledTimes(1);
    // A visitor already in: their app asks again and again (each grant renewal), and costs nothing more.
    expect((await call(`/share/${link.code}`, { env, headers: right })).status).toBe(200);
    expect(items.limit).toHaveBeenCalledTimes(1);
    expect(visitors.limit).toHaveBeenCalledTimes(1);
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

  it('names the link in the grant, whether or not the caller sends its code', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'edit' });
    await call(`/share/${link.code}`, { auth: bob.auth });
    const claimsOf = async (auth: string, headers: Record<string, string> = {}) => {
      const res = await call(`/items/${item.id}/grant`, { method: 'POST', auth, headers });
      expect(res.status).toBe(200);
      return decodeJwt((await body<{ grant: string }>(res)).grant);
    };
    // Through Shared, with no code sent: still the link's access, and the grant says so.
    expect(await claimsOf(bob.auth)).toMatchObject({
      sub: 'user_b',
      level: 'edit',
      link: link.code,
    });
    expect(await claimsOf(bob.auth, { 'X-Share-Code': link.code })).toMatchObject({
      link: link.code,
    });
    // The owner's own access names no link, even sent one.
    expect(await claimsOf(ada.auth)).not.toHaveProperty('link');
    expect(await claimsOf(ada.auth, { 'X-Share-Code': link.code })).not.toHaveProperty('link');
  });

  it('keeps no Shared entry, notice or visit for a public link', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const item = await makeItem(ada.auth);
    const link = await share(ada.auth, item.id, { level: 'view', public: true });
    expect((await call(`/share/${link.code}`, { auth: bob.auth })).status).toBe(200);
    const grant = await call(`/items/${item.id}/grant`, {
      method: 'POST',
      auth: bob.auth,
      headers: { 'X-Share-Code': link.code },
    });
    expect(decodeJwt((await body<{ grant: string }>(grant)).grant)).toMatchObject({
      link: link.code,
    });
    expect(
      (
        await call(`/items/${item.id}/open`, {
          method: 'POST',
          auth: bob.auth,
          headers: { 'X-Share-Code': link.code },
        })
      ).status,
    ).toBe(204);
    await settle();
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM shared_with').get()).toEqual({ n: 0 });
    expect(h.appCalls.filter((c) => c.url.endsWith('/notices'))).toEqual([]);
    // Without the code, Bob reaches nothing: the public link was never kept for him.
    expect((await call(`/items/${item.id}/grant`, { method: 'POST', auth: bob.auth })).status).toBe(
      404,
    );
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
