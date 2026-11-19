// A file made beside an item over HTTP (liveworkspace/docs/specs/004-index/connected-tabs.md "A file made beside it",
// Work Tracker 1281): who may (a guest, an agent, a host Viewer, Participant or Editor by link), the limit, the template door's call
// and folder, a failed door, a refused connection taking the made file away, and both ways.
import {
  CONNECTIONS_PER_ITEM,
  type ConnectionMade,
  type ShareLink,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

const APPS = ['livediagram', 'liveplanner', 'livedocuments'] as const;
useHarness(
  Object.fromEntries(
    APPS.flatMap((app) => [
      [`INDEX_KEY_${app.toUpperCase()}`, `${app}-key`],
      [`APP_ORIGIN_${app.toUpperCase()}`, `https://${app}.app`],
    ]),
  ),
);

const GRANT = 'X-Index-Grant';
const appOf = (c: AppCall) => new URL(c.url).hostname.replace(/\.app$/, '');
const doorCalls = () => h.appCalls.filter((c) => c.url.endsWith('/items/from-template'));
const rows = <T = Record<string, unknown>>(sql: string, ...args: string[]) =>
  h.db.sql.prepare(sql).all(...args) as T[];

// The apps' doors as the apps answer: the template door makes the owner's item through the index's own create (as
// `auth`), the connected tab door names a new tab.
function answerDoors(auth: string, doors: { failMake?: boolean; teamId?: string } = {}) {
  h.appAnswer = async (c) => {
    if (c.url.endsWith('/items/from-template')) {
      if (doors.failMake) return new Response(null, { status: 503 });
      const input = c.body as { folderId: string | null; name: string };
      const item = await makeItem(auth, {
        app: appOf(c),
        title: input.name,
        ...(input.folderId ? { folderId: input.folderId } : {}),
        ...(doors.teamId ? { teamId: doors.teamId } : {}),
      });
      return Response.json({ id: item.id }, { status: 201 });
    }
    if (c.url.endsWith('/connected-tabs'))
      return Response.json({ tabId: 'back-1' }, { status: 201 });
    return new Response(null, { status: 200 });
  };
}

async function grantFor(auth: string, itemId: string, code?: string): Promise<string> {
  const res = await call(`/items/${itemId}/grant`, {
    method: 'POST',
    auth,
    headers: code ? { 'X-Share-Code': code } : {},
  });
  expect(res.status).toBe(200);
  return (await body<{ grant: string }>(res)).grant;
}

const beside = (
  auth: string | null,
  hostId: string,
  input: Record<string, unknown>,
  grant: string | null,
  extra: { headers?: Record<string, string>; env?: typeof h.db.env } = {},
) =>
  call(`/items/${hostId}/beside`, {
    method: 'POST',
    auth,
    body: input,
    headers: { ...(grant ? { [GRANT]: grant } : {}), ...extra.headers },
    ...(extra.env ? { env: extra.env } : {}),
  });

async function link(auth: string, itemId: string, input: Record<string, unknown>) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: input });
  expect(res.status).toBe(201);
  return (await body<{ link: ShareLink }>(res)).link;
}

// Ada's design doc in a folder of hers, with her grant on it.
async function host() {
  const ada = await person('user_a');
  const folder = await body<{ folder: { id: string } }>(
    await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Sync' } }),
  );
  const doc = await makeItem(ada.auth, {
    app: 'livedocuments',
    title: 'Offline Sync',
    folderId: folder.folder.id,
  });
  const grant = await grantFor(ada.auth, doc.id);
  await settle();
  h.appCalls = [];
  return { ada, doc, grant, folderId: folder.folder.id };
}

describe('making a plan beside an item', () => {
  it('makes the person a Project Planner beside the host, in its folder, and connects it in the tab', async () => {
    const { ada, doc, grant, folderId } = await host();
    answerDoors(ada.auth);
    const res = await beside(ada.auth, doc.id, { offer: 'plan', tabId: 'tab-9' }, grant);
    expect(res.status).toBe(201);
    const made = await body<ConnectionMade>(res);
    expect(doorCalls().map((c) => [appOf(c), c.body])).toEqual([
      [
        'liveplanner',
        { owner: 'user_a', folderId, name: 'Offline Sync Plan', template: 'project-planner' },
      ],
    ]);
    expect(made).toMatchObject({
      connection: { app: 'liveplanner' },
      name: 'Offline Sync Plan',
      level: 'edit',
      reverse: null,
    });
    const [plan] = rows<{ id: string; folder_id: string; owner_id: string }>(
      "SELECT id, folder_id, owner_id FROM items WHERE app = 'liveplanner'",
    );
    expect(plan).toEqual({ id: made.connection.itemId, folder_id: folderId, owner_id: 'user_a' });
    expect(rows('SELECT host_item_id, host_tab_id, target_item_id FROM connections')).toEqual([
      { host_item_id: doc.id, host_tab_id: 'tab-9', target_item_id: plan!.id },
    ]);
  });

  it('connects both ways at the chosen role when asked', async () => {
    const { ada, doc, grant } = await host();
    answerDoors(ada.auth);
    const res = await beside(
      ada.auth,
      doc.id,
      { offer: 'plan', tabId: 'tab-9', level: 'view', both: true },
      grant,
    );
    expect(res.status).toBe(201);
    const made = await body<ConnectionMade>(res);
    expect(made.level).toBe('view');
    expect(made.reverse).toMatchObject({ state: 'made', tabId: 'back-1' });
  });

  it("puts the plan at the top of the person's My Work beside someone else's host", async () => {
    const { ada, doc } = await host();
    const bob = await person('user_b');
    const code = (await link(ada.auth, doc.id, { level: 'edit' })).code;
    expect((await call(`/share/${code}`, { auth: bob.auth })).status).toBe(200);
    const grant = await grantFor(bob.auth, doc.id, code);
    h.appCalls = [];
    answerDoors(bob.auth);
    const res = await beside(bob.auth, doc.id, { offer: 'plan', tabId: 't1' }, grant);
    expect(res.status).toBe(201);
    expect((doorCalls()[0]!.body as { folderId: unknown }).folderId).toBeNull();
    // Both ways shares the host, which Bob reaches only by a link: refused, and the plan made for it goes.
    const both = await beside(bob.auth, doc.id, { offer: 'plan', tabId: 't2', both: true }, grant);
    expect(both.status).toBe(403);
    await settle();
    expect(
      rows("SELECT id FROM items WHERE app = 'liveplanner' AND owner_id = 'user_b'"),
    ).toHaveLength(1);
  });
});

