// Spaces made by Call (liveworkspace/docs/specs/004-index/item-calls.md "When a call ends", Work Tracker 1445): a Space
// the index made for a call goes to the Trash once the call has been live and stood empty past the grace; a Calls
// Space, an unmarked Space and a made Space its owner made their own never do; the item's meeting outlives the Space.
import {
  ITEM_CALL_START_GRACE_MS,
  type ItemCallStart,
  type ItemCallsRead,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import type { Env } from './env';
import worker from './index';
import { sweepMadeSpaces } from './item-call-sweep';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness({ INDEX_KEY_LIVEHUDDLE: 'lh-key', APP_ORIGIN_LIVEHUDDLE: 'https://www.livehuddle.app' });

const past = () => Date.now() + ITEM_CALL_START_GRACE_MS + 1_000;

const people = (spaceId: string, count: number) =>
  call(`/app/items/${spaceId}/call-people`, {
    method: 'PUT',
    auth: 'lh-key',
    headers: { 'X-Index-App': 'livehuddle' },
    body: { people: count, names: count > 0 ? ['Ada'] : [] },
  });

const start = (auth: string, itemId: string, payload: unknown = {}) =>
  call(`/items/${itemId}/calls`, { method: 'POST', auth, body: payload });

// A call about `itemId` in a Space the template door makes for it.
async function callIn(auth: string, itemId: string) {
  const space = await makeItem(auth, { app: 'livehuddle', title: 'Retro Call' });
  h.appAnswer = (c) =>
    c.url.endsWith('/items/from-template')
      ? Response.json({ id: space.id })
      : new Response(null, { status: 200 });
  const res = await start(auth, itemId);
  expect(res.status).toBe(201);
  const answer = await body<ItemCallStart>(res);
  expect(answer.call.spaceId).toBe(space.id);
  return { space, callId: answer.call.id };
}

// Someone came and everyone left.
async function liveThenEmpty(spaceId: string) {
  expect((await people(spaceId, 1)).status).toBe(204);
  expect((await people(spaceId, 0)).status).toBe(204);
}

const standing = (id: string) =>
  h.db.sql.prepare('SELECT trashed_at, trash_reason FROM items WHERE id = ?').get(id) as {
    trashed_at: number | null;
    trash_reason: string | null;
  };
const made = (callId: string) =>
  (h.db.sql.prepare('SELECT made FROM item_calls WHERE id = ?').get(callId) as { made: number })
    .made;

async function world() {
  const ada = await person('user_ada');
  const doc = await makeItem(ada.auth, { app: 'livediagram', title: 'Retro' });
  return { ada, doc };
}

describe('a Space made by Call', () => {
  it('is marked made, and goes to the Trash once its call has ended past the grace', async () => {
    const { ada, doc } = await world();
    const { space, callId } = await callIn(ada.auth, doc.id);
    expect(made(callId)).toBe(1);
    await liveThenEmpty(space.id);
    h.appCalls = [];
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(1);
    expect(standing(space.id)).toMatchObject({ trash_reason: 'deleted' });
    expect(standing(space.id).trashed_at).not.toBeNull();
    // As an Explorer Delete: the event, and livehuddle told it is in the Trash.
    expect(
      h.db.sql
        .prepare(`SELECT actor_id FROM events WHERE item_id = ? AND type = 'trashed'`)
        .get(space.id),
    ).toEqual({ actor_id: null });
    expect(h.appCalls).toContainEqual(
      expect.objectContaining({
        url: expect.stringContaining(`/items/${space.id}/standing`),
        body: expect.objectContaining({ trashed: true }),
      }),
    );
    // In the Trash it is no longer marked: restoring it keeps it, and a second run moves nothing.
    expect(made(callId)).toBe(0);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(0);
    // The meeting stays on the item.
    const read = await body<ItemCallsRead>(
      await call(`/items/${doc.id}/calls`, { auth: ada.auth }),
    );
    expect(read.live).toBeNull();
    expect(read.meetings).toEqual([expect.objectContaining({ id: callId, live: false })]);
  });

  it('goes in the quarter-hourly run', async () => {
    const { ada, doc } = await world();
    const { space } = await callIn(ada.auth, doc.id);
    await liveThenEmpty(space.id);
    h.db.sql.exec(`UPDATE item_calls SET ended_at = ended_at - ${ITEM_CALL_START_GRACE_MS + 1000}`);
    await worker.scheduled({ cron: '*/15 * * * *' } as ScheduledController, h.db.env);
    expect(standing(space.id).trashed_at).not.toBeNull();
  });

  it('stays within the grace, and while nobody has ever joined', async () => {
    const { ada, doc } = await world();
    const { space } = await callIn(ada.auth, doc.id);
    // The room's first word, an empty Space while the starter's tab is on its way.
    expect((await people(space.id, 0)).status).toBe(204);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(0);
    await liveThenEmpty(space.id);
    expect(await sweepMadeSpaces(h.db.env, Date.now() + 1_000)).toBe(0);
    expect(standing(space.id).trashed_at).toBeNull();
  });

  it('stays when someone comes back within the grace', async () => {
    const { ada, doc } = await world();
    const { space, callId } = await callIn(ada.auth, doc.id);
    await liveThenEmpty(space.id);
    expect((await people(space.id, 1)).status).toBe(204);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(0);
    expect(standing(space.id).trashed_at).toBeNull();
    const read = await body<ItemCallsRead>(
      await call(`/items/${doc.id}/calls`, { auth: ada.auth }),
    );
    expect(read.live).toMatchObject({ id: callId, people: 1 });
  });

  it('stays when someone rejoins between the run reading it and moving it', async () => {
    const { ada, doc } = await world();
    const { space } = await callIn(ada.auth, doc.id);
    await liveThenEmpty(space.id);
    const real = h.db.env.INDEX_DB;
    // The read answers, then the rejoin lands before the move.
    const racing = new Proxy(real, {
      get(target, key) {
        if (key !== 'prepare') {
          const value = Reflect.get(target, key) as unknown;
          return typeof value === 'function' ? value.bind(target) : value;
        }
        return (sql: string) => {
          const statement = target.prepare(sql);
          if (!sql.includes('AS call_id')) return statement;
          return {
            bind: (...args: unknown[]) => ({
              all: async () => {
                const read = await statement.bind(...args).all();
                h.db.sql.exec('UPDATE item_calls SET people = 1, ended_at = NULL');
                return read;
              },
            }),
          };
        };
      },
    });
    const env = { ...h.db.env, INDEX_DB: racing } as Env;
    expect(await sweepMadeSpaces(env, past())).toBe(0);
    expect(standing(space.id).trashed_at).toBeNull();
  });

  it('moves at most `max` a run, oldest end first', async () => {
    const { ada, doc } = await world();
    const other = await makeItem(ada.auth, { app: 'livediagram', title: 'Plan' });
    const first = await callIn(ada.auth, doc.id);
    await liveThenEmpty(first.space.id);
    const second = await callIn(ada.auth, other.id);
    await liveThenEmpty(second.space.id);
    h.db.sql.exec(`UPDATE item_calls SET ended_at = ended_at - 5000 WHERE id = '${first.callId}'`);
    expect(await sweepMadeSpaces(h.db.env, past(), 1)).toBe(1);
    expect(standing(first.space.id).trashed_at).not.toBeNull();
    expect(standing(second.space.id).trashed_at).toBeNull();
  });

  it('leaves its meeting, summary and plan once purged, and the next Call makes a new Space', async () => {
    const { ada, doc } = await world();
    const kb = await makeItem(ada.auth, { app: 'liveknowledge', title: 'Wiki' });
    const plan = await makeItem(ada.auth, { app: 'liveplanner', title: 'Actions' });
    const { space, callId } = await callIn(ada.auth, doc.id);
    await liveThenEmpty(space.id);
    h.db.sql
      .prepare(
        `UPDATE item_calls SET summary_item_id = ?, summary_link = 'https://kb/p', summary_title = 'Notes',
           plan_id = ? WHERE id = ?`,
      )
      .run(kb.id, plan.id, callId);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(1);
    // Emptied from the Trash.
    const purged = await call(`/items/${space.id}?permanent=true`, {
      method: 'DELETE',
      auth: ada.auth,
    });
    expect(purged.status).toBe(204);
    await settle();
    const read = await body<ItemCallsRead>(
      await call(`/items/${doc.id}/calls`, { auth: ada.auth }),
    );
    expect(read.meetings).toEqual([
      expect.objectContaining({
        id: callId,
        spaceId: null,
        link: '',
        live: false,
        summary: { title: 'Notes', link: 'https://kb/p' },
        plan: expect.objectContaining({ id: plan.id, title: 'Actions' }),
      }),
    ]);
    const next = await callIn(ada.auth, doc.id);
    expect(next.space.id).not.toBe(space.id);
    expect(next.callId).not.toBe(callId);
  });
});

describe('never deleted', () => {
  it('a Calls Space', async () => {
    const { ada, doc } = await world();
    const room = await makeItem(ada.auth, { app: 'livehuddle', title: 'Ada’s Room' });
    const res = await start(ada.auth, doc.id, { space: room.id });
    const { call: started } = await body<ItemCallStart>(res);
    expect(started.spaceId).toBe(room.id);
    expect(made(started.id)).toBe(0);
    await liveThenEmpty(room.id);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(0);
    expect(standing(room.id).trashed_at).toBeNull();
  });

  it('a Space with no mark, as every Space made before it', async () => {
    const { ada, doc } = await world();
    const { space, callId } = await callIn(ada.auth, doc.id);
    h.db.sql.prepare('UPDATE item_calls SET made = 0 WHERE id = ?').run(callId);
    await liveThenEmpty(space.id);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(0);
    expect(standing(space.id).trashed_at).toBeNull();
  });

  const ownMoves: [string, (auth: string, spaceId: string) => Promise<Response>][] = [
    [
      'renamed',
      (auth, id) =>
        call(`/items/${id}`, { method: 'PATCH', auth, body: { title: 'Standup Room' } }),
    ],
    [
      'moved to a folder',
      async (auth, id) => {
        const { folder } = await body<{ folder: { id: string } }>(
          await call('/folders', { method: 'POST', auth, body: { name: 'Rooms' } }),
        );
        return call(`/items/${id}`, { method: 'PATCH', auth, body: { folderId: folder.id } });
      },
    ],
    ['archived', (auth, id) => call(`/items/${id}/archive`, { method: 'POST', auth })],
    [
      'chosen as the Calls Space',
      (auth, id) => call(`/items/${id}/call/keep`, { method: 'POST', auth }),
    ],
    [
      'restored from the Trash',
      async (auth, id) => {
        await call(`/items/${id}`, { method: 'DELETE', auth });
        return call(`/items/${id}/restore`, { method: 'POST', auth });
      },
    ],
  ];
  it.each(ownMoves)('a made Space its owner %s', async (_, move) => {
    const { ada, doc } = await world();
    const { space, callId } = await callIn(ada.auth, doc.id);
    expect((await move(ada.auth, space.id)).ok).toBe(true);
    expect(made(callId)).toBe(0);
    await liveThenEmpty(space.id);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(0);
  });

  it('a made Space started in as a Calls Space', async () => {
    const { ada, doc } = await world();
    const other = await makeItem(ada.auth, { app: 'livediagram', title: 'Plan' });
    const { space, callId } = await callIn(ada.auth, doc.id);
    await liveThenEmpty(space.id);
    h.db.sql.exec(`UPDATE item_calls SET ended_at = ended_at - ${ITEM_CALL_START_GRACE_MS + 1000}`);
    const res = await start(ada.auth, other.id, { space: space.id });
    expect((await body<ItemCallStart>(res)).call.spaceId).toBe(space.id);
    expect(made(callId)).toBe(0);
    await liveThenEmpty(space.id);
    expect(await sweepMadeSpaces(h.db.env, past())).toBe(0);
  });
});

describe('POST /items/:space/call/keep', () => {
  it('is its owner’s alone, and only for a Space', async () => {
    const { ada, doc } = await world();
    const ben = await person('user_ben');
    const { space, callId } = await callIn(ada.auth, doc.id);
    const keep = (auth: string | null, id: string) =>
      call(`/items/${id}/call/keep`, { method: 'POST', auth });
    expect((await keep(null, space.id)).status).toBe(401);
    expect((await keep(ben.auth, space.id)).ok).toBe(false);
    expect((await keep(ada.auth, doc.id)).status).toBe(404);
    expect(made(callId)).toBe(1);
    expect((await keep(ada.auth, space.id)).status).toBe(204);
    expect(made(callId)).toBe(0);
  });
});
