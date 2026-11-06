// Connected tabs over HTTP (liveworkspace/docs/specs/004-index/connected-tabs.md): making one and its pass, both
// ways, Connect Again, every refusal and role, where one leads, and taking one back.
import {
  connectionDefaultLevel,
  CONNECTIONS_PER_ITEM,
  SHARE_LINKS_PER_ITEM,
  type ConnectionMade,
  type ConnectionOpen,
  type ShareLink,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import {
  body,
  call,
  grantSecret,
  h,
  makeItem,
  person,
  settle,
  useHarness,
  type AppCall,
} from './test-support';

useHarness();

const GRANT = 'X-Index-Grant';

async function grantFor(auth: string | null, itemId: string, code?: string): Promise<string> {
  const res = await call(`/items/${itemId}/grant`, {
    method: 'POST',
    auth,
    headers: code ? { 'X-Share-Code': code } : {},
  });
  expect(res.status).toBe(200);
  return (await body<{ grant: string }>(res)).grant;
}

const connect = (
  auth: string | null,
  hostId: string,
  input: Record<string, unknown>,
  grant: string | null,
  headers: Record<string, string> = {},
) =>
  call(`/items/${hostId}/connections`, {
    method: 'POST',
    auth,
    body: input,
    headers: { ...(grant ? { [GRANT]: grant } : {}), ...headers },
  });

const open = (id: string, grant: string, auth: string | null = null) =>
  call(`/connections/${id}`, { auth, headers: { [GRANT]: grant } });

async function link(auth: string, itemId: string, input: Record<string, unknown> = {}) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input });
  expect(res.status).toBe(201);
  return (await body<{ link: ShareLink }>(res)).link;
}

const rows = (table: string, where = '1 = 1', ...args: string[]) =>
  h.db.sql.prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...args);

// A host and a target, both Ada's, with her grant on the host.
async function pair(apps: { host?: string; target?: string } = {}) {
  const ada = await person('user_a');
  const host = await makeItem(ada.auth, { app: apps.host ?? 'livediagram', title: 'Flow' });
  const target = await makeItem(ada.auth, { app: apps.target ?? 'liveplanner', title: 'Roadmap' });
  const grant = await grantFor(ada.auth, host.id);
  await settle();
  h.appCalls = [];
  return { ada, host, target, grant };
}

const doorCalls = () => h.appCalls.filter((c) => c.url.endsWith('/connected-tabs'));

