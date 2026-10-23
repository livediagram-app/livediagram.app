// Items over HTTP: who gets in, making, reading, renaming and moving, the Trash and purging, copies,
// opens, and grants an app can check.
import { createGrantVerifier, type GrantResponse, type Item } from '@liveworkspace/index-client';
import { createLocalJWKSet, type JWK } from 'jose';
import { describe, expect, it } from 'vitest';
import worker from './index';
import { testDb } from './test-sqlite-d1';
import {
  AUDIENCE,
  BASE,
  body,
  call,
  h,
  makeItem,
  person,
  settle,
  token,
  useHarness,
} from './test-support';

useHarness();

type ItemBody = { item: Item };

describe('who gets in', () => {
  it('refuses a person route without a token, or with a bad one', async () => {
    expect((await call('/items')).status).toBe(401);
    expect(await body(await call('/items'))).toEqual({ error: 'unauthorized' });
    const wrongAud = await token('user_a', { aud: 'https://example.com/api' });
    expect((await call('/items', { auth: wrongAud })).status).toBe(401);
    const expired = await token('user_a', { exp: '-1m' });
    expect((await call('/items', { auth: expired })).status).toBe(401);
    expect((await call('/items', { auth: 'garbage' })).status).toBe(401);
  });

  it('lets an account and a guest in', async () => {
    const ada = await person('user_a');
    expect((await call('/items', { auth: ada.auth })).status).toBe(200);
    const guest = await person('guest_1234', { guest: true });
    const item = await makeItem(guest.auth);
    expect(item.ownerId).toBe('guest_1234');
  });

  it('answers paths outside /api/index and unknown routes as missing', async () => {
    const ctx = { waitUntil: () => {} } as unknown as ExecutionContext;
    const res = await worker.fetch(
      new Request('https://liveworkspace.app/api/other'),
      h.db.env,
      ctx,
    );
    expect(res.status).toBe(404);
    const ada = await person('user_a');
    expect((await call('/nowhere', { auth: ada.auth })).status).toBe(404);
  });

  it('answers everything as missing when switched off', async () => {
    const off = testDb({ INDEX_ENABLED: 'off' });
    expect((await call('/jwks', { env: off.env })).status).toBe(404);
  });
});

describe('making and reading an item', () => {
  it('makes an item with a grant for its owner', async () => {
    const ada = await person('user_a');
    const res = await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'livedesign', title: '  Logo  ', intent: 'logo', source: 'person' },
    });
    expect(res.status).toBe(201);
    const out = await body<{ item: Item; grant: GrantResponse }>(res);
    expect(out.item).toMatchObject({
      app: 'livedesign',
      kind: 'design',
      title: 'Logo',
      ownerId: 'user_a',
      teamId: null,
      folderId: null,
      intent: 'logo',
      source: 'person',
      access: 'edit',
      favourite: false,
      tagIds: [],
      lastOpenedAt: null,
      sharedVia: null,
      summary: {},
    });
    expect(out.item.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.grant).toMatchObject({ level: 'edit', tabId: null });
    expect(out.grant.expiresAt).toBeGreaterThan(Date.now() + 9 * 60 * 1000);
  });

  it('refuses a bad app, title, source, team or folder', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const post = (b: unknown) => call('/items', { method: 'POST', auth: ada.auth, body: b });
    expect(await body(await post({ app: 'nope' }))).toEqual({ error: 'invalid_app' });
    expect(await body(await post({ app: 'liveplanner', title: '   ' }))).toEqual({
      error: 'invalid_title',
    });
    expect((await post({ app: 'liveplanner', source: 'robot' })).status).toBe(400);
    const res = await post({ app: 'liveplanner', teamId: 'team2' });
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: 'not_team_member' });
    expect((await post({ app: 'liveplanner', folderId: 'missing' })).status).toBe(404);
    expect((await post({ app: 'liveplanner', teamId: 'team1' })).status).toBe(201);
  });

  it('takes the id a client minted, once', async () => {
    const ada = await person('user_a');
    const bob = await person('user_b');
    const id = '6f9d1d5e-2a7b-4c1e-9d3a-0b8e5f7a1c2d';
    const post = (auth: string, b: unknown) => call('/items', { method: 'POST', auth, body: b });
    const made = await post(ada.auth, { app: 'liveplanner', id });
    expect(made.status).toBe(201);
    expect((await body<{ item: Item }>(made)).item.id).toBe(id);
    // Taken, by anyone: the row is never handed over.
    const again = await post(bob.auth, { app: 'liveplanner', id });
    expect(again.status).toBe(409);
    expect(await body(again)).toEqual({ error: 'item_exists' });
    expect((await post(ada.auth, { app: 'liveplanner', id: '' })).status).toBe(400);
    expect((await post(ada.auth, { app: 'liveplanner', id: 7 })).status).toBe(400);
  });

  it('files into a folder only in the same scope', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Mine' } }),
    );
    const res = await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'liveplanner', teamId: 'team1', folderId: folder.folder.id },
    });
    expect(await body(res)).toEqual({ error: 'folder_not_found' });
    expect((await makeItem(ada.auth, { folderId: folder.folder.id })).folderId).toBe(
      folder.folder.id,
    );
  });

  it('shows an item to its owner and team, and to nobody else', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const eve = await person('user_e');
    const mine = await makeItem(ada.auth);
    const team = await makeItem(ada.auth, { teamId: 'team1' });
    expect((await call(`/items/${mine.id}`, { auth: bob.auth })).status).toBe(404);
    const seen = await body<ItemBody>(await call(`/items/${team.id}`, { auth: bob.auth }));
    expect(seen.item).toMatchObject({ access: 'edit', teamId: 'team1' });
    expect((await call(`/items/${team.id}`, { auth: eve.auth })).status).toBe(404);
    expect((await call(`/items/${team.id}`)).status).toBe(401);
    expect((await call('/items/missing', { auth: ada.auth })).status).toBe(404);
  });
});

