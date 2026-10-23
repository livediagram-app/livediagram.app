// What apps and accounts call: summaries and comment pushes, the Inbox they feed, the guest merge, and the
// daily purge with its retries.
import type {
  CollabActionInput,
  CollabThreadInput,
  InboxResponse,
  Item,
} from '@liveworkspace/index-client';
import { describe, expect, it, vi } from 'vitest';
import worker from './index';
import { sweep } from './purge';
import { NOTICE_GIVE_UP_MS, NOTICE_RETRY_AFTER_MS } from './person-notices';
import { drainPersonMerges } from './person-merges';
import { body, call, h, makeItem, person, settle, useHarness } from './test-support';

useHarness();

const asApp = (path: string, payload: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(path, { method: 'PUT', auth: key, headers: { 'X-Index-App': app }, body: payload });

const thread = (patch: Partial<CollabThreadInput> = {}): CollabThreadInput => ({
  elementId: 'el-1',
  elementLabel: 'Card',
  resolved: false,
  commentCount: 2,
  participantIds: ['user_a', 'user_b'],
  mentionedIds: [],
  latestText: 'Looks good',
  latestAuthorName: 'Bob',
  firstAt: 1,
  latestAt: 2,
  ...patch,
});

const action = (patch: Partial<CollabActionInput> = {}): CollabActionInput => ({
  elementId: 'el-1',
  actionId: 'act-1',
  elementLabel: 'Card',
  name: 'Write it up',
  status: 'open',
  assigneeId: 'user_b',
  assignerId: 'user_a',
  teamId: null,
  createdAt: 1,
  updatedAt: 2,
  ...patch,
});

describe('app pushes', () => {
  it('refuse a caller without the app’s key, and another app’s item', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const summary = { summary: { elements: 1 }, updatedAt: 5 };
    expect(
      (await asApp(`/app/items/${item.id}/summary`, summary, 'liveplanner', 'wrong')).status,
    ).toBe(401);
    expect((await asApp(`/app/items/${item.id}/summary`, summary, 'nope')).status).toBe(401);
    expect(
      (await call(`/app/items/${item.id}/summary`, { method: 'PUT', auth: ada.auth })).status,
    ).toBe(401);
    const res = await asApp(`/app/items/${item.id}/summary`, summary, 'livediagram', 'ld-key');
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ error: 'wrong_app' });
    expect((await asApp('/app/items/missing/summary', summary)).status).toBe(404);
  });

  it('take a summary, never moving updatedAt back, and refuse a big one', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const later = Date.now() + 60_000;
    const ok = await asApp(`/app/items/${item.id}/summary`, {
      summary: { elements: 12, thumbnail: 'media/abc', mode: 'board' },
      updatedAt: later,
    });
    expect(ok.status).toBe(204);
    await asApp(`/app/items/${item.id}/summary`, { summary: { elements: 13 }, updatedAt: 1 });
    const got = await body<{ item: Item }>(await call(`/items/${item.id}`, { auth: ada.auth }));
    expect(got.item.summary).toEqual({ elements: 13 });
    expect(got.item.updatedAt).toBe(later);
    const big = await asApp(`/app/items/${item.id}/summary`, {
      summary: { text: 'x'.repeat(2100) },
      updatedAt: 1,
    });
    expect(await body(big)).toEqual({ error: 'invalid_summary' });
    expect(
      (await asApp(`/app/items/${item.id}/summary`, { summary: [1], updatedAt: 1 })).status,
    ).toBe(400);
  });

  it('replace one tab’s threads and actions, leaving other tabs', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    await asApp(`/app/items/${item.id}/collab/tab-1`, {
      threads: [thread(), thread({ elementId: 'el-2', resolved: true })],
      actions: [action()],
    });
    await asApp(`/app/items/${item.id}/collab/tab-2`, { threads: [thread()], actions: [] });
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM collab_threads').get()).toEqual({ n: 3 });
    // Only open threads list their people.
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM collab_thread_people').get()).toEqual({
      n: 4,
    });
    const res = await asApp(`/app/items/${item.id}/collab/tab-1`, { threads: [], actions: [] });
    expect(res.status).toBe(204);
    expect(h.db.sql.prepare('SELECT tab_id FROM collab_threads').all()).toEqual([
      { tab_id: 'tab-2' },
    ]);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM collab_actions').get()).toEqual({ n: 0 });
    const row = h.db.sql.prepare('SELECT participant_ids, resolved FROM collab_threads').get();
    expect(row).toEqual({ participant_ids: '["user_a","user_b"]', resolved: 0 });
  });

  it('refuse a malformed push, and keep the last of a repeated element', async () => {
    const ada = await person('user_a');
    const item = await makeItem(ada.auth);
    const path = `/app/items/${item.id}/collab/tab-1`;
    expect(await body(await asApp(path, { threads: 'x', actions: [] }))).toEqual({
      error: 'invalid_collab',
    });
    expect((await asApp(path, { threads: [{ elementId: 'e' }], actions: [] })).status).toBe(400);
    expect(
      (await asApp(path, { threads: [], actions: [action({ status: 'maybe' as never })] })).status,
    ).toBe(400);
    const many = Array.from({ length: 501 }, (_, i) => thread({ elementId: `e${i}` }));
    expect((await asApp(path, { threads: many, actions: [] })).status).toBe(400);
    const res = await asApp(path, {
      threads: [thread({ latestText: 'first' }), thread({ latestText: 'second' })],
      actions: [],
    });
    expect(res.status).toBe(204);
    expect(h.db.sql.prepare('SELECT latest_text FROM collab_threads').all()).toEqual([
      { latest_text: 'second' },
    ]);
  });
});