describe('making a connection', () => {
  it('makes the pass on the target, the row on the host, and a shared event', async () => {
    const { ada, host, target, grant } = await pair();
    const res = await connect(ada.auth, host.id, { targetId: target.id, tabId: 'tab-9' }, grant);
    expect(res.status).toBe(201);
    const made = await body<ConnectionMade>(res);
    expect(made).toEqual({
      connection: {
        id: expect.stringMatching(/^cn_[A-Za-z0-9]{24}$/),
        app: 'liveplanner',
        itemId: target.id,
      },
      name: 'Roadmap',
      level: 'edit',
      reverse: null,
    });
    const [row] = rows('connections');
    expect(row).toMatchObject({
      id: made.connection.id,
      host_item_id: host.id,
      host_tab_id: 'tab-9',
      target_item_id: target.id,
      pair_id: null,
      confirmed_at: null,
    });
    expect(rows('share_links', 'item_id = ?', target.id)).toEqual([
      expect.objectContaining({
        code: row!.share_code,
        level: 'edit',
        expiry: 'never',
        expires_at: null,
        tab_id: null,
        public: 0,
      }),
    ]);
    expect(rows('timeline_events', "item_id = ? AND type = 'shared'", target.id)).toHaveLength(1);
    await settle();
    // The target app's first-share notice; nothing to the host.
    expect(h.appCalls.map((c) => c.url)).toEqual([
      `https://liveplanner.app/api/internal/items/${target.id}/notices`,
    ]);
  });

  it('takes a role the target offers, and refuses one it does not', async () => {
    const { ada, host, grant } = await pair();
    const space = await makeItem(ada.auth, { app: 'livehuddle', title: 'Room' });
    const plan = await makeItem(ada.auth, { app: 'liveplanner' });
    const refused = await connect(
      ada.auth,
      host.id,
      { targetId: space.id, tabId: 't1', level: 'view' },
      grant,
    );
    expect(refused.status).toBe(400);
    expect(await body(refused)).toEqual({ error: 'level_not_offered' });
    const viewing = await connect(
      ada.auth,
      host.id,
      { targetId: plan.id, tabId: 't2', level: 'view' },
      grant,
    );
    expect((await body<ConnectionMade>(viewing)).level).toBe('view');
  });

  it('refuses the malformed, the unsigned, agents and connecting an item to itself', async () => {
    const { ada, host, target, grant } = await pair();
    const input = { targetId: target.id, tabId: 't' };
    expect((await connect(null, host.id, input, grant)).status).toBe(401);
    // An app acting for a person (an agent's API token): agents never make connections.
    const agent = await connect('ld-key', host.id, input, grant, {
      'X-Index-App': 'livediagram',
      'X-Index-Person': 'user_a',
    });
    expect(agent.status).toBe(403);
    expect((await connect(ada.auth, host.id, { targetId: target.id }, grant)).status).toBe(400);
    const self = await connect(ada.auth, host.id, { targetId: host.id, tabId: 't' }, grant);
    expect(await body(self)).toEqual({ error: 'connection_self' });
    expect((await connect(ada.auth, host.id, input, null)).status).toBe(403);
    expect((await connect(ada.auth, host.id, input, `${grant}x`)).status).toBe(403);
    // A grant for the target is not one for the host.
    expect(
      (await connect(ada.auth, host.id, input, await grantFor(ada.auth, target.id))).status,
    ).toBe(403);
    expect(await call(`/items/${host.id}/connections`, { auth: ada.auth })).toHaveProperty(
      'status',
      404,
    );
    expect(
      (await call(`/items/${host.id}/connections/x`, { method: 'POST', auth: ada.auth })).status,
    ).toBe(404);
    expect(rows('connections')).toEqual([]);
  });

  it("refuses another person's grant, and a host or target in the Trash or unknown", async () => {
    const { ada, host, target, grant } = await pair();
    const bob = await person('user_b');
    const bobs = await makeItem(bob.auth);
    // Bob holding Ada's grant is still not Ada.
    expect(
      (await connect(bob.auth, host.id, { targetId: bobs.id, tabId: 't' }, grant)).status,
    ).toBe(403);
    const unknown = await connect(ada.auth, host.id, { targetId: 'nope', tabId: 't' }, grant);
    expect(unknown.status).toBe(404);
    await call(`/items/${target.id}`, { method: 'DELETE', auth: ada.auth });
    expect(
      (await connect(ada.auth, host.id, { targetId: target.id, tabId: 't' }, grant)).status,
    ).toBe(404);
    const other = await makeItem(ada.auth);
    await call(`/items/${host.id}`, { method: 'DELETE', auth: ada.auth });
    expect(
      (await connect(ada.auth, host.id, { targetId: other.id, tabId: 't' }, grant)).status,
    ).toBe(404);
  });

  it('holds every role to the rule: an Editor of the host who may share the target', async () => {
    const { ada, host, target } = await pair();
    const bob = await person('user_b');
    const bobs = await makeItem(bob.auth, { title: "Bob's" });
    // Bob reaches Ada's host by links: as a Viewer, a Participant, then an Editor.
    for (const level of ['view', 'participate'] as const) {
      const code = (await link(ada.auth, host.id, { level })).code;
      const grant = await grantFor(bob.auth, host.id, code);
      const res = await connect(bob.auth, host.id, { targetId: bobs.id, tabId: 't' }, grant);
      expect(res.status).toBe(403);
    }
    const editCode = (await link(ada.auth, host.id, { level: 'edit' })).code;
    const editGrant = await grantFor(bob.auth, host.id, editCode);
    // An Editor of the host by link connects their own item one way...
    const own = await connect(bob.auth, host.id, { targetId: bobs.id, tabId: 't1' }, editGrant);
    expect(own.status).toBe(201);
    // ...but not both ways (the host is not theirs to share), nor to Ada's target, which they reach only by link.
    const both = await connect(
      bob.auth,
      host.id,
      { targetId: bobs.id, tabId: 't2', both: true },
      editGrant,
    );
    expect(both.status).toBe(403);
    const targetCode = (await link(ada.auth, target.id, { level: 'edit' })).code;
    // Opened, so the target is under Bob's Shared with me at Editor.
    expect((await call(`/share/${targetCode}`, { auth: bob.auth })).status).toBe(200);
    const theirs = await connect(
      bob.auth,
      host.id,
      { targetId: target.id, tabId: 't3' },
      editGrant,
    );
    expect(theirs.status).toBe(403);
  });

  it('lets a team member connect a team item, and keeps a tab-scoped grant to its tab', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team-1' }] });
    const host = await makeItem(ada.auth, { app: 'livediagram', teamId: 'team-1' });
    const target = await makeItem(ada.auth, { teamId: 'team-1' });
    const cyd = await person('user_c', { teams: [{ id: 'team-1' }] });
    const grant = await grantFor(cyd.auth, host.id);
    expect(
      (await connect(cyd.auth, host.id, { targetId: target.id, tabId: 't', both: true }, grant))
        .status,
    ).toBe(201);
    // A link to one tab grants that tab alone.
    const bob = await person('user_b');
    const scoped = (await link(ada.auth, host.id, { level: 'edit', tabId: 'only' })).code;
    const scopedGrant = await grantFor(bob.auth, host.id, scoped);
    const bobs = await makeItem(bob.auth);
    expect(
      (await connect(bob.auth, host.id, { targetId: bobs.id, tabId: 'other' }, scopedGrant)).status,
    ).toBe(403);
    expect(
      (await connect(bob.auth, host.id, { targetId: bobs.id, tabId: 'only' }, scopedGrant)).status,
    ).toBe(201);
  });

  it("stops at the host's connection cap and the target's link cap, writing nothing", async () => {
    const { ada, host, target, grant } = await pair();
    const insert = h.db.sql.prepare(
      'INSERT INTO connections (id, host_item_id, host_tab_id, created_at) VALUES (?, ?, ?, 1)',
    );
    for (let i = 0; i < CONNECTIONS_PER_ITEM; i++) insert.run(`cn_filler${i}`, host.id, `f${i}`);
    const full = await connect(ada.auth, host.id, { targetId: target.id, tabId: 't' }, grant);
    expect(full.status).toBe(409);
    expect(await body(full)).toEqual({ error: 'connection_limit' });
    expect(rows('share_links', 'item_id = ?', target.id)).toEqual([]);
    h.db.sql.exec('DELETE FROM connections');

    const linkInsert = h.db.sql.prepare(
      "INSERT INTO share_links (code, item_id, level, created_at) VALUES (?, ?, 'view', 1)",
    );
    for (let i = 0; i < SHARE_LINKS_PER_ITEM; i++) linkInsert.run(`FILL${i}`, target.id);
    const links = await connect(ada.auth, host.id, { targetId: target.id, tabId: 't' }, grant);
    expect(await body(links)).toEqual({ error: 'share_link_limit' });
    expect(rows('connections')).toEqual([]);
  });

  it('Connect Again replaces what the tab held and ends its old pass', async () => {
    const { ada, host, target, grant } = await pair();
    const first = await body<ConnectionMade>(
      await connect(ada.auth, host.id, { targetId: target.id, tabId: 't' }, grant),
    );
    const oldCode = rows('connections')[0]!.share_code as string;
    h.db.sql
      .prepare('INSERT INTO shared_with VALUES (?, ?, ?, 1)')
      .run('user_v', target.id, oldCode);
    await settle();
    h.appCalls = [];
    const again = await body<ConnectionMade>(
      await connect(ada.auth, host.id, { targetId: target.id, tabId: 't' }, grant),
    );
    expect(again.connection.id).not.toBe(first.connection.id);
    expect(rows('connections').map((r) => r.id)).toEqual([again.connection.id]);
    expect(rows('share_links', 'code = ?', oldCode)).toEqual([]);
    expect(rows('shared_with')).toEqual([]);
    await settle();
    expect(h.appCalls.find((c) => c.url.endsWith('/revoke'))?.body).toEqual({ codes: [oldCode] });
  });
});