describe('renaming and moving', () => {
  it('renames, bumping updatedAt, and moves without bumping it', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    h.db.sql.prepare('UPDATE items SET updated_at = 1 WHERE id = ?').run(item.id);
    const renamed = await body<ItemBody>(
      await call(`/items/${item.id}`, {
        method: 'PATCH',
        auth: ada.auth,
        body: { title: 'Plan B' },
      }),
    );
    expect(renamed.item.title).toBe('Plan B');
    expect(renamed.item.updatedAt).toBeGreaterThan(1);
    h.db.sql.prepare('UPDATE items SET updated_at = 1 WHERE id = ?').run(item.id);
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'F' } }),
    );
    const moved = await body<ItemBody>(
      await call(`/items/${item.id}`, {
        method: 'PATCH',
        auth: ada.auth,
        body: { folderId: folder.folder.id },
      }),
    );
    expect(moved.item).toMatchObject({ folderId: folder.folder.id, updatedAt: 1 });
  });

  it('moves into and out of a team only for joined members', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const item = await makeItem(ada.auth);
    const bad = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { teamId: 'team9' },
    });
    expect(await body(bad)).toEqual({ error: 'not_team_member' });
    const inTeam = await body<ItemBody>(
      await call(`/items/${item.id}`, {
        method: 'PATCH',
        auth: ada.auth,
        body: { teamId: 'team1' },
      }),
    );
    expect(inTeam.item.teamId).toBe('team1');
    expect(h.db.sql.prepare('SELECT scope FROM items WHERE id = ?').get(item.id)).toEqual({
      scope: 't:team1',
    });
    // Bob takes it out of the team: it becomes his.
    const out = await body<ItemBody>(
      await call(`/items/${item.id}`, { method: 'PATCH', auth: bob.auth, body: { teamId: null } }),
    );
    expect(out.item).toMatchObject({ teamId: null, ownerId: 'user_b' });
    expect((await call(`/items/${item.id}`, { auth: ada.auth })).status).toBe(404);
  });

  it('refuses a bad title', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const res = await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: ada.auth,
      body: { title: 'x'.repeat(501) },
    });
    expect(await body(res)).toEqual({ error: 'invalid_title' });
  });
});

