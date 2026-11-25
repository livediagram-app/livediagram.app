// Connect as tabs over HTTP (liveworkspace/docs/specs/004-index/connected-tabs.md "Linked from a Send to", Work Tracker
// 1429): how two files stand, each given a tab for the other through its app's door, never twice, one way where the
// person may change only one, the open door's own access, and removing either side removing both.
import {
  appConnectionPath,
  CONNECTIONS_PER_ITEM,
  type ConnectionOpen,
  type LinkedTabsMade,
  type LinkedTabsRead,
  type ShareLink,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { body, call, h, makeItem, person, settle, useHarness, type AppCall } from './test-support';

useHarness();

const GRANT = 'X-Index-Grant';

const rows = (table: string, where = '1 = 1', ...args: string[]) =>
  h.db.sql.prepare(`SELECT * FROM ${table} WHERE ${where}`).all(...args) as Record<
    string,
    unknown
  >[];

const read = (auth: string | null, source: string, target: string) =>
  call(`/items/${source}/linked-tabs?with=${target}`, { auth });
const link = (auth: string | null, source: string, target: unknown) =>
  call(`/items/${source}/linked-tabs`, { method: 'POST', auth, body: { targetId: target } });

// Each app's door answers a fresh tab id per call; `refuse` names apps whose door fails.
function answerTabs(refuse: readonly string[] = []) {
  let n = 0;
  h.appAnswer = (c: AppCall) => {
    if (!c.url.endsWith('/connected-tabs')) return new Response(null, { status: 200 });
    if (refuse.some((app) => c.url.includes(`${app}.app`)))
      return new Response(null, { status: 503 });
    n += 1;
    return Response.json({ tabId: `tab-${n}` }, { status: 201 });
  };
}

async function world() {
  const ada = await person('user_a');
  const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Retro' });
  const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
  await settle();
  h.appCalls = [];
  answerTabs();
  return { ada, doc, plan };
}

async function shareLink(auth: string, itemId: string, level: string) {
  const res = await call(`/items/${itemId}/share`, { method: 'POST', auth, body: { level } });
  expect(res.status).toBe(201);
  return (await body<{ link: ShareLink }>(res)).link.code;
}

async function grantFor(auth: string | null, itemId: string, code?: string) {
  const res = await call(`/items/${itemId}/grant`, {
    method: 'POST',
    auth,
    headers: code ? { 'X-Share-Code': code } : {},
  });
  expect(res.status).toBe(200);
  return (await body<{ grant: string }>(res)).grant;
}

const doorCalls = () => h.appCalls.filter((c) => c.url.includes('/connected-tabs'));

describe('reading how two files stand', () => {
  it('answers each side for its owner, then connected once linked', async () => {
    const { ada, doc, plan } = await world();
    const res = await read(ada.auth, doc.id, plan.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await body<LinkedTabsRead>(res)).toEqual({ source: 'can', target: 'can' });
    expect((await link(ada.auth, doc.id, plan.id)).status).toBe(201);
    expect(await body<LinkedTabsRead>(await read(ada.auth, plan.id, doc.id))).toEqual({
      source: 'connected',
      target: 'connected',
    });
  });

  it('refuses a guest, an app acting for a person, the same file, and one the person cannot read', async () => {
    const { ada, doc, plan } = await world();
    expect((await read(null, doc.id, plan.id)).status).toBe(401);
    const guest = await person('guest_g', { guest: true });
    expect((await read(guest.auth, doc.id, plan.id)).status).toBe(403);
    const agent = await call(`/items/${doc.id}/linked-tabs?with=${plan.id}`, {
      auth: 'ld-key',
      headers: { 'X-Index-App': 'livediagram', 'X-Index-Person': 'user_a' },
    });
    expect(agent.status).toBe(403);
    expect(await body(await read(ada.auth, doc.id, doc.id))).toEqual({ error: 'connection_self' });
    const ben = await person('user_b');
    const bens = await makeItem(ben.auth, { app: 'liveplanner' });
    expect((await read(ada.auth, doc.id, bens.id)).status).toBe(404);
    expect((await read(ada.auth, doc.id, 'bad id')).status).toBe(404);
    expect(
      (await call(`/items/${doc.id}/linked-tabs`, { method: 'PUT', auth: ada.auth })).status,
    ).toBe(404);
  });

  it('says cannot for a file the person only views, or reaches by a tab-scoped link', async () => {
    const { ada, doc, plan } = await world();
    const ben = await person('user_b');
    const bens = await makeItem(ben.auth, { app: 'liveplanner', title: 'Bens' });
    const viewCode = await shareLink(ada.auth, doc.id, 'view');
    expect((await call(`/share/${viewCode}`, { auth: ben.auth })).status).toBe(200);
    expect(await body<LinkedTabsRead>(await read(ben.auth, doc.id, bens.id))).toEqual({
      source: 'cannot',
      target: 'can',
    });
    const res = await call(`/items/${plan.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'edit', tabId: 'only' },
    });
    const scoped = (await body<{ link: ShareLink }>(res)).link.code;
    expect((await call(`/share/${scoped}`, { auth: ben.auth })).status).toBe(200);
    expect(await body<LinkedTabsRead>(await read(ben.auth, plan.id, bens.id))).toEqual({
      source: 'cannot',
      target: 'can',
    });
  });
  it('answers missing for no other file, an unreadable source, and a file in the trash or archived', async () => {
    const { ada, doc, plan } = await world();
    expect((await call(`/items/${doc.id}/linked-tabs`, { auth: ada.auth })).status).toBe(404);
    const ben = await person('user_b');
    const bens = await makeItem(ben.auth, { app: 'liveplanner' });
    expect((await read(ada.auth, bens.id, plan.id)).status).toBe(404);
    h.db.sql.prepare('UPDATE items SET trashed_at = 1 WHERE id = ?').run(plan.id);
    expect((await read(ada.auth, doc.id, plan.id)).status).toBe(404);
    h.db.sql
      .prepare('UPDATE items SET trashed_at = NULL, archived_at = 1 WHERE id = ?')
      .run(plan.id);
    expect((await link(ada.auth, doc.id, plan.id)).status).toBe(404);
    expect(doorCalls()).toEqual([]);
  });

  it('counts a linked tab still on its way in as connected', async () => {
    const { ada, doc, plan } = await world();
    h.db.sql
      .prepare(
        `INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at, linked)
         VALUES ('cn_inflight000000000000', ?, NULL, ?, NULL, NULL, 1, 1)`,
      )
      .run(doc.id, plan.id);
    expect(await body<LinkedTabsRead>(await read(ada.auth, doc.id, plan.id))).toEqual({
      source: 'connected',
      target: 'can',
    });
  });
});

describe('linking two files', () => {
  it('gives each its tab through its own app, pairs them, and shares nothing', async () => {
    const { ada, doc, plan } = await world();
    const res = await link(ada.auth, doc.id, plan.id);
    expect(res.status).toBe(201);
    expect(await body<LinkedTabsMade>(res)).toEqual({ source: 'made', target: 'made' });
    const calls = doorCalls();
    expect(calls.map((c) => new URL(c.url).pathname).sort()).toEqual(
      [
        `/api/internal/items/${doc.id}/connected-tabs`,
        `/api/internal/items/${plan.id}/connected-tabs`,
      ].sort(),
    );
    const toDoc = calls.find((c) => c.url.includes('livediagram'))!.body as Record<string, unknown>;
    expect(toDoc).toEqual({
      name: 'Launch',
      connection: { id: expect.stringMatching(/^cn_/), app: 'liveplanner', itemId: plan.id },
    });
    const made = rows('connections');
    expect(made).toHaveLength(2);
    for (const r of made) {
      expect(r).toMatchObject({ linked: 1, share_code: null, confirmed_at: expect.any(Number) });
      expect(r.host_tab_id).toMatch(/^tab-/);
    }
    expect(made[0]!.pair_id).toBe(made[1]!.id);
    expect(made[1]!.pair_id).toBe(made[0]!.id);
    // No pass, no shared event, no notice.
    expect(rows('share_links')).toEqual([]);
    expect(rows('events', "type = 'shared'")).toEqual([]);
  });

  it('never adds a second tab when sent again, either way round', async () => {
    const { ada, doc, plan } = await world();
    await link(ada.auth, doc.id, plan.id);
    h.appCalls = [];
    const again = await link(ada.auth, plan.id, doc.id);
    expect(again.status).toBe(200);
    expect(await body<LinkedTabsMade>(again)).toEqual({ source: 'connected', target: 'connected' });
    expect(doorCalls()).toEqual([]);
    expect(rows('connections')).toHaveLength(2);
  });

  it('connects one way where the person may change only one file', async () => {
    const { ada, doc } = await world();
    const ben = await person('user_b');
    const bens = await makeItem(ben.auth, { app: 'liveplanner', title: 'Bens' });
    const viewCode = await shareLink(ada.auth, doc.id, 'view');
    await call(`/share/${viewCode}`, { auth: ben.auth });
    h.appCalls = [];
    const res = await link(ben.auth, doc.id, bens.id);
    expect(await body<LinkedTabsMade>(res)).toEqual({ source: 'cannot', target: 'made' });
    expect(doorCalls().map((c) => new URL(c.url).pathname)).toEqual([
      `/api/internal/items/${bens.id}/connected-tabs`,
    ]);
    expect(rows('connections')).toEqual([
      expect.objectContaining({ host_item_id: bens.id, target_item_id: doc.id, pair_id: null }),
    ]);
    // Neither file theirs to change: nothing at all.
    const other = await makeItem(ben.auth, { app: 'livedocuments' });
    const othersView = await shareLink(ben.auth, other.id, 'view');
    const dan = await person('user_d');
    await call(`/share/${viewCode}`, { auth: dan.auth });
    await call(`/share/${othersView}`, { auth: dan.auth });
    h.appCalls = [];
    expect(await body<LinkedTabsMade>(await link(dan.auth, doc.id, other.id))).toEqual({
      source: 'cannot',
      target: 'cannot',
    });
    expect(doorCalls()).toEqual([]);
  });

  it('takes back a side whose app could not be reached, keeping the other', async () => {
    const { ada, doc, plan } = await world();
    answerTabs(['livediagram']);
    const res = await link(ada.auth, doc.id, plan.id);
    expect(await body<LinkedTabsMade>(res)).toEqual({ source: 'unreached', target: 'made' });
    const left = rows('connections');
    expect(left).toEqual([expect.objectContaining({ host_item_id: plan.id, pair_id: null })]);
    // An answer without a tab id is no tab either.
    h.appAnswer = (c) =>
      c.url.endsWith('/connected-tabs') ? Response.json({}) : new Response(null, { status: 200 });
    expect(await body<LinkedTabsMade>(await link(ada.auth, doc.id, plan.id))).toEqual({
      source: 'unreached',
      target: 'connected',
    });
  });

  it('says full for a file holding as many connected tabs as it may', async () => {
    const { ada, doc, plan } = await world();
    const stmt = h.db.sql.prepare(
      `INSERT INTO connections (id, host_item_id, host_tab_id, target_item_id, share_code, pair_id, created_at, linked)
       VALUES (?, ?, ?, NULL, NULL, NULL, 1, 1)`,
    );
    for (let i = 0; i < CONNECTIONS_PER_ITEM; i += 1)
      stmt.run(`cn_fill${String(i).padStart(20, '0')}`, doc.id, `t${i}`);
    expect(await body<LinkedTabsMade>(await link(ada.auth, doc.id, plan.id))).toEqual({
      source: 'full',
      target: 'made',
    });
  });

  it("pairs a new tab with the other file's own tab towards it", async () => {
    const { ada, doc, plan } = await world();
    // View As Diagram's tab in the plan, made as Connect File makes one, one way.
    const grant = await grantFor(ada.auth, plan.id);
    const made = await call(`/items/${plan.id}/connections`, {
      method: 'POST',
      auth: ada.auth,
      body: { targetId: doc.id, tabId: 'plan-tab' },
      headers: { [GRANT]: grant },
    });
    expect(made.status).toBe(201);
    h.appCalls = [];
    expect(await body<LinkedTabsMade>(await link(ada.auth, plan.id, doc.id))).toEqual({
      source: 'connected',
      target: 'made',
    });
    const [forward] = rows('connections', 'host_item_id = ?', plan.id);
    const [back] = rows('connections', 'host_item_id = ?', doc.id);
    expect(back).toMatchObject({ linked: 1, pair_id: forward!.id });
    expect(forward!.pair_id).toBe(back!.id);
  });

  it('reads its body', async () => {
    const { ada, doc } = await world();
    expect((await link(ada.auth, doc.id, 7)).status).toBe(400);
    expect((await link(null, doc.id, doc.id)).status).toBe(401);
  });

  it('refuses to link a file with itself', async () => {
    const { ada, doc } = await world();
    const res = await link(ada.auth, doc.id, doc.id);
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ error: 'connection_self' });
    expect(rows('connections')).toEqual([]);
  });

  it('names a tab for a file without a title Untitled', async () => {
    const { ada, doc, plan } = await world();
    h.db.sql.prepare("UPDATE items SET title = '  ' WHERE id = ?").run(plan.id);
    expect((await link(ada.auth, doc.id, plan.id)).status).toBe(201);
    const toDoc = doorCalls().find((c) => c.url.includes('livediagram'))!.body as {
      name: string;
    };
    expect(toDoc.name).toBe('Untitled');
  });

  it('answers 429 past the per-person limit, before anything is made', async () => {
    const { ada, doc, plan } = await world();
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
    const res = await call(`/items/${doc.id}/linked-tabs`, {
      method: 'POST',
      auth: ada.auth,
      body: { targetId: plan.id },
      env,
    });
    expect(res.status).toBe(429);
    expect(keys).toEqual(['linked-tabs:user_a']);
    expect(doorCalls()).toEqual([]);
    expect(rows('connections')).toEqual([]);
  });
});

describe("liveplanner's agents", () => {
  it('link the source and the plan when a card asks, only where the person reads the source', async () => {
    const { ada, doc, plan } = await world();
    const ben = await person('user_b');
    const bens = await makeItem(ben.auth, { app: 'livediagram' });
    h.appCalls = [];
    const res = await call(`/app/items/${plan.id}/plan-sends`, {
      method: 'POST',
      auth: 'lp-key',
      headers: { 'X-Index-App': 'liveplanner' },
      body: {
        person: ada.id,
        cards: [
          {
            id: 'c1',
            title: 'One',
            column: 'To Do',
            done: false,
            sentFrom: { app: 'livediagram', itemId: doc.id, text: 'a', connectTabs: true },
          },
          {
            id: 'c2',
            title: 'Two',
            column: 'To Do',
            done: false,
            sentFrom: { app: 'livediagram', itemId: doc.id, text: 'b', connectTabs: true },
          },
          {
            id: 'c3',
            title: 'Three',
            column: 'To Do',
            done: false,
            sentFrom: { app: 'livediagram', itemId: bens.id, text: 'c', connectTabs: true },
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect(doorCalls()).toHaveLength(2);
    expect(
      rows('connections', 'host_item_id = ? OR host_item_id = ?', doc.id, plan.id),
    ).toHaveLength(2);
    expect(rows('connections', 'target_item_id = ? OR host_item_id = ?', bens.id, bens.id)).toEqual(
      [],
    );
  });
});

describe('opening a linked tab', () => {
  async function linked() {
    const w = await world();
    await link(w.ada.auth, w.doc.id, w.plan.id);
    const [toPlan] = rows('connections', 'host_item_id = ?', w.doc.id);
    return { ...w, id: toPlan!.id as string, tab: toPlan!.host_tab_id as string };
  }

  it('opens the file for someone who reaches it themselves', async () => {
    const { ada, doc, plan, id } = await linked();
    const grant = await grantFor(ada.auth, doc.id);
    const res = await call(`/connections/${id}`, { auth: ada.auth, headers: { [GRANT]: grant } });
    expect(res.status).toBe(200);
    expect(await body<ConnectionOpen>(res)).toMatchObject({
      app: 'liveplanner',
      itemId: plan.id,
      name: 'Launch',
      via: 'item',
      level: null,
    });
  });

  it("opens a team's file for a member who joined since their token was minted", async () => {
    const bea = await person('user_b', { teams: [{ id: 'team2' }] });
    const plan = await makeItem(bea.auth, {
      app: 'liveplanner',
      title: 'Team plan',
      teamId: 'team2',
    });
    const ada = await person('user_a', { teams: [] });
    const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Retro' });
    await settle();
    answerTabs();
    const tabs = h.appAnswer;
    // accounts says Ada is in team2 now, though her token predates it.
    h.appAnswer = (c) =>
      c.url.endsWith('/api/account/index/teams')
        ? Response.json({ teams: [{ id: 'team2', name: 'team2', role: 'member' }] })
        : tabs(c);
    expect(await body<LinkedTabsMade>(await link(ada.auth, doc.id, plan.id))).toEqual({
      source: 'made',
      target: 'made',
    });
    const [toPlan] = rows('connections', 'host_item_id = ?', doc.id);
    const grant = await grantFor(ada.auth, doc.id);
    const res = await call(`/connections/${toPlan!.id as string}`, {
      auth: ada.auth,
      headers: { [GRANT]: grant },
    });
    expect(res.status).toBe(200);
    expect(await body<ConnectionOpen>(res)).toMatchObject({
      itemId: plan.id,
      name: 'Team plan',
      via: 'item',
      level: null,
    });
  });

  it("goes by a reader's own link, and is locked to anyone without access", async () => {
    const { ada, doc, plan, id } = await linked();
    const ben = await person('user_b');
    const docCode = await shareLink(ada.auth, doc.id, 'view');
    expect((await call(`/share/${docCode}`, { auth: ben.auth })).status).toBe(200);
    const benGrant = await grantFor(ben.auth, doc.id, docCode);
    const locked = await call(`/connections/${id}`, {
      auth: ben.auth,
      headers: { [GRANT]: benGrant },
    });
    expect(locked.status).toBe(403);
    expect(await body(locked)).toEqual({ error: 'connection_locked' });
    // A guest reading the host by its link: locked too.
    const guestGrant = await grantFor(null, doc.id, docCode);
    expect((await call(`/connections/${id}`, { headers: { [GRANT]: guestGrant } })).status).toBe(
      403,
    );
    // Ben opens the plan's own link: the tab now goes by it.
    const planCode = await shareLink(ada.auth, plan.id, 'participate');
    await call(`/share/${planCode}`, { auth: ben.auth });
    const open = await call(`/connections/${id}`, {
      auth: ben.auth,
      headers: { [GRANT]: benGrant },
    });
    expect(await body<ConnectionOpen>(open)).toMatchObject({
      via: 'link',
      level: 'participate',
      href: expect.stringContaining(planCode),
    });
  });
});

describe('removing a linked tab', () => {
  const remove = (hostId: string, id: string, tab: string, app: string, key: string) =>
    call(appConnectionPath(hostId, id, tab), {
      method: 'DELETE',
      auth: key,
      headers: { 'X-Index-App': app },
    });

  it('from either side removes both, and asks the other app to take its tab away', async () => {
    const { ada, doc, plan } = await world();
    await link(ada.auth, doc.id, plan.id);
    const [inDoc] = rows('connections', 'host_item_id = ?', doc.id);
    const [inPlan] = rows('connections', 'host_item_id = ?', plan.id);
    h.appCalls = [];
    const res = await remove(
      doc.id,
      inDoc!.id as string,
      inDoc!.host_tab_id as string,
      'livediagram',
      'ld-key',
    );
    expect(res.status).toBe(204);
    await settle();
    expect(rows('connections')).toEqual([]);
    expect(h.appCalls.map((c) => `${c.method} ${c.url}`)).toContain(
      `DELETE https://liveplanner.app/api/internal/items/${plan.id}/connected-tabs/${inPlan!.id}`,
    );
    // Both files are still there.
    expect(rows('items', 'id IN (?, ?)', doc.id, plan.id)).toHaveLength(2);
  });

  it("takes the other side's pass with it when its own tab came from Connect File", async () => {
    const { ada, doc, plan } = await world();
    const grant = await grantFor(ada.auth, plan.id);
    await call(`/items/${plan.id}/connections`, {
      method: 'POST',
      auth: ada.auth,
      body: { targetId: doc.id, tabId: 'plan-tab' },
      headers: { [GRANT]: grant },
    });
    await link(ada.auth, plan.id, doc.id);
    expect(rows('share_links')).toHaveLength(1);
    const [inDoc] = rows('connections', 'host_item_id = ?', doc.id);
    h.appCalls = [];
    await remove(
      doc.id,
      inDoc!.id as string,
      inDoc!.host_tab_id as string,
      'livediagram',
      'ld-key',
    );
    await settle();
    expect(rows('connections')).toEqual([]);
    expect(rows('share_links')).toEqual([]);
    expect(rows('events', "type = 'unshared'")).toHaveLength(1);
    expect(
      h.appCalls.some(
        (c) => c.method === 'DELETE' && c.url.includes(`/items/${plan.id}/connected-tabs/cn_`),
      ),
    ).toBe(true);
  });

  it('keeps a Connect File pair as it was: removing one leaves the other', async () => {
    const { ada, doc, plan } = await world();
    const grant = await grantFor(ada.auth, doc.id);
    await call(`/items/${doc.id}/connections`, {
      method: 'POST',
      auth: ada.auth,
      body: { targetId: plan.id, tabId: 'doc-tab', both: true },
      headers: { [GRANT]: grant },
    });
    const [inDoc] = rows('connections', 'host_item_id = ?', doc.id);
    h.appCalls = [];
    await remove(doc.id, inDoc!.id as string, 'doc-tab', 'livediagram', 'ld-key');
    await settle();
    expect(rows('connections')).toHaveLength(1);
    expect(h.appCalls.some((c) => c.url.includes('/connected-tabs/'))).toBe(false);
  });

  it('logs a pair whose app could not take its tab away', async () => {
    const { ada, doc, plan } = await world();
    await link(ada.auth, doc.id, plan.id);
    const [inDoc] = rows('connections', 'host_item_id = ?', doc.id);
    h.appAnswer = () => new Response(null, { status: 503 });
    await remove(
      doc.id,
      inDoc!.id as string,
      inDoc!.host_tab_id as string,
      'livediagram',
      'ld-key',
    );
    await settle();
    expect(rows('connections')).toEqual([]);
  });
});