describe('both ways', () => {
  const answerTab =
    (tabId: unknown, status = 200) =>
    (call: AppCall) =>
      call.url.endsWith('/connected-tabs')
        ? Response.json({ tabId }, { status })
        : new Response(null, { status: 200 });

  it("adds a tab back through the target app's door, with a pass on the host", async () => {
    const { ada, host, target, grant } = await pair();
    h.appAnswer = answerTab('back-1');
    const made = await body<ConnectionMade>(
      await connect(ada.auth, host.id, { targetId: target.id, tabId: 't', both: true }, grant),
    );
    expect(made.reverse).toEqual({
      state: 'made',
      connection: { id: expect.stringMatching(/^cn_/), app: 'livediagram', itemId: host.id },
      tabId: 'back-1',
    });
    const back = rows('connections', 'host_item_id = ?', target.id)[0]!;
    const [door] = doorCalls();
    expect(door).toMatchObject({
      method: 'POST',
      url: `https://liveplanner.app/api/internal/items/${target.id}/connected-tabs`,
      body: { name: 'Flow', connection: { app: 'livediagram', itemId: host.id } },
    });
    expect(door!.headers.get('Authorization')).toBe('Bearer lp-key');
    expect(door!.headers.get('X-Index-App')).toBe('liveplanner');
    expect((door!.body as { connection: { id: string } }).connection.id).toBe(back.id);
    const forward = rows('connections', 'id = ?', made.connection.id)[0]!;
    expect(back).toMatchObject({
      host_tab_id: 'back-1',
      target_item_id: host.id,
      pair_id: forward.id,
      confirmed_at: expect.any(Number),
    });
    expect(forward.pair_id).toBe(back.id);
    expect(rows('share_links', 'item_id = ?', host.id)).toEqual([
      expect.objectContaining({ code: back.share_code, level: 'edit' }),
    ]);
    expect(rows('timeline_events', "item_id = ? AND type = 'shared'", host.id)).toHaveLength(1);
  });

  it('takes the reverse back when the door fails, answers badly or the caps refuse it', async () => {
    const { ada, host, target, grant } = await pair();
    for (const [answer, tab] of [
      [
        () => {
          throw new TypeError('network down');
        },
        't0',
      ],
      [answerTab('x', 500), 't1'],
      [answerTab(42), 't2'],
      [() => new Response('not json', { status: 200 }), 't3'],
    ] as const) {
      h.appAnswer = answer;
      const made = await body<ConnectionMade>(
        await connect(ada.auth, host.id, { targetId: target.id, tabId: tab, both: true }, grant),
      );
      expect(made.reverse).toEqual({ state: 'unreached' });
      // The host's own connection stands, unpaired.
      expect(rows('connections', 'id = ?', made.connection.id)[0]).toMatchObject({ pair_id: null });
    }
    expect(rows('connections', 'host_item_id = ?', target.id)).toEqual([]);
    expect(rows('share_links', 'item_id = ?', host.id)).toEqual([]);
    expect(rows('timeline_events', "item_id = ? AND type = 'shared'", host.id)).toEqual([]);

    // The host's links full: no reverse is written, and the door is never called.
    h.appCalls = [];
    const fill = h.db.sql.prepare(
      "INSERT INTO share_links (code, item_id, level, created_at) VALUES (?, ?, 'view', 1)",
    );
    for (let i = 0; i < SHARE_LINKS_PER_ITEM; i++) fill.run(`FILL${i}`, host.id);
    const capped = await body<ConnectionMade>(
      await connect(ada.auth, host.id, { targetId: target.id, tabId: 't4', both: true }, grant),
    );
    expect(capped.reverse).toEqual({ state: 'unreached' });
    expect(doorCalls()).toEqual([]);
  });

  it("gives the reverse the host app's default role when it does not offer the one chosen", async () => {
    const { ada, host, target, grant } = await pair({ host: 'livehuddle' });
    h.appAnswer = answerTab('back');
    const made = await body<ConnectionMade>(
      await connect(
        ada.auth,
        host.id,
        { targetId: target.id, tabId: 't', level: 'view', both: true },
        grant,
      ),
    );
    expect(made).toMatchObject({ level: 'view', reverse: { state: 'made' } });
    expect(rows('share_links', 'item_id = ?', host.id)[0]).toMatchObject({
      level: connectionDefaultLevel('livehuddle'),
    });
  });
});