describe('the Inbox', () => {
  it('shows open actions to and by me, and unresolved threads I am in, on items I reach', async () => {
    const ada = await person('user_a', { teams: [{ id: 'team1' }] });
    const bob = await person('user_b', { teams: [{ id: 'team1' }] });
    const cat = await person('user_c');
    const teamItem = await makeItem(ada.auth, { title: 'Team plan', teamId: 'team1' });
    const adaOwn = await makeItem(ada.auth, { title: 'Private' });
    await asApp(`/app/items/${teamItem.id}/collab/t1`, {
      threads: [
        thread({ elementId: 'e1', participantIds: ['user_b'], latestAt: 10 }),
        thread({
          elementId: 'e2',
          participantIds: ['user_a'],
          mentionedIds: ['user_c'],
          latestAt: 20,
        }),
        thread({ elementId: 'e3', participantIds: ['user_b'], resolved: true }),
      ],
      actions: [
        action({ actionId: 'a1', assigneeId: 'user_b', assignerId: 'user_a', updatedAt: 5 }),
        action({ actionId: 'a2', assigneeId: 'user_c', assignerId: 'user_b', updatedAt: 6 }),
        action({ actionId: 'a3', assigneeId: 'user_b', status: 'done' }),
      ],
    });
    await asApp(`/app/items/${adaOwn.id}/collab/t1`, {
      threads: [thread({ elementId: 'e9', participantIds: ['user_a'], latestAt: 30 })],
      actions: [],
    });

    const forBob = await body<InboxResponse>(await call('/inbox', { auth: bob.auth }));
    expect(forBob.threads.map((t) => t.elementId)).toEqual(['e1']);
    expect(forBob.threads[0]).toMatchObject({
      app: 'liveplanner',
      itemId: teamItem.id,
      itemTitle: 'Team plan',
      tabId: 't1',
      resolved: false,
    });
    expect(forBob.actions.map((a) => a.actionId)).toEqual(['a2', 'a1']);

    // Ada: her own items' threads (e9 on her private item; e1, e2 on the team item she owns).
    const forAda = await body<InboxResponse>(await call('/inbox', { auth: ada.auth }));
    expect(forAda.threads.map((t) => t.elementId)).toEqual(['e9', 'e2', 'e1']);
    expect(forAda.actions.map((a) => a.actionId)).toEqual(['a1']);

    // Cat is mentioned and assigned, but cannot reach the item: nothing shows.
    const forCat = await body<InboxResponse>(await call('/inbox', { auth: cat.auth }));
    expect(forCat).toEqual({ threads: [], actions: [], forms: [], timelineNew: 0 });
    // Given a link and having opened it, Cat sees them.
    const { link } = await body<{ link: { code: string } }>(
      await call(`/items/${teamItem.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'view' },
      }),
    );
    await call(`/share/${link.code}`, { auth: cat.auth });
    const after = await body<InboxResponse>(await call('/inbox', { auth: cat.auth }));
    expect(after.threads.map((t) => t.elementId)).toEqual(['e2']);
    expect(after.actions.map((a) => a.actionId)).toEqual(['a2']);

    expect(
      (await body<InboxResponse>(await call('/inbox?app=livediagram', { auth: bob.auth }))).threads,
    ).toEqual([]);
    expect((await call('/inbox?app=nope', { auth: bob.auth })).status).toBe(400);
    // A trashed item leaves the Inbox.
    await call(`/items/${adaOwn.id}`, { method: 'DELETE', auth: ada.auth });
    const trashed = await body<InboxResponse>(await call('/inbox', { auth: ada.auth }));
    expect(trashed.threads.map((t) => t.elementId)).toEqual(['e2', 'e1']);
  });
});

describe('the guest merge', () => {
  const merge = (payload: unknown, key = 'merge-key') =>
    call('/internal/merge', { method: 'POST', auth: key, body: payload });

  it('needs accounts’ key and a guest and an account', async () => {
    expect((await merge({ guestId: 'guest_1', userId: 'user_1' }, 'wrong')).status).toBe(401);
    expect((await merge({ guestId: 'user_2', userId: 'user_1' })).status).toBe(400);
    expect((await merge({ guestId: 'guest_1', userId: 'guest_2' })).status).toBe(400);
  });

  it('moves everything the guest had to the account, once', async () => {
    const guest = await person('guest_g1', { guest: true });
    const user = await person('user_u1');
    const owner = await person('user_o');
    const item = await makeItem(guest.auth, { title: 'Guest plan' });
    const other = await makeItem(owner.auth, { title: 'Theirs' });
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: guest.auth, body: { name: 'G' } }),
    );
    await call(`/items/${item.id}`, {
      method: 'PATCH',
      auth: guest.auth,
      body: { folderId: folder.folder.id },
    });
    // Same-named tags: the account's stays, and takes the guest's items.
    await call('/tags', {
      method: 'POST',
      auth: guest.auth,
      body: { id: 'tg', name: 'Work', colour: 'red' },
    });
    await call('/tags', {
      method: 'POST',
      auth: guest.auth,
      body: { id: 'tg2', name: 'Solo', colour: 'red' },
    });
    await call('/tags', {
      method: 'POST',
      auth: user.auth,
      body: { id: 'tu', name: 'work', colour: 'blue' },
    });
    await call(`/tags/tg/items/${item.id}`, { method: 'PUT', auth: guest.auth });
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: guest.auth });
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: user.auth });
    await call(`/items/${item.id}/open`, { method: 'POST', auth: guest.auth });
    await call(`/placement-defaults/mode:plan`, {
      method: 'PUT',
      auth: guest.auth,
      body: { folderId: folder.folder.id },
    });
    const { link } = await body<{ link: { code: string } }>(
      await call(`/items/${other.id}/share`, { method: 'POST', auth: owner.auth, body: {} }),
    );
    await call(`/share/${link.code}`, { auth: guest.auth });

    const res = await merge({ guestId: 'guest_g1', userId: 'user_u1' });
    expect(await body(res)).toEqual({ items: 1 });

    const mine = await body<{ items: Item[] }>(await call('/items', { auth: user.auth }));
    expect(mine.items.map((i) => [i.title, i.ownerId, i.folderId, i.tagIds, i.favourite])).toEqual([
      ['Guest plan', 'user_u1', folder.folder.id, ['tu'], true],
    ]);
    expect(mine.items[0]!.lastOpenedAt).not.toBeNull();
    const tags = h.db.sql.prepare('SELECT id, owner_id FROM tags ORDER BY id').all();
    expect(tags).toEqual([
      { id: 'tg2', owner_id: 'user_u1' },
      { id: 'tu', owner_id: 'user_u1' },
    ]);
    const shared = await body<{ shared: unknown[] }>(await call('/shared', { auth: user.auth }));
    expect(shared.shared).toHaveLength(1);
    const defaults = await body<{ defaults: unknown[] }>(
      await call('/placement-defaults', { auth: user.auth }),
    );
    expect(defaults.defaults).toEqual([{ key: 'mode:plan', folderId: folder.folder.id }]);
    // Their Timeline is the account's: what they did, under the account's id.
    const timeline = await body<{ events: { type: string; actorId: string }[] }>(
      await call('/timeline', { auth: user.auth }),
    );
    expect(timeline.events.map((e) => [e.type, e.actorId]).sort()).toEqual([
      ['created', 'user_u1'],
      ['favourited', 'user_u1'],
      ['moved', 'user_u1'],
    ]);
    expect(
      h.db.sql
        .prepare("SELECT COUNT(*) AS n FROM timeline_event_scopes WHERE scope = 'p:guest_g1'")
        .get(),
    ).toEqual({ n: 0 });
    for (const table of ['favourites', 'opens', 'shared_with', 'placement_defaults']) {
      expect(
        h.db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE person_id = 'guest_g1'`).get(),
      ).toEqual({ n: 0 });
    }
    // Again: nothing left to move.
    expect(await body(await merge({ guestId: 'guest_g1', userId: 'user_u1' }))).toEqual({
      items: 0,
    });
  });
});