describe('who may make one', () => {
  it('refuses nobody, a guest and an app acting for a person before any door is called', async () => {
    const { doc, grant } = await host();
    expect((await beside(null, doc.id, { offer: 'plan', tabId: 't' }, grant)).status).toBe(401);
    const guest = await person('guest_g1', { guest: true });
    const res = await beside(guest.auth, doc.id, { offer: 'plan', tabId: 't' }, grant);
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: 'sign_in_required' });
    const agent = await beside('livedocuments-key', doc.id, { offer: 'plan', tabId: 't' }, grant, {
      headers: { 'X-Index-App': 'livedocuments', 'X-Index-Person': 'user_a' },
    });
    expect(agent.status).toBe(403);
    expect(doorCalls()).toEqual([]);
  });

  it("refuses a Viewer or Participant of the host, another item's grant, a malformed body and another method", async () => {
    const { ada, doc, grant } = await host();
    const bob = await person('user_b');
    const code = (await link(ada.auth, doc.id, { level: 'view' })).code;
    const viewer = await grantFor(bob.auth, doc.id, code);
    answerDoors(bob.auth);
    expect((await beside(bob.auth, doc.id, { offer: 'plan', tabId: 't' }, viewer)).status).toBe(
      403,
    );
    const cara = await person('user_c');
    const joinCode = (await link(ada.auth, doc.id, { level: 'participate' })).code;
    const participant = await grantFor(cara.auth, doc.id, joinCode);
    expect(
      (await beside(cara.auth, doc.id, { offer: 'plan', tabId: 't' }, participant)).status,
    ).toBe(403);
    const other = await makeItem(ada.auth, { app: 'livedocuments' });
    expect((await beside(ada.auth, other.id, { offer: 'plan', tabId: 't' }, grant)).status).toBe(
      403,
    );
    expect((await beside(ada.auth, doc.id, { offer: 'deck', tabId: 't' }, grant)).status).toBe(400);
    expect((await call(`/items/${doc.id}/beside`, { auth: ada.auth })).status).toBe(404);
    expect(
      (await call(`/items/${doc.id}/beside/x`, { method: 'POST', auth: ada.auth })).status,
    ).toBe(404);
    expect(doorCalls()).toEqual([]);
  });
});

describe('when it fails', () => {
  it('answers 503 and connects nothing when the template door fails', async () => {
    const { ada, doc, grant } = await host();
    answerDoors(ada.auth, { failMake: true });
    const res = await beside(ada.auth, doc.id, { offer: 'plan', tabId: 't' }, grant);
    expect(res.status).toBe(503);
    expect(await body(res)).toEqual({ error: 'unavailable' });
    expect(rows('SELECT * FROM connections')).toEqual([]);
  });

  it("answers 503 for a made item that is not the person's own", async () => {
    const { ada, doc, grant } = await host();
    const bob = await person('user_b');
    answerDoors(bob.auth);
    const res = await beside(ada.auth, doc.id, { offer: 'plan', tabId: 't' }, grant);
    expect(res.status).toBe(503);
    expect(rows('SELECT * FROM connections')).toEqual([]);
  });

  it('takes the made plan away when the host can hold no more connections', async () => {
    const { ada, doc, grant } = await host();
    const now = Date.now();
    const insert = h.db.sql.prepare(
      `INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at)
       VALUES (?, ?, ?, NULL, NULL, NULL, ?)`,
    );
    for (let i = 0; i < CONNECTIONS_PER_ITEM; i += 1)
      insert.run(`cn_${'x'.repeat(20)}${i}`, doc.id, `t${i}`, now);
    answerDoors(ada.auth);
    const res = await beside(ada.auth, doc.id, { offer: 'plan', tabId: 'new' }, grant);
    expect(res.status).toBe(409);
    expect(await body(res)).toEqual({ error: 'connection_limit' });
    await settle();
    expect(rows("SELECT id FROM items WHERE app = 'liveplanner'")).toEqual([]);
  });

  it('answers 429 past the per-person limit, before anything is made', async () => {
    const { ada, doc, grant } = await host();
    answerDoors(ada.auth);
    const keys: string[] = [];
    const env = {
      ...h.db.env,
      KIT_RUN_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: false };
        },
      },
    };
    const res = await beside(ada.auth, doc.id, { offer: 'plan', tabId: 't' }, grant, { env });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(keys).toEqual(['beside:user_a']);
    expect(doorCalls()).toEqual([]);
  });
});