describe('opening a connection', () => {
  async function made() {
    const p = await pair();
    const res = await connect(
      p.ada.auth,
      p.host.id,
      { targetId: p.target.id, tabId: 't' },
      p.grant,
    );
    const connection = (await body<ConnectionMade>(res)).connection;
    const code = rows('connections', 'id = ?', connection.id)[0]!.share_code as string;
    return { ...p, id: connection.id, code };
  }

  it("sends the target's own people to it, and everyone else through the pass", async () => {
    const { ada, host, target, grant, id, code } = await made();
    const own = await open(id, grant, ada.auth);
    expect(own.status).toBe(200);
    expect(own.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await body<ConnectionOpen>(own)).toEqual({
      app: 'liveplanner',
      itemId: target.id,
      name: 'Roadmap',
      href: `http://localhost:3200/project/${target.id}`,
      via: 'item',
      level: null,
    });
    // A Viewer of the host by link, signed in or not, gets the pass at its role.
    const viewCode = (await link(ada.auth, host.id, { level: 'view' })).code;
    const bob = await person('user_b');
    for (const auth of [bob.auth, null]) {
      const visitorGrant = await grantFor(auth, host.id, viewCode);
      const res = await open(id, visitorGrant, auth);
      expect(await body<ConnectionOpen>(res)).toMatchObject({
        via: 'link',
        level: 'edit',
        href: `http://localhost:3200/project/shared?s=${code}`,
      });
    }
  });

  it('builds the address from the registry for each deployment', async () => {
    const { grant, id, code } = await made();
    for (const [environment, origin] of [
      ['production', 'https://www.liveplanner.app'],
      ['staging', 'https://staging.liveplanner.app'],
    ]) {
      const res = await call(`/connections/${id}`, {
        headers: { [GRANT]: grant },
        env: { ...h.db.env, ENVIRONMENT: environment! },
      });
      expect((await body<ConnectionOpen>(res)).href).toBe(`${origin}/project/shared?s=${code}`);
    }
  });

  it('opens nothing for a copy, another tab, a public link, an agent or a malformed id', async () => {
    const { ada, host, target, grant, id } = await made();
    expect((await open('cn_unknownunknownunknown1', grant)).status).toBe(404);
    expect((await open('nope', grant)).status).toBe(404);
    expect((await call(`/connections/${id}`)).status).toBe(404);
    expect((await call(`/connections/${id}/x`, { headers: { [GRANT]: grant } })).status).toBe(404);
    expect(
      (await call(`/connections/${id}`, { method: 'PATCH', headers: { [GRANT]: grant } })).status,
    ).toBe(404);
    // A copy of the tab, in another item: that item's grant opens nothing.
    expect((await open(id, await grantFor(ada.auth, target.id))).status).toBe(404);
    const bob = await person('user_b');
    const other = (await link(ada.auth, host.id, { level: 'edit', tabId: 'other' })).code;
    expect((await open(id, await grantFor(bob.auth, host.id, other))).status).toBe(404);
    const same = (await link(ada.auth, host.id, { level: 'view', tabId: 't' })).code;
    expect((await open(id, await grantFor(bob.auth, host.id, same))).status).toBe(200);
    // A Community post's link opens no connection.
    const pub = (await link(ada.auth, host.id, { public: true })).code;
    expect((await open(id, await grantFor(null, host.id, pub))).status).toBe(404);
    const agent = await call(`/connections/${id}`, {
      auth: 'ld-key',
      headers: { [GRANT]: grant, 'X-Index-App': 'livediagram', 'X-Index-Person': 'user_a' },
    });
    expect(agent.status).toBe(404);
  });

  it('says the target is gone, or its pass removed', async () => {
    const { ada, host, target, grant, id, code } = await made();
    const bob = await person('user_b');
    const viewer = await grantFor(bob.auth, host.id, (await link(ada.auth, host.id)).code);
    expect((await call(`/share/${code}`, { method: 'DELETE', auth: ada.auth })).status).toBe(204);
    expect(rows('connections', 'id = ?', id)[0]).toMatchObject({ share_code: null });
    const removed = await open(id, viewer, bob.auth);
    expect(removed.status).toBe(410);
    expect(await body(removed)).toEqual({ error: 'connection_link_removed' });
    // Its owner still goes straight to it.
    expect((await open(id, grant, ada.auth)).status).toBe(200);

    await call(`/items/${target.id}`, { method: 'DELETE', auth: ada.auth });
    expect(await body(await open(id, grant, ada.auth))).toEqual({
      error: 'connection_target_gone',
    });
    await call(`/items/${target.id}?permanent=true`, { method: 'DELETE', auth: ada.auth });
    expect(rows('connections', 'id = ?', id)[0]).toMatchObject({ target_item_id: null });
    expect((await open(id, grant, ada.auth)).status).toBe(410);
  });

  it('treats a lapsed pass as removed', async () => {
    const { ada, host, id, code } = await made();
    h.db.sql.prepare('UPDATE share_links SET expires_at = 1 WHERE code = ?').run(code);
    const viewer = await grantFor(null, host.id, (await link(ada.auth, host.id)).code);
    expect(await body(await open(id, viewer))).toEqual({ error: 'connection_link_removed' });
  });

  it('refuses a grant the index signed with a claim it never writes', async () => {
    const { host, id } = await made();
    const { importJWK, SignJWT } = await import('jose');
    const key = await importJWK(JSON.parse(grantSecret), 'ES256');
    const forged = await new SignJWT({ item: host.id, level: 'admin', tab: null })
      .setProtectedHeader({ alg: 'ES256', kid: 'grant-1' })
      .setIssuer('https://liveworkspace.app/api/index')
      .setAudience('livediagram')
      .setSubject('user_a')
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti('j1')
      .sign(key);
    expect((await open(id, forged)).status).toBe(404);
  });

  it('limits opens per person, else per network', async () => {
    const { ada, grant, id } = await made();
    const keys: string[] = [];
    const env = {
      ...h.db.env,
      CONNECTION_OPEN_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: false };
        },
      },
    };
    const limited = await call(`/connections/${id}`, {
      auth: ada.auth,
      headers: { [GRANT]: grant },
      env,
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    await call(`/connections/${id}`, {
      headers: { [GRANT]: grant, 'CF-Connecting-IP': '203.0.113.9' },
      env,
    });
    expect(keys[0]).toBe('p:user_a');
    expect(keys[1]).toContain('203.0.113.9');
  });
});

