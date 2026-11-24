// Start a Call Here on the index (liveworkspace/docs/specs/004-index/item-calls.md): a call needs an account and view
// on the item; one live call an item; the Participant link only to someone who reaches the item; the room's count
// tells the item's editors; the summary goes through the knowledgebase's door as the host; invites only to people who
// reach the item; Meetings show only the pages and plans the reader can open.
import type {
  InboxResponse,
  ItemCallStart,
  ItemCallsRead,
  SpaceCall,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { appSiteOrigin } from './connection-rows';
import { body, call, h, makeItem, person, settle, token, useHarness } from './test-support';

useHarness({
  INDEX_KEY_LIVEHUDDLE: 'lh-key',
  INDEX_KEY_LIVEKNOWLEDGE: 'lk-key',
  APP_ORIGIN_LIVEHUDDLE: 'https://www.livehuddle.app',
  APP_ORIGIN_LIVEKNOWLEDGE: 'https://www.liveknowledge.app',
});

const site = (app: 'livediagram' | 'livehuddle') => appSiteOrigin(h.db.env, app);

async function world() {
  const ada = await person('user_ada');
  const ben = await person('user_ben');
  const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Retro' });
  return { ada, ben, doc };
}

// The Space livehuddle's template door makes: an item of the starter's, made here first and answered by id.
async function spaceFor(auth: string, title = 'Retro Call') {
  const space = await makeItem(auth, { app: 'livehuddle', title });
  h.appCalls = [];
  h.appAnswer = (c) =>
    c.url.endsWith('/items/from-template')
      ? Response.json({ id: space.id })
      : new Response(null, { status: 200 });
  return space;
}

const start = (auth: string | null, itemId: string, headers?: Record<string, string>) =>
  call(`/items/${itemId}/calls`, { method: 'POST', auth, body: {}, headers });

const calls = async (auth: string, itemId: string) =>
  body<ItemCallsRead>(await call(`/items/${itemId}/calls`, { auth }));

const people = (spaceId: string, payload: unknown, app = 'livehuddle', key = 'lh-key') =>
  call(`/app/items/${spaceId}/call-people`, {
    method: 'PUT',
    auth: key,
    headers: { 'X-Index-App': app },
    body: payload,
  });

async function visit(owner: string, itemId: string, visitor: string, level = 'view') {
  const res = await call(`/items/${itemId}/share`, {
    method: 'POST',
    auth: owner,
    body: { level },
  });
  const { link } = await body<{ link: { code: string } }>(res);
  expect((await call(`/share/${link.code}`, { auth: visitor })).status).toBe(200);
  return link.code;
}

describe('starting a call', () => {
  it("makes a Document Room of the starter's with the item on its Screen, a Participant link on it, and tells the room the call", async () => {
    const { ada, doc } = await world();
    const space = await spaceFor(ada.auth);
    const res = await start(ada.auth, doc.id);
    expect(res.status).toBe(201);
    const { call: made, started } = await body<ItemCallStart>(res);
    expect(started).toBe(true);
    expect(made).toMatchObject({ spaceId: space.id, people: 0, live: true, names: [] });
    expect(made.link.startsWith(`${site('livehuddle')}/document/shared?s=`)).toBe(true);
    expect(h.appCalls[0]!.body).toEqual({
      owner: 'user_ada',
      folderId: null,
      name: 'Retro Call',
      template: 'document-room',
      screen: { app: doc.app, itemId: doc.id, name: 'Retro' },
    });
    const mark = h.appCalls.find((c) => c.url.endsWith(`/items/${space.id}/call`));
    expect(mark?.body).toEqual({ callId: made.id });
    // The link opens the Space as a Participant.
    const code = new URL(made.link).searchParams.get('s')!;
    const ben = await person('user_ben');
    const opened = await body<{ item: { access: string } }>(
      await call(`/share/${code}`, { auth: ben.auth }),
    );
    expect(opened.item.access).toBe('participate');
  });

  it('joins the live call rather than making a second one', async () => {
    const { ada, ben, doc } = await world();
    await spaceFor(ada.auth);
    const first = await body<ItemCallStart>(await start(ada.auth, doc.id));
    await visit(ada.auth, doc.id, ben.auth);
    const res = await start(ben.auth, doc.id);
    expect(res.status).toBe(200);
    const again = await body<ItemCallStart>(res);
    expect(again).toMatchObject({ started: false, call: { id: first.call.id } });
  });

  it('needs an account and view on the item; a Space has no call of its own', async () => {
    const { ada, ben, doc } = await world();
    expect((await start(null, doc.id)).status).toBe(401);
    const guest = await token('guest_x', { guest: true });
    expect((await start(guest, doc.id)).status).toBe(403);
    expect((await start(ben.auth, doc.id)).status).toBe(404);
    const space = await makeItem(ada.auth, { app: 'livehuddle', title: 'Pod' });
    expect((await start(ada.auth, space.id)).status).toBe(400);
  });

  it('answers 503 when livehuddle makes no Space', async () => {
    const { ada, doc } = await world();
    h.appAnswer = () => new Response(null, { status: 500 });
    expect((await start(ada.auth, doc.id)).status).toBe(503);
    // Nor a Space that is not the starter's.
    const other = await makeItem((await person('user_cy')).auth, { app: 'livehuddle' });
    h.appAnswer = () => Response.json({ id: other.id });
    expect((await start(ada.auth, doc.id)).status).toBe(503);
  });
});

describe("the room's count", () => {
  it("keeps the count and names, ends the call when it empties, and tells the item's app", async () => {
    const { ada, doc } = await world();
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    h.appCalls = [];
    expect((await people(space.id, { people: 2, names: ['Ada', 'Ben'] })).status).toBe(204);
    await settle();
    const told = h.appCalls.find((c) => c.url.endsWith(`/items/${doc.id}/source-changed`));
    expect(told).toBeDefined();
    expect(told?.body).toEqual({ app: 'livehuddle', itemId: space.id, sheetIds: [], calls: true });
    let read = await calls(ada.auth, doc.id);
    expect(read.live).toMatchObject({ people: 2, names: ['Ada', 'Ben'] });

    // The same count again tells nobody.
    h.appCalls = [];
    await people(space.id, { people: 2, names: ['Ada', 'Ben'] });
    await settle();
    expect(h.appCalls).toEqual([]);

    await people(space.id, { people: 0, names: [] });
    await settle();
    read = await calls(ada.auth, doc.id);
    expect(read.live).toBeNull();
    expect(read.meetings[0]).toMatchObject({ live: false, names: ['Ada', 'Ben'], you: true });
    expect(read.meetings[0]!.endedAt).not.toBeNull();
  });

  it("is livehuddle's alone, and only for a call's Space", async () => {
    const { ada, doc } = await world();
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    expect((await people(space.id, { people: 1, names: [] }, 'livediagram', 'ld-key')).status).toBe(
      403,
    );
    expect((await people(doc.id, { people: 1, names: [] })).status).toBe(404);
    expect((await people(space.id, { people: -1, names: [] })).status).toBe(400);
  });
});

describe("a Space's call", () => {
  it('names the item for anyone in the Space, and the host alone gets a default knowledgebase', async () => {
    const { ada, ben, doc } = await world();
    const space = await spaceFor(ada.auth);
    const { call: made } = await body<ItemCallStart>(await start(ada.auth, doc.id));
    const read = await body<{ call: SpaceCall }>(
      await call(`/items/${space.id}/call`, { auth: ada.auth }),
    );
    expect(read.call).toMatchObject({
      id: made.id,
      host: true,
      item: { app: 'livediagram', id: doc.id, title: 'Retro' },
      summary: null,
      summaryDefault: null,
    });
    expect(read.call.item.link).toBe(`${site('livediagram')}/document/${doc.id}`);
    const code = new URL(made.link).searchParams.get('s')!;
    expect((await call(`/share/${code}`, { auth: ben.auth })).status).toBe(200);
    const asBen = await body<{ call: SpaceCall }>(
      await call(`/items/${space.id}/call`, { auth: ben.auth, headers: { 'X-Share-Code': code } }),
    );
    expect(asBen.call.host).toBe(false);
    // A Space that is no call says so.
    const pod = await makeItem(ada.auth, { app: 'livehuddle' });
    expect(await body(await call(`/items/${pod.id}/call`, { auth: ada.auth }))).toEqual({
      call: null,
    });
  });

  it("defaults the summary to the team's knowledgebase the host can edit", async () => {
    const ada = await person('user_ada', { teams: [{ id: 'team_1' }] });
    const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Retro', teamId: 'team_1' });
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki', teamId: 'team_1' });
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    const read = await body<{ call: SpaceCall }>(
      await call(`/items/${space.id}/call`, { auth: ada.auth }),
    );
    expect(read.call.summaryDefault).toEqual({ id: kb.id, title: 'Wiki' });
  });
});

describe('the summary', () => {
  it("writes a page through the knowledgebase's door as the host, and the meeting links it", async () => {
    const { ada, doc } = await world();
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki' });
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    h.appAnswer = (c) =>
      c.url.endsWith('/automation-step')
        ? Response.json({ ok: true, text: 'Wrote it', link: 'https://www.liveknowledge.app/k/p1' })
        : new Response(null, { status: 200 });
    h.appCalls = [];
    const res = await call(`/items/${space.id}/call/summary`, {
      method: 'POST',
      auth: ada.auth,
      body: { knowledgebase: kb.id, title: 'Retro, 23 Nov', body: '## Notes\n\nShip it.' },
    });
    expect(res.status).toBe(201);
    const door = h.appCalls.find((c) => c.url.endsWith('/automation-step'))!;
    expect(door.url).toBe(
      `https://www.liveknowledge.app/api/internal/items/${kb.id}/automation-step`,
    );
    expect(door.body).toMatchObject({
      author: 'user_ada',
      rule: { id: 'call-summary', name: 'Meeting Summary', app: 'livehuddle', item: space.id },
      from: { title: 'Retro' },
      step: { kind: 'kb_page', title: 'Retro, 23 Nov', body: '## Notes\n\nShip it.' },
    });
    await settle();
    const read = await calls(ada.auth, doc.id);
    expect(read.meetings[0]!.summary).toEqual({
      title: 'Retro, 23 Nov',
      link: 'https://www.liveknowledge.app/k/p1',
    });
  });

  it('is the host alone, to a knowledgebase, and a refusal is 422 with its reason', async () => {
    const { ada, ben, doc } = await world();
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki' });
    const space = await spaceFor(ada.auth);
    const { call: made } = await body<ItemCallStart>(await start(ada.auth, doc.id));
    const code = new URL(made.link).searchParams.get('s')!;
    await call(`/share/${code}`, { auth: ben.auth });
    const ask = { knowledgebase: kb.id, title: 'T', body: 'B' };
    expect(
      (
        await call(`/items/${space.id}/call/summary`, {
          method: 'POST',
          auth: ben.auth,
          body: ask,
          headers: { 'X-Share-Code': code },
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(`/items/${space.id}/call/summary`, {
          method: 'POST',
          auth: ada.auth,
          body: { ...ask, knowledgebase: doc.id },
        })
      ).status,
    ).toBe(400);
    h.appAnswer = () => Response.json({ ok: false, code: 'target_gone', reason: 'Verified page' });
    const res = await call(`/items/${space.id}/call/summary`, {
      method: 'POST',
      auth: ada.auth,
      body: ask,
    });
    expect(res.status).toBe(422);
    expect(await body(res)).toMatchObject({ error: 'summary_refused', reason: 'Verified page' });
  });
});

describe('invites', () => {
  it('reach the Inbox of people who can open the item, and no one else', async () => {
    const { ada, ben, doc } = await world();
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    const invite = (auth: string, people: string[]) =>
      call(`/items/${space.id}/call/invite`, { method: 'POST', auth, body: { people } });
    // Ben can't open Retro yet.
    expect((await invite(ada.auth, ['user_ben'])).status).toBe(403);
    await visit(ada.auth, doc.id, ben.auth);
    const res = await invite(ada.auth, ['user_ben', 'user_ada']);
    expect(await body(res)).toEqual({ invited: 1 });
    // Twice is one row.
    await invite(ada.auth, ['user_ben']);
    const inbox = await body<InboxResponse>(await call('/inbox', { auth: ben.auth }));
    expect(inbox.calls).toHaveLength(1);
    expect(inbox.calls![0]).toMatchObject({
      app: 'livediagram',
      itemId: doc.id,
      itemTitle: 'Retro',
      live: true,
    });
    expect((await body<InboxResponse>(await call('/inbox', { auth: ada.auth }))).calls).toEqual([]);
  });
});

describe('meetings', () => {
  it("show a plan only to a reader who can open it, and Send to Plan's cards link back to the item", async () => {
    const { ada, ben, doc } = await world();
    const plan = await makeItem(ada.auth, { title: 'Sprint' });
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    h.appAnswer = (c) =>
      c.url.endsWith('/plan-send')
        ? Response.json({
            ok: true,
            cards: [{ id: 'card1', title: 'Fix it', column: 'To Do', done: false }],
          })
        : new Response(null, { status: 200 });
    h.appCalls = [];
    const sent = await call(`/items/${plan.id}/plan-sends`, {
      method: 'POST',
      auth: ada.auth,
      body: {
        board: 'b1',
        column: 'To Do',
        cards: [
          {
            title: 'Fix it',
            places: [
              {
                app: 'livehuddle',
                itemId: space.id,
                kind: 'element',
                tabId: 't1',
                elementId: 'e1',
                part: null,
                label: 'Board',
                text: 'Fix it',
              },
            ],
          },
        ],
      },
    });
    expect(sent.status).toBe(201);
    const door = h.appCalls.find((c) => c.url.endsWith('/plan-send'))!;
    const description = (door.body as { cards: { description: string }[] }).cards[0]!.description;
    expect(description).toContain(
      `Discussed on a call about Retro (livediagram): ${site('livediagram')}/document/${doc.id}`,
    );
    await settle();
    expect((await calls(ada.auth, doc.id)).meetings[0]!.plan).toMatchObject({
      id: plan.id,
      title: 'Sprint',
    });
    await visit(ada.auth, doc.id, ben.auth);
    const code = (
      await body<{ links: { code: string }[] }>(
        await call(`/items/${doc.id}/share`, { auth: ada.auth }),
      )
    ).links[0]!.code;
    const asBen = await body<ItemCallsRead>(
      await call(`/items/${doc.id}/calls`, { auth: ben.auth, headers: { 'X-Share-Code': code } }),
    );
    expect(asBen.meetings[0]!.plan).toBeNull();
    expect(asBen.meetings[0]!.you).toBe(false);
  });
});

describe('the edges', () => {
  it('lists whom the call may invite, for an account who reaches the item', async () => {
    const { ada, ben, doc } = await world();
    const space = await spaceFor(ada.auth);
    const { call: made } = await body<ItemCallStart>(await start(ada.auth, doc.id));
    await visit(ada.auth, doc.id, ben.auth);
    const res = await call(`/items/${space.id}/call/people`, { auth: ada.auth });
    expect(await body(res)).toEqual({
      teamId: null,
      people: [{ id: 'user_ben', via: 'link', name: null }],
    });
    // In the Space by its link, but not able to open the item.
    const cy = await person('user_cy');
    const code = new URL(made.link).searchParams.get('s')!;
    await call(`/share/${code}`, { auth: cy.auth });
    const asCy = { auth: cy.auth, headers: { 'X-Share-Code': code } };
    expect((await call(`/items/${space.id}/call/people`, asCy)).status).toBe(404);
    const invite = await call(`/items/${space.id}/call/invite`, {
      method: 'POST',
      body: { people: ['user_ben'] },
      ...asCy,
    });
    expect(invite.status).toBe(404);
    expect((await call(`/items/${space.id}/call/people`, {})).status).toBe(401);
    expect((await call(`/items/${doc.id}/call/people`, { auth: ada.auth })).status).toBe(404);
  });

  it('refuses what is not a call, a method it has not, and bodies it cannot read', async () => {
    const { ada, ben, doc } = await world();
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    const put = await call(`/items/${doc.id}/calls`, { method: 'PUT', auth: ada.auth });
    expect(put.status).toBe(404);
    expect((await call(`/items/${space.id}/call/other`, { auth: ada.auth })).status).toBe(404);
    expect((await call(`/items/${doc.id}/calls`, { auth: ben.auth })).status).toBe(404);
    expect((await call(`/items/${space.id}/call`, { auth: ben.auth })).status).toBe(404);
    const post = (path: string, payload: unknown) =>
      call(`/items/${space.id}/call/${path}`, { method: 'POST', auth: ada.auth, body: payload });
    expect((await post('summary', { title: 'x' })).status).toBe(400);
    const unknownKb = await post('summary', { knowledgebase: 'nope', title: 'T', body: 'B' });
    expect(unknownKb.status).toBe(400);
    expect((await post('invite', {})).status).toBe(400);
    expect(await body(await post('invite', { people: ['user_ada'] }))).toEqual({ invited: 0 });
    const pod = await makeItem(ada.auth, { app: 'livehuddle' });
    const other = (path: string) =>
      call(`/items/${pod.id}/call/${path}`, {
        method: 'POST',
        auth: ada.auth,
        body: { people: ['user_ben'], knowledgebase: 'k', title: 'T', body: 'B' },
      });
    expect((await other('summary')).status).toBe(404);
    expect((await other('invite')).status).toBe(404);
    expect((await call(`/items/${space.id}/call/summary`, { method: 'POST' })).status).toBe(401);
  });

  it('counts starts, summaries and invites against the per-person limit', async () => {
    const { ada, doc } = await world();
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    const keys: string[] = [];
    const env = {
      ...h.db.env,
      KIT_RUN_LIMITER: {
        limit: async ({ key }: { key: string }) => {
          keys.push(key);
          return { success: false };
        },
      },
    } as unknown as typeof h.db.env;
    const res = await call(`/items/${doc.id}/calls`, { method: 'POST', auth: ada.auth, env });
    expect(res.status).toBe(429);
    for (const path of ['summary', 'invite']) {
      const over = await call(`/items/${space.id}/call/${path}`, {
        method: 'POST',
        auth: ada.auth,
        body: {},
        env,
      });
      expect(over.status).toBe(429);
    }
    expect(keys).toEqual(['item-call:user_ada', 'item-call:user_ada', 'item-call:user_ada']);
  });

  it('a Space whose item is in the Trash has no call, and the item none to start', async () => {
    const { ada, doc } = await world();
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    h.db.sql.prepare('UPDATE items SET trashed_at = 1 WHERE id = ?').run(doc.id);
    expect(await body(await call(`/items/${space.id}/call`, { auth: ada.auth }))).toEqual({
      call: null,
    });
  });

  it("a closed account's invites go, and the calls they started stay, anonymised", async () => {
    const { ada, ben, doc } = await world();
    const space = await spaceFor(ada.auth);
    await start(ada.auth, doc.id);
    await visit(ada.auth, doc.id, ben.auth);
    await call(`/items/${space.id}/call/invite`, {
      method: 'POST',
      auth: ada.auth,
      body: { people: ['user_ben'] },
    });
    h.db.sql.prepare(`UPDATE item_calls SET host_id = 'user_ben'`).run();
    const purged = await call('/internal/purge-person', {
      method: 'POST',
      auth: 'merge-key',
      body: { personId: 'user_ben', teamIds: [] },
    });
    expect(purged.status).toBe(200);
    await settle();
    const count = (sql: string) => (h.db.sql.prepare(sql).get() as { n: number }).n;
    expect(count(`SELECT COUNT(*) AS n FROM item_call_invites`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM item_calls WHERE host_id = 'user_ben'`)).toBe(0);
    expect(count(`SELECT COUNT(*) AS n FROM item_calls`)).toBe(1);
  });
});
