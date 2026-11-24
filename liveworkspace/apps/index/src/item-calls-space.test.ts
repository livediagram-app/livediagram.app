// Your Calls Space on the index (liveworkspace/docs/specs/004-index/item-calls.md "Your Calls Space"): unset, Call makes
// a Space as ever; set, the call starts in the person's own or team's Space, one item's call at a time, through one
// call link that works a week past the latest call; anything they can't choose now falls back to a Space of its own.
import {
  CALL_SPACE_LINK_DAYS,
  type ItemCallStart,
  type SpaceCall,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { callLineOf } from './item-call-plans';
import { body, call, h, makeItem, person, settle, token, useHarness } from './test-support';

useHarness({ INDEX_KEY_LIVEHUDDLE: 'lh-key', APP_ORIGIN_LIVEHUDDLE: 'https://www.livehuddle.app' });

const DAY_MS = 24 * 60 * 60 * 1000;

async function world() {
  const ada = await person('user_ada');
  const ben = await person('user_ben');
  const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Retro' });
  const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Launch' });
  const room = await makeItem(ada.auth, { app: 'livehuddle', title: 'Ada’s Room' });
  return { ada, ben, doc, plan, room };
}

// The template door makes this Space when the call gets one of its own.
async function ownSpace(auth: string) {
  const made = await makeItem(auth, { app: 'livehuddle', title: 'Made Call' });
  h.appCalls = [];
  h.appAnswer = (c) =>
    c.url.endsWith('/items/from-template')
      ? Response.json({ id: made.id })
      : new Response(null, { status: 200 });
  return made;
}

const start = (auth: string, itemId: string, payload: unknown) =>
  call(`/items/${itemId}/calls`, { method: 'POST', auth, body: payload });

const people = (spaceId: string, count: number) =>
  call(`/app/items/${spaceId}/call-people`, {
    method: 'PUT',
    auth: 'lh-key',
    headers: { 'X-Index-App': 'livehuddle' },
    body: { people: count, names: count > 0 ? ['Ada'] : [] },
  });

const row = (id: string) =>
  h.db.sql
    .prepare('SELECT space_id, chosen, ended_at, share_code FROM item_calls WHERE id = ?')
    .get(id) as { space_id: string; chosen: number; ended_at: number | null; share_code: string };

const link = (code: string) =>
  h.db.sql
    .prepare('SELECT level, expiry, expires_at FROM share_links WHERE code = ?')
    .get(code) as {
    level: string;
    expiry: string;
    expires_at: number;
  };

const madeSpace = () => h.appCalls.some((c) => c.url.endsWith('/items/from-template'));

describe('unset', () => {
  it('makes a Space for the call, as without the setting, with a never-expiring link', async () => {
    const { ada, doc } = await world();
    const made = await ownSpace(ada.auth);
    // '' is Default as Settings stores it.
    for (const payload of [{}, { space: null }, { space: '' }]) {
      h.db.sql.exec('DELETE FROM item_calls');
      const res = await start(ada.auth, doc.id, payload);
      expect(res.status).toBe(201);
      const answer = await body<ItemCallStart>(res);
      expect(answer).toEqual({
        call: expect.objectContaining({ spaceId: made.id }),
        started: true,
      });
      expect(row(answer.call.id)).toMatchObject({ space_id: made.id, chosen: 0 });
      expect(link(row(answer.call.id).share_code)).toMatchObject({ expiry: 'never' });
    }
  });

  it('refuses a malformed Space', async () => {
    const { ada, doc } = await world();
    expect((await start(ada.auth, doc.id, { space: 42 })).status).toBe(400);
    expect((await start(ada.auth, doc.id, { space: 'not an id!' })).status).toBe(400);
  });
});

describe('set', () => {
  it('starts the call in the chosen Space, through a Participant link that works a week', async () => {
    const { ada, ben, doc, room } = await world();
    await ownSpace(ada.auth);
    const before = Date.now();
    const res = await start(ada.auth, doc.id, { space: room.id });
    expect(res.status).toBe(201);
    const { call: made, started, fallback } = await body<ItemCallStart>(res);
    expect(started).toBe(true);
    expect(fallback).toBeUndefined();
    expect(made.spaceId).toBe(room.id);
    expect(madeSpace()).toBe(false);
    expect(h.appCalls.find((c) => c.url.endsWith(`/items/${room.id}/call`))?.body).toEqual({
      callId: made.id,
    });
    const kept = row(made.id);
    expect(kept.chosen).toBe(1);
    const way = link(kept.share_code);
    expect(way).toMatchObject({ level: 'participate', expiry: 'week' });
    expect(way.expires_at).toBeGreaterThanOrEqual(before + CALL_SPACE_LINK_DAYS * DAY_MS);
    // Someone who reads the item lands in the same Space as a Participant.
    const opened = await body<{ item: { id: string; access: string } }>(
      await call(`/share/${new URL(made.link).searchParams.get('s')}`, { auth: ben.auth }),
    );
    expect(opened.item).toMatchObject({ id: room.id, access: 'participate' });
    // livehuddle's editor reads the Space's call as this one.
    const read = await body<{ call: SpaceCall }>(
      await call(`/items/${room.id}/call`, { auth: ada.auth }),
    );
    expect(read.call).toMatchObject({ id: made.id, host: true, item: { id: doc.id } });
  });

  it('joins the live call about the item rather than starting another', async () => {
    const { ada, doc, room } = await world();
    await ownSpace(ada.auth);
    const first = await body<ItemCallStart>(await start(ada.auth, doc.id, { space: room.id }));
    const res = await start(ada.auth, doc.id, { space: room.id });
    expect(res.status).toBe(200);
    expect(await body<ItemCallStart>(res)).toMatchObject({
      started: false,
      call: { id: first.call.id, spaceId: room.id },
    });
  });

  it('holds one call after another, reusing its one link and moving it a week on', async () => {
    const { ada, doc, plan, room } = await world();
    await ownSpace(ada.auth);
    const first = await body<ItemCallStart>(await start(ada.auth, doc.id, { space: room.id }));
    // Its call came and went.
    await people(room.id, 1);
    await people(room.id, 0);
    const code = row(first.call.id).share_code;
    h.db.sql.prepare('UPDATE share_links SET expires_at = 1 WHERE code = ?').run(code);
    const second = await body<ItemCallStart>(await start(ada.auth, plan.id, { space: room.id }));
    expect(second.call.spaceId).toBe(room.id);
    expect(second.call.id).not.toBe(first.call.id);
    expect(row(second.call.id).share_code).toBe(code);
    expect(link(code).expires_at).toBeGreaterThan(Date.now());
    const links = h.db.sql
      .prepare('SELECT COUNT(*) AS n FROM share_links WHERE item_id = ?')
      .get(room.id) as { n: number };
    expect(links.n).toBe(1);
    // The Space's call is the newest; the earlier one stays the first item's meeting.
    const read = await body<{ call: SpaceCall }>(
      await call(`/items/${room.id}/call`, { auth: ada.auth }),
    );
    expect(read.call.item.id).toBe(plan.id);
    const meetings = await body<{ meetings: { id: string }[] }>(
      await call(`/items/${doc.id}/calls`, { auth: ada.auth }),
    );
    expect(meetings.meetings.map((m) => m.id)).toEqual([first.call.id]);
  });

  it('ends an earlier call there that never ended, and makes a new link once the old one is gone', async () => {
    const { ada, doc, plan, room } = await world();
    await ownSpace(ada.auth);
    const first = await body<ItemCallStart>(await start(ada.auth, doc.id, { space: room.id }));
    // Nobody came within the grace.
    h.db.sql
      .prepare('UPDATE item_calls SET started_at = started_at - 600000 WHERE id = ?')
      .run(first.call.id);
    h.db.sql.prepare('DELETE FROM share_links WHERE code = ?').run(row(first.call.id).share_code);
    const second = await body<ItemCallStart>(await start(ada.auth, plan.id, { space: room.id }));
    expect(second.call.spaceId).toBe(room.id);
    expect(row(first.call.id).ended_at).not.toBeNull();
    expect(link(row(second.call.id).share_code)).toMatchObject({ expiry: 'week' });
  });

  it("gives the call a Space of its own while the chosen one holds another item's live call", async () => {
    const { ada, doc, plan, room } = await world();
    const made = await ownSpace(ada.auth);
    const first = await body<ItemCallStart>(await start(ada.auth, doc.id, { space: room.id }));
    await people(room.id, 2);
    h.appCalls = [];
    const res = await start(ada.auth, plan.id, { space: room.id });
    expect(res.status).toBe(201);
    const second = await body<ItemCallStart>(res);
    expect(second).toMatchObject({ started: true, fallback: 'busy', call: { spaceId: made.id } });
    expect(madeSpace()).toBe(true);
    // The other call is untouched.
    expect(row(first.call.id)).toMatchObject({ space_id: room.id, ended_at: null });
  });

  it("lets a team's member choose the team's Space", async () => {
    const ada = await person('user_ada', { teams: [{ id: 'team_1' }] });
    const ben = await person('user_ben', { teams: [{ id: 'team_1' }] });
    const doc = await makeItem(ben.auth, { app: 'livediagram', title: 'Retro' });
    const room = await makeItem(ada.auth, {
      app: 'livehuddle',
      title: 'Team Room',
      teamId: 'team_1',
    });
    await ownSpace(ben.auth);
    const res = await body<ItemCallStart>(await start(ben.auth, doc.id, { space: room.id }));
    expect(res).toMatchObject({ started: true, call: { spaceId: room.id } });
    expect(res.fallback).toBeUndefined();
  });
});

describe('unavailable', () => {
  const fallsBack = async (auth: string, itemId: string, space: string, made: string) => {
    h.db.sql.exec('DELETE FROM item_calls');
    const res = await start(auth, itemId, { space });
    expect(res.status).toBe(201);
    expect(await body<ItemCallStart>(res)).toMatchObject({
      started: true,
      fallback: 'unavailable',
      call: { spaceId: made },
    });
  };

  it("falls back for a Space that's gone, trashed or archived", async () => {
    const { ada, doc } = await world();
    const made = await ownSpace(ada.auth);
    await fallsBack(ada.auth, doc.id, 'lh_gone', made.id);
    const trashed = await makeItem(ada.auth, { app: 'livehuddle', title: 'Old' });
    await call(`/items/${trashed.id}`, { method: 'DELETE', auth: ada.auth });
    await fallsBack(ada.auth, doc.id, trashed.id, made.id);
    const archived = await makeItem(ada.auth, { app: 'livehuddle', title: 'Shelved' });
    await call(`/items/${archived.id}/archive`, { method: 'POST', auth: ada.auth });
    await fallsBack(ada.auth, doc.id, archived.id, made.id);
    // Not a Space at all.
    await fallsBack(ada.auth, doc.id, doc.id, made.id);
  });

  it("falls back for someone else's Space, even one shared with them to edit", async () => {
    const { ada, doc } = await world();
    const made = await ownSpace(ada.auth);
    const cy = await person('user_cy');
    const theirs = await makeItem(cy.auth, { app: 'livehuddle', title: 'Cy’s Room' });
    await fallsBack(ada.auth, doc.id, theirs.id, made.id);
    const { link: shared } = await body<{ link: { code: string } }>(
      await call(`/items/${theirs.id}/share`, {
        method: 'POST',
        auth: cy.auth,
        body: { level: 'edit' },
      }),
    );
    expect((await call(`/share/${shared.code}`, { auth: ada.auth })).status).toBe(200);
    await fallsBack(ada.auth, doc.id, theirs.id, made.id);
  });

  it('falls back once they leave the team the Space is in', async () => {
    const ada = await person('user_ada', { teams: [{ id: 'team_1' }] });
    const room = await makeItem(ada.auth, {
      app: 'livehuddle',
      title: 'Team Room',
      teamId: 'team_1',
    });
    const ben = await person('user_ben');
    const doc = await makeItem(ben.auth, { app: 'livediagram', title: 'Retro' });
    const made = await ownSpace(ben.auth);
    await fallsBack(ben.auth, doc.id, room.id, made.id);
  });

  it('still refuses a guest', async () => {
    const { doc, room } = await world();
    const guest = await token('guest_x', { guest: true });
    expect((await start(guest, doc.id, { space: room.id })).status).toBe(403);
  });
});

describe("Send to Plan's line back from a Calls Space", () => {
  it("names the newest call's item, and nothing for a Space with no call or a trashed item", async () => {
    const { ada, doc, plan, room } = await world();
    await ownSpace(ada.auth);
    const source = { id: room.id, app: 'livehuddle' as const };
    expect(await callLineOf(h.db.env, source)).toBeNull();
    expect(await callLineOf(h.db.env, { id: doc.id, app: 'livediagram' })).toBeNull();
    await start(ada.auth, doc.id, { space: room.id });
    await people(room.id, 1);
    await people(room.id, 0);
    h.db.sql.prepare('UPDATE item_calls SET started_at = started_at - 1000').run();
    const second = await body<ItemCallStart>(await start(ada.auth, plan.id, { space: room.id }));
    const line = await callLineOf(h.db.env, source);
    expect(line).toMatchObject({ callId: second.call.id, spaceId: room.id });
    expect(line?.line).toMatch(/^Discussed on a call about Launch \(liveplanner\): /);
    await call(`/items/${plan.id}`, { method: 'DELETE', auth: ada.auth });
    expect(await callLineOf(h.db.env, source)).toBeNull();
  });
});

describe("the room's count in a Calls Space", () => {
  it('comes back to life within the grace, and never once it has stood empty past it', async () => {
    const { ada, doc, room } = await world();
    await ownSpace(ada.auth);
    const { call: made } = await body<ItemCallStart>(
      await start(ada.auth, doc.id, { space: room.id }),
    );
    // A reload: out and straight back.
    await people(room.id, 1);
    await people(room.id, 0);
    expect((await people(room.id, 1)).status).toBe(204);
    expect(row(made.id).ended_at).toBeNull();
    // Out for good, then the Space used again later.
    await people(room.id, 0);
    h.db.sql
      .prepare('UPDATE item_calls SET ended_at = ended_at - 600000 WHERE id = ?')
      .run(made.id);
    h.appCalls = [];
    expect((await people(room.id, 3)).status).toBe(204);
    await settle();
    expect(row(made.id).ended_at).not.toBeNull();
    expect(h.appCalls).toEqual([]);
    const read = await body<{ live: unknown }>(
      await call(`/items/${doc.id}/calls`, { auth: ada.auth }),
    );
    expect(read.live).toBeNull();
  });

  it("keeps reviving a Space made for one item's call, as before", async () => {
    const { ada, doc } = await world();
    const made = await ownSpace(ada.auth);
    const { call: started } = await body<ItemCallStart>(await start(ada.auth, doc.id, {}));
    await people(made.id, 1);
    await people(made.id, 0);
    h.db.sql
      .prepare('UPDATE item_calls SET ended_at = ended_at - 600000 WHERE id = ?')
      .run(started.id);
    await people(made.id, 2);
    expect(row(started.id).ended_at).toBeNull();
  });
});