describe('the daily purge', () => {
  it('purges items 30 days in the Trash and retries what the app missed', async () => {
    const ada = await person('user_a');
    const old = await makeItem(ada.auth, { title: 'Old' });
    const recent = await makeItem(ada.auth, { title: 'Recent' });
    const now = Date.now();
    const trash = h.db.sql.prepare(
      'UPDATE items SET trashed_at = ?, trash_reason = ? WHERE id = ?',
    );
    trash.run(now - 31 * 24 * 60 * 60 * 1000, 'deleted', old.id);
    trash.run(now - 2 * 24 * 60 * 60 * 1000, 'deleted', recent.id);

    h.appAnswer = () => new Response(null, { status: 502 });
    expect(await sweep(h.db.env, now)).toEqual({ purged: 1, confirmed: 0 });
    expect(h.db.sql.prepare('SELECT id FROM items').all()).toEqual([{ id: recent.id }]);
    expect(h.db.sql.prepare('SELECT item_id, attempts FROM purge_tombstones').all()).toEqual([
      { item_id: old.id, attempts: 1 },
    ]);

    // The next run reaches the app.
    h.appAnswer = () => new Response(null, { status: 404 });
    await worker.scheduled({} as ScheduledController, h.db.env);
    expect(h.db.sql.prepare('SELECT COUNT(*) AS n FROM purge_tombstones').get()).toEqual({ n: 0 });
    expect(h.appCalls.map((c) => `${c.method} ${c.url}`)).toEqual([
      `DELETE https://liveplanner.app/api/internal/items/${old.id}`,
      `DELETE https://liveplanner.app/api/internal/items/${old.id}`,
    ]);
  });
});