describe('the Trash', () => {
  it('trashes and restores, and only the owner or team may', async () => {
    const ada = await person('user_a');
    const eve = await person('user_e');
    const item = await makeItem(ada.auth);
    expect((await call(`/items/${item.id}`, { method: 'DELETE', auth: eve.auth })).status).toBe(
      404,
    );
    expect((await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth })).status).toBe(
      204,
    );
    const trashed = await body<ItemBody>(await call(`/items/${item.id}`, { auth: ada.auth }));
    expect(trashed.item).toMatchObject({ trashReason: 'deleted' });
    expect(trashed.item.trashedAt).not.toBeNull();
    const list = await body<{ items: Item[] }>(await call('/trash', { auth: ada.auth }));
    expect(list.items.map((i) => i.id)).toEqual([item.id]);
    const restored = await body<ItemBody>(
      await call(`/items/${item.id}/restore`, { method: 'POST', auth: ada.auth }),
    );
    expect(restored.item).toMatchObject({ trashedAt: null, trashReason: null });
  });

  it('keeps the reason an app gives for an empty item', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await call(`/items/${item.id}?reason=empty`, { method: 'DELETE', auth: ada.auth });
    expect(h.db.sql.prepare('SELECT trash_reason FROM items').get()).toEqual({
      trash_reason: 'empty',
    });
  });

  it('purges for good, asking the app to drop the content', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await call(`/tags`, {
      method: 'POST',
      auth: ada.auth,
      body: { id: 't1', name: 'x', colour: 'red' },
    });
    await call(`/tags/t1/items/${item.id}`, { method: 'PUT', auth: ada.auth });
    const res = await call(`/items/${item.id}?permanent=true`, {
      method: 'DELETE',
      auth: ada.auth,
    });
    expect(res.status).toBe(204);
    await settle();
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 0 });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM item_tags').get()).toEqual({ n: 0 });
    expect(h.appCalls).toHaveLength(1);
    expect(h.appCalls[0]).toMatchObject({
      method: 'DELETE',
      url: `https://liveplanner.app/api/internal/items/${item.id}`,
    });
    expect(h.appCalls[0]!.headers.get('Authorization')).toBe('Bearer lp-key');
    expect(h.appCalls[0]!.headers.get('X-Index-App')).toBe('liveplanner');
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM purge_tombstones').get()).toEqual({ n: 0 });
  });

  it('keeps a tombstone when the app cannot be reached', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    h.appAnswer = () => new Response('down', { status: 503 });
    await call(`/items/${item.id}?permanent=true`, { method: 'DELETE', auth: ada.auth });
    await settle();
    expect(
      h.db.sql.prepare('SELECT item_id, attempts, last_error FROM purge_tombstones').get(),
    ).toEqual({ item_id: item.id, attempts: 1, last_error: 'status_503' });
  });

  it('empties the Trash, personal or a team’s', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const a = await makeItem(ada.auth);
    const b = await makeItem(ada.auth, { teamId: 'team1' });
    const keep = await makeItem(ada.auth);
    for (const id of [a.id, b.id]) await call(`/items/${id}`, { method: 'DELETE', auth: ada.auth });
    const res = await call('/trash', { method: 'DELETE', auth: ada.auth });
    expect(await body(res)).toEqual({ purged: 1 });
    expect(
      (await body(await call('/trash?team=team1', { method: 'DELETE', auth: ada.auth }))).purged,
    ).toBe(1);
    expect((await call('/trash?team=team9', { method: 'DELETE', auth: ada.auth })).status).toBe(
      403,
    );
    await settle();
    expect(h.db.sql.prepare('SELECT id FROM items').all()).toEqual([{ id: keep.id }]);
  });
});