describe('taking a connection back', () => {
  it('deletes an unconfirmed connection and its pass, for an Editor of its host', async () => {
    const { ada, host, target, grant } = await pair();
    const { connection } = await body<ConnectionMade>(
      await connect(ada.auth, host.id, { targetId: target.id, tabId: 't' }, grant),
    );
    const code = rows('connections')[0]!.share_code as string;
    // A Viewer of the host may not.
    const viewer = await grantFor(
      null,
      host.id,
      (await link(ada.auth, host.id, { level: 'view' })).code,
    );
    expect(
      (
        await call(`/connections/${connection.id}`, {
          method: 'DELETE',
          headers: { [GRANT]: viewer },
        })
      ).status,
    ).toBe(404);
    await settle();
    h.appCalls = [];
    const res = await call(`/connections/${connection.id}`, {
      method: 'DELETE',
      auth: ada.auth,
      headers: { [GRANT]: grant },
    });
    expect(res.status).toBe(204);
    expect(rows('connections')).toEqual([]);
    expect(rows('share_links', 'code = ?', code)).toEqual([]);
    expect(rows('timeline_events', "item_id = ? AND type = 'unshared'", target.id)).toHaveLength(1);
    await settle();
    expect(h.appCalls.map((c) => [c.url, c.body])).toEqual([
      [`https://liveplanner.app/api/internal/items/${target.id}/revoke`, { codes: [code] }],
    ]);
  });

  it('lets a signed-out Editor by link take one back, and one whose pass already went', async () => {
    const { ada, host, target, grant } = await pair();
    const editor = await grantFor(
      null,
      host.id,
      (await link(ada.auth, host.id, { level: 'edit' })).code,
    );
    const ids: string[] = [];
    for (const tab of ['t1', 't2']) {
      const made = await body<ConnectionMade>(
        await connect(ada.auth, host.id, { targetId: target.id, tabId: tab }, grant),
      );
      ids.push(made.connection.id);
    }
    const code = rows('connections', 'id = ?', ids[1]!)[0]!.share_code as string;
    await call(`/share/${code}`, { method: 'DELETE', auth: ada.auth });
    const before = rows('timeline_events', "type = 'unshared'").length;
    for (const id of ids) {
      const res = await call(`/connections/${id}`, {
        method: 'DELETE',
        headers: { [GRANT]: editor },
      });
      expect(res.status).toBe(204);
    }
    expect(rows('connections')).toEqual([]);
    // One event for the pass it ended (no one signed in did it); none for the one already gone.
    const events = rows('timeline_events', "type = 'unshared'");
    expect(events).toHaveLength(before + 1);
    expect(events.at(-1)).toMatchObject({ actor_id: null });
  });

  it('leaves a confirmed connection to its tab', async () => {
    const { ada, host, target, grant } = await pair();
    const { connection } = await body<ConnectionMade>(
      await connect(ada.auth, host.id, { targetId: target.id, tabId: 't' }, grant),
    );
    h.db.sql.prepare('UPDATE connections SET confirmed_at = 5').run();
    const res = await call(`/connections/${connection.id}`, {
      method: 'DELETE',
      headers: { [GRANT]: grant },
    });
    expect(res.status).toBe(204);
    expect(rows('connections')).toHaveLength(1);
  });
});