describe('telling the apps a guest became an account', () => {
  const merge = (payload: unknown) =>
    call('/internal/merge', { method: 'POST', auth: 'merge-key', body: payload });
  const pending = () =>
    h.db.sql.prepare('SELECT app, user_id FROM person_app_merges ORDER BY app').all() as {
      app: string;
      user_id: string;
    }[];

  it('asks every app to move the guest to the account, at once, and forgets each that confirms', async () => {
    h.appAnswer = (c) =>
      new Response(null, { status: c.url.startsWith('https://livediagram') ? 503 : 200 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await merge({ guestId: 'guest_g9', userId: 'user_u9' })).status).toBe(200);
    await settle();
    const told = h.appCalls.filter((c) => c.url.includes('/api/internal/people/guest_g9/merge'));
    expect(told.length).toBeGreaterThan(0);
    expect(told.every((c) => c.method === 'POST')).toBe(true);
    expect(told[0]!.body).toEqual({ into: 'user_u9' });
    // What the app did not take waits for the next run, an hour on.
    const left = pending();
    expect(left.every((r) => r.user_id === 'user_u9')).toBe(true);
    h.appAnswer = () => new Response(null, { status: 200 });
    h.appCalls = [];
    await drainPersonMerges(h.db.env, Date.now() + 1000);
    expect(h.appCalls).toHaveLength(0);
    await drainPersonMerges(h.db.env, Date.now() + NOTICE_RETRY_AFTER_MS + 1);
    expect(pending()).toEqual([]);
  });

  it('gives up on an app after a week', async () => {
    h.db.sql
      .prepare(
        `INSERT INTO person_app_merges (guest_id, user_id, app, created_at) VALUES ('guest_old', 'user_x', 'livediagram', 1)`,
      )
      .run();
    h.appAnswer = () => new Response(null, { status: 503 });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await drainPersonMerges(h.db.env, 1 + NOTICE_GIVE_UP_MS + 1);
    expect(pending()).toEqual([]);
  });
});