describe('copies', () => {
  it('makes the row, then asks the app to copy the content', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    const res = await call(`/items/${item.id}/copy`, { method: 'POST', auth: ada.auth, body: {} });
    expect(res.status).toBe(201);
    const copy = (await body<ItemBody>(res)).item;
    expect(copy).toMatchObject({ title: 'Roadmap (copy)', ownerId: 'user_a', access: 'edit' });
    expect(h.appCalls[0]).toMatchObject({
      method: 'POST',
      url: `https://liveplanner.app/api/internal/items/${item.id}/copy-to/${copy.id}`,
      body: { tabId: null },
    });
  });

  it('removes the row and answers 502 when the app fails', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    h.appAnswer = () => new Response(null, { status: 500 });
    const res = await call(`/items/${item.id}/copy`, {
      method: 'POST',
      auth: ada.auth,
      body: { title: 'Mine' },
    });
    expect(res.status).toBe(502);
    expect(await body(res)).toEqual({ error: 'copy_failed' });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 1 });
  });

  it('answers 502 when the app has no origin configured', async () => {
    const ada = await person('user_a');
    const res = await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'livedesign' },
    });
    const item = (await body<ItemBody>(res)).item;
    expect((await call(`/items/${item.id}/copy`, { method: 'POST', auth: ada.auth })).status).toBe(
      502,
    );
  });

  it('needs a person to own the copy', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await body<{ link: { code: string } }>(
      await call(`/items/${item.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'view' },
      }),
    );
    const res = await call(`/items/${item.id}/copy`, {
      method: 'POST',
      headers: { 'X-Share-Code': link.link.code },
    });
    expect(res.status).toBe(401);
  });
});

describe('opens', () => {
  it('records an open, at most once a minute', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    expect((await call(`/items/${item.id}/open`, { method: 'POST', auth: ada.auth })).status).toBe(
      204,
    );
    const first = h.db.sql.prepare('SELECT last_opened_at FROM opens').get() as {
      last_opened_at: number;
    };
    await call(`/items/${item.id}/open`, { method: 'POST', auth: ada.auth });
    expect(h.db.sql.prepare('SELECT last_opened_at FROM opens').get()).toEqual(first);
    const got = await body<ItemBody>(await call(`/items/${item.id}`, { auth: ada.auth }));
    expect(got.item.lastOpenedAt).toBe(first.last_opened_at);
  });

  it('debounces in SQL too, across isolates', async () => {
    const ada = await person('user_b');
    const item = await makeItem(ada.auth);
    const now = Date.now();
    h.db.sql
      .prepare('INSERT INTO opens (person_id, item_id, last_opened_at) VALUES (?, ?, ?)')
      .run('user_b', item.id, now - 10_000);
    await call(`/items/${item.id}/open`, { method: 'POST', auth: ada.auth });
    expect(h.db.sql.prepare('SELECT last_opened_at FROM opens').get()).toEqual({
      last_opened_at: now - 10_000,
    });
  });

  it('records nothing for a link visitor without identity', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const link = await body<{ link: { code: string } }>(
      await call(`/items/${item.id}/share`, { method: 'POST', auth: ada.auth, body: {} }),
    );
    const res = await call(`/items/${item.id}/open`, {
      method: 'POST',
      headers: { 'X-Share-Code': link.link.code },
    });
    expect(res.status).toBe(204);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM opens').get()).toEqual({ n: 0 });
  });
});

describe('grants', () => {
  async function verifierFor(app: 'liveplanner' | 'livediagram') {
    const jwks = await body<{ keys: JWK[] }>(await call('/jwks'));
    return createGrantVerifier({
      jwksUrl: `${BASE}/jwks`,
      audience: app,
      issuer: 'https://liveworkspace.app/api/index',
      keys: createLocalJWKSet(jwks),
    });
  }

  it('publishes its public key, cacheable, without the private part', async () => {
    const res = await call('/jwks');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    const jwks = await body<{ keys: JWK[] }>(res);
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kty: 'EC', crv: 'P-256', kid: 'grant-1', alg: 'ES256' });
    expect(jwks.keys[0]!.d).toBeUndefined();
  });

  it('grants the owner edit, checkable offline by the app', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const res = await call(`/items/${item.id}/grant`, { method: 'POST', auth: ada.auth });
    const grant = await body<GrantResponse>(res);
    const claims = await (await verifierFor('liveplanner'))(grant.grant);
    expect(claims).toMatchObject({
      aud: 'liveplanner',
      sub: 'user_a',
      item: item.id,
      level: 'edit',
      tab: null,
      team: null,
    });
    expect(claims!.exp - claims!.iat).toBe(600);
    expect(await (await verifierFor('livediagram'))(grant.grant)).toBeNull();
  });

  it('grants a team member edit with the team named', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1', role: 'admin' }] });
    const item = await makeItem(ada.auth, { teamId: 'team1' });
    const grant = await body<GrantResponse>(
      await call(`/items/${item.id}/grant`, { method: 'POST', auth: bob.auth }),
    );
    expect(await (await verifierFor('liveplanner'))(grant.grant)).toMatchObject({
      sub: 'user_b',
      level: 'edit',
      team: 'team1',
    });
  });

  it('grants a link visitor the link’s level and tab', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const { link } = await body<{ link: { code: string } }>(
      await call(`/items/${item.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'participate', tabId: 'tab-2' },
      }),
    );
    const grant = await body<GrantResponse>(
      await call(`/items/${item.id}/grant`, {
        method: 'POST',
        headers: { 'X-Share-Code': link.code },
      }),
    );
    expect(grant).toMatchObject({ level: 'participate', tabId: 'tab-2' });
    expect(await (await verifierFor('liveplanner'))(grant.grant)).toMatchObject({
      sub: `link:${link.code}`,
      level: 'participate',
      tab: 'tab-2',
    });
  });

  it('refuses grants outside development without a key, and makes one in development', async () => {
    const prod = testDb({ ENVIRONMENT: 'production' });
    expect((await call('/jwks', { env: prod.env })).status).toBe(503);
    const ada = await person('user_a');
    const res = await call('/items', {
      method: 'POST',
      auth: ada.auth,
      body: { app: 'liveplanner' },
      env: prod.env,
    });
    expect(await body(res)).toEqual({ error: 'grants_unavailable' });
    const dev = testDb();
    const jwks = await body<{ keys: JWK[] }>(await call('/jwks', { env: dev.env }));
    expect(jwks.keys[0]!.kid).toMatch(/^dev-/);
  });
});

describe('tokens', () => {
  it('accept any configured audience', async () => {
    const auth = await token('user_a', { aud: 'https://livediagram.app/api' });
    expect((await call('/items', { auth })).status).toBe(200);
    expect(AUDIENCE).not.toBe('https://livediagram.app/api');
  });
});
