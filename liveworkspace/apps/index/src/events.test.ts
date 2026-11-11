// The event log: the index records its own events in the change's batch, apps report edits and accounts its team
// events; an item's History reads them back through the item index, to its owner and team alone; the daily sweep
// keeps 30 days, in bounded chunks.
import { personEventKey } from './event-key';
import {
  APP_EVENTS_MAX,
  EVENT_RETENTION_MS,
  HISTORY_LIMIT_MAX,
  type HistoryPage,
  type ItemEvent,
} from '@liveworkspace/index-client';
import type { SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOfAsync } from '@liveworkspace/vitest-config/cpu-time';
import { EVENT_SWEEP_CHUNK, EVENT_SWEEP_ROUNDS, sweepEvents } from './events';
import { buildHistoryQuery } from './history';
import { body, call, h, makeItem, person, useHarness } from './test-support';

useHarness();

const DAY = 86_400_000;
const TODAY = 20_400;

const history = async (auth: string, itemId: string, query = '') =>
  body<HistoryPage>(await call(`/items/${itemId}/history${query ? `?${query}` : ''}`, { auth }));
const kinds = (events: ItemEvent[]) => events.map((e) => `${e.type} ${e.title}`);
const asApp = (path: string, payload: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(path, { method: 'PUT', auth: key, headers: { 'X-Index-App': app }, body: payload });
type Logged = { id: string; app: string; item_id: string | null; type: string };
// Every row of the log, newest first, for what no History shows (events about no item, other people's).
const logged = () =>
  h.db.sql
    .prepare('SELECT id, app, item_id, type FROM events ORDER BY occurred_at DESC, id DESC')
    .all() as Logged[];

afterEach(() => vi.useRealTimers());

// Each call a second on, so the order is the order things were done in.
function tick() {
  let now = TODAY * DAY;
  vi.useFakeTimers({ toFake: ['Date'], now });
  return () => vi.setSystemTime((now += 1000));
}

describe('what the index records', () => {
  it('records create, rename, move, trash, restore, share, unshare and favourite, newest first', async () => {
    const next = tick();
    const ada = await person('user_tl1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    next();
    const folder = await body<{ folder: { id: string } }>(
      await call('/folders', { method: 'POST', auth: ada.auth, body: { name: 'Launch' } }),
    );
    const patch = (input: Record<string, unknown>) =>
      call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: input });
    await patch({ title: 'Roadmap 2' });
    next();
    await patch({ folderId: folder.folder.id });
    next();
    // Saying what it is already says nothing.
    await patch({ title: 'Roadmap 2', folderId: folder.folder.id });
    next();
    await call(`/items/${item.id}/share`, {
      method: 'POST',
      auth: ada.auth,
      body: { level: 'view' },
    });
    next();
    await call(`/items/${item.id}/share`, { method: 'DELETE', auth: ada.auth });
    next();
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    next();
    // Starring it again is not news.
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: ada.auth });
    next();
    await call(`/items/${item.id}`, { method: 'DELETE', auth: ada.auth });
    next();
    await call(`/items/${item.id}/restore`, { method: 'POST', auth: ada.auth });
    next();
    // An empty item tidied away by its app is not news.
    const empty = await makeItem(ada.auth, { title: 'Blank' });
    next();
    await call(`/items/${empty.id}?reason=empty`, { method: 'DELETE', auth: ada.auth });

    const page = await history(ada.auth, item.id);
    expect(kinds(page.events)).toEqual([
      'restored Roadmap 2',
      'trashed Roadmap 2',
      'favourited Roadmap 2',
      'unshared Roadmap 2',
      'shared Roadmap 2',
      'moved Roadmap 2',
      'renamed Roadmap 2',
      'created Roadmap',
    ]);
    expect(kinds((await history(ada.auth, empty.id)).events)).toEqual(['created Blank']);
    const byType = new Map(page.events.map((e) => [e.type, e]));
    expect(byType.get('renamed')!.detail).toEqual({ from: 'Roadmap' });
    expect(byType.get('moved')!.detail).toEqual({ folderName: 'Launch', teamId: null });
    expect(byType.get('shared')!.detail).toEqual({ level: 'view' });
    expect(page.events.every((e) => e.actorId === 'user_tl1' && e.actorName === null)).toBe(true);
    // The item as it is now rides along: its name since, its place, its access.
    expect(page.events.at(-1)!.item).toMatchObject({ title: 'Roadmap 2', access: 'edit' });
    expect(page.nextCursor).toBeNull();
  });

  it('records a copy and where an AI or import made it', async () => {
    const ada = await person('user_tl2');
    const made = await makeItem(ada.auth, { title: 'Drafted', source: 'ai' });
    expect((await history(ada.auth, made.id)).events[0]).toMatchObject({
      type: 'created',
      detail: { source: 'ai' },
      itemId: made.id,
    });
    const copy = await body<{ item: { id: string } }>(
      await call(`/items/${made.id}/copy`, { method: 'POST', auth: ada.auth, body: {} }),
    );
    expect((await history(ada.auth, copy.item.id)).events[0]).toMatchObject({
      type: 'created',
      title: 'Drafted (copy)',
      detail: { copiedFrom: 'Drafted' },
    });
  });

  it("doesn't record a favourite of an item the person can't reach", async () => {
    const ada = await person('user_tl3');
    const bea = await person('user_tl3b');
    const theirs = await makeItem(bea.auth, { title: 'Private' });
    await call(`/favourites/${theirs.id}`, { method: 'PUT', auth: ada.auth });
    expect(logged().filter((e) => e.type === 'favourited')).toEqual([]);
  });

  it('records an item synced back, and nothing for one taken offline (it and its History go)', async () => {
    const next = tick();
    const ada = await person('user_off');
    const back = await body<{ item: { id: string } }>(
      await call('/items', {
        method: 'POST',
        auth: ada.auth,
        body: { app: 'liveplanner', title: 'Back', synced: true },
      }),
    );
    next();
    const gone = await makeItem(ada.auth, { title: 'Away' });
    next();
    await call(`/items/${gone.id}?permanent=true&reason=offline`, {
      method: 'DELETE',
      auth: ada.auth,
    });
    expect(kinds((await history(ada.auth, back.item.id)).events)).toEqual(['synced Back']);
    expect(logged().map((e) => e.type)).toEqual(['synced']);
  });
});

describe('what apps report', () => {
  it("lands a person's edits on one event a day, and counts the day towards their Most Used", async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: TODAY * DAY + 5000 });
    const ada = await person('user_tl7', { teams: [{ id: 'team_tl7' }] });
    const item = await makeItem(ada.auth, { title: 'Shared plan', teamId: 'team_tl7' });
    const edited = (at: number, actorName?: string) => ({
      type: 'edited',
      actorId: 'user_tl7c',
      actorName,
      at,
    });
    expect(
      (
        await asApp(`/app/items/${item.id}/events`, {
          events: [edited(TODAY * DAY + 1000, 'Cy'), edited(TODAY * DAY + 3000)],
        })
      ).status,
    ).toBe(204);
    expect(
      (await asApp(`/app/items/${item.id}/events`, { events: [edited(TODAY * DAY + 4000)] }))
        .status,
    ).toBe(204);
    // The next day is another.
    vi.setSystemTime((TODAY + 1) * DAY + 5000);
    expect(
      (await asApp(`/app/items/${item.id}/events`, { events: [edited((TODAY + 1) * DAY)] })).status,
    ).toBe(204);

    // A token minted now: the one from yesterday has run out.
    const adaNow = await person('user_tl7', { teams: [{ id: 'team_tl7' }] });
    const events = (await history(adaNow.auth, item.id)).events.filter((e) => e.type === 'edited');
    expect(events.map((e) => [e.actorId, e.actorName, e.occurredAt])).toEqual([
      ['user_tl7c', null, (TODAY + 1) * DAY],
      ['user_tl7c', 'Cy', TODAY * DAY + 4000],
    ]);
    // Their ids carry Cy's one-way key, never Cy's id: the same key each day, so a day's edits share one event.
    const key = await personEventKey('user_tl7c');
    const ids = logged()
      .filter((e) => e.type === 'edited')
      .map((e) => e.id)
      .sort();
    expect(ids).toEqual([`ed:${item.id}:${key}:${TODAY}`, `ed:${item.id}:${key}:${TODAY + 1}`]);
    expect(ids.some((id) => id.includes('user_tl7c'))).toBe(false);
    // Each day counts as one open, however many edits it reports.
    const days = h.db.sql
      .prepare('SELECT day, opens FROM use_days WHERE person_id = ? AND item_id = ? ORDER BY day')
      .all('user_tl7c', item.id) as { day: number; opens: number }[];
    expect(days.map((d) => [d.day, d.opens])).toEqual([
      [TODAY, 1],
      [TODAY + 1, 1],
    ]);
    // Cy's Most Used counts both.
    const cyNow = await person('user_tl7c', { teams: [{ id: 'team_tl7' }] });
    const recent = await body<{ mostUsed: { id: string; useDays: number; useOpens: number }[] }>(
      await call('/items?view=recent&used=2', { auth: cyNow.auth }),
    );
    expect(recent.mostUsed.map((i) => [i.id, i.useOpens, i.useDays])).toEqual([[item.id, 2, 2]]);
  });

  it('refuses a bad report, and another app’s', async () => {
    const ada = await person('user_tl8');
    const item = await makeItem(ada.auth);
    const ok = { type: 'edited', actorId: 'user_tl8', at: 1 };
    const path = `/app/items/${item.id}/events`;
    for (const events of [
      [{ ...ok, type: 'created' }],
      [{ ...ok, actorId: '' }],
      [{ ...ok, at: -1 }],
      [{ ...ok, actorName: 7 }],
      Array.from({ length: APP_EVENTS_MAX + 1 }, () => ok),
      'nope',
    ]) {
      expect((await asApp(path, { events })).status).toBe(400);
    }
    expect((await asApp(path, { events: [ok] }, 'livediagram', 'ld-key')).status).toBe(403);
    expect((await asApp('/app/items/missing/events', { events: [ok] })).status).toBe(404);
  });

  it('has no images report: the old path is not found and keeps nothing', async () => {
    tick();
    const report = { events: [{ type: 'image_uploaded', actorId: 'user_img', at: Date.now() }] };
    expect((await asApp('/app/people/events', report)).status).toBe(404);
    expect(logged()).toEqual([]);
  });
});

describe('collaboration, from the collab push', () => {
  const thread = (over: Record<string, unknown> = {}) => ({
    elementId: 'el1',
    elementLabel: 'Box',
    resolved: false,
    commentCount: 1,
    participantIds: ['user_c1'],
    mentionedIds: [],
    latestText: 'Looks good',
    latestAuthorName: 'Ada',
    latestAuthorId: 'user_c1',
    firstAt: TODAY * DAY + 5000,
    latestAt: TODAY * DAY + 5000,
    ...over,
  });
  const action = (over: Record<string, unknown> = {}) => ({
    elementId: 'el1',
    actionId: 'a1',
    elementLabel: 'Box',
    name: 'Ship it',
    status: 'open',
    assigneeId: 'user_c2',
    assigneeName: 'Bea',
    assignerId: 'user_c1',
    assignerName: 'Ada',
    teamId: null,
    createdAt: TODAY * DAY + 5000,
    updatedAt: TODAY * DAY + 5000,
    ...over,
  });

  it('records comments, resolutions, assignments and actions done once each', async () => {
    const next = tick();
    const ada = await person('user_c1');
    const item = await makeItem(ada.auth, { title: 'Roadmap' });
    next();
    const push = (threads: unknown[], actions: unknown[]) =>
      asApp(`/app/items/${item.id}/collab/tab1`, { threads, actions });
    expect((await push([thread()], [action()])).status).toBe(204);
    // The same push again records nothing new.
    expect((await push([thread()], [action()])).status).toBe(204);
    next();
    const later = TODAY * DAY + 9000;
    await push(
      [
        thread({
          commentCount: 3,
          latestAt: later,
          latestText: 'Done now',
          resolved: true,
          resolvedById: 'user_c2',
        }),
      ],
      [action({ status: 'done', updatedAt: later, doneById: 'user_c2' })],
    );
    const page = await history(ada.auth, item.id);
    expect(page.events.map((e) => e.type).sort()).toEqual(
      [
        'action_assigned',
        'action_done',
        'comment_resolved',
        'commented',
        'commented',
        'created',
      ].sort(),
    );
    const commented = page.events.filter((e) => e.type === 'commented');
    expect(commented.map((e) => e.detail?.count).sort()).toEqual(['1', '2']);
    expect(commented[0]!.actorId).toBe('user_c1');
    const done = page.events.find((e) => e.type === 'action_done')!;
    expect(done.actorId).toBe('user_c2');
    expect(done.detail?.action).toBe('Ship it');
    // The assigned action's id names Bea by her one-way key, not her id.
    const assigned = page.events.find((e) => e.type === 'action_assigned')!;
    expect(assigned.id.endsWith(`:${await personEventKey('user_c2')}`)).toBe(true);
    expect(assigned.id).not.toContain('user_c2');
  });

  it("takes a deleted comment's words out of History, and a deleted thread's resolution", async () => {
    const next = tick();
    const ada = await person('user_c4');
    const item = await makeItem(ada.auth, { title: 'Notes' });
    next();
    const push = (threads: unknown[]) =>
      asApp(`/app/items/${item.id}/collab/tab1`, { threads, actions: [] });
    await push([thread({ elementId: 'el1' }), thread({ elementId: 'el2' })]);
    await push([
      thread({ elementId: 'el1', commentCount: 3, latestAt: TODAY * DAY + 6000 }),
      thread({ elementId: 'el2', resolved: true }),
    ]);
    const types = async () =>
      (await history(ada.auth, item.id)).events
        .filter((e) => e.type !== 'created')
        .map((e) => `${e.type} ${e.detail?.count ?? ''}`.trim())
        .sort();
    expect(await types()).toEqual([
      'comment_resolved',
      'commented 1',
      'commented 1',
      'commented 2',
    ]);
    // el1 loses its last two comments, el2 goes altogether: their words and its resolution leave with them.
    await push([thread({ elementId: 'el1', commentCount: 1 })]);
    expect(await types()).toEqual(['commented 1']);
    // A comment added again is news again.
    next();
    await push([thread({ elementId: 'el1', commentCount: 2, latestAt: TODAY * DAY + 7000 })]);
    expect(await types()).toEqual(['commented 1', 'commented 1']);
  });

  it("isn't news for a copy's threads, dated before the item was made", async () => {
    const next = tick();
    const ada = await person('user_c3');
    next();
    const item = await makeItem(ada.auth, { title: 'Copy' });
    await asApp(`/app/items/${item.id}/collab/tab1`, {
      threads: [thread({ latestAt: 1, firstAt: 1 })],
      actions: [action({ updatedAt: 1, createdAt: 1 })],
    });
    expect(kinds((await history(ada.auth, item.id)).events)).toEqual(['created Copy']);
  });
});

describe("accounts' team events", () => {
  const renamed = () => ({
    id: 'team_renamed:team_acc:1',
    type: 'team_renamed',
    actorId: 'user_acc',
    title: 'Guild',
    detail: { teamId: 'team_acc', from: 'Old Guild' },
    at: Date.now(),
  });
  const send = (events: unknown[], path = '/internal/events', key = 'merge-key') =>
    call(path, { method: 'POST', auth: key, body: { events } });
  const audited = () =>
    h.db.sql.prepare('SELECT team_id, id, type FROM team_audit_events ORDER BY id').all() as {
      team_id: string;
      id: string;
      type: string;
    }[];

  it('takes team events under the platform, into the team’s audit log, once however often sent', async () => {
    tick();
    expect((await send([renamed()])).status).toBe(204);
    expect((await send([renamed()])).status).toBe(204);
    expect(logged()).toEqual([
      expect.objectContaining({ app: 'liveworkspace', item_id: null, type: 'team_renamed' }),
    ]);
    expect(audited()).toEqual([
      { team_id: 'team_acc', id: 'team_renamed:team_acc:1', type: 'team_renamed' },
    ]);
  });

  it('takes an old outbox’s body, dropping the kinds no longer kept, and not at the old path', async () => {
    tick();
    const old = {
      ...renamed(),
      id: 'team_renamed:team_acc:2',
      scopes: ['t:team_acc', 'p:user_acc'],
    };
    const token = {
      id: 'token_created:tok1',
      type: 'token_created',
      actorId: 'user_acc',
      title: 'CI',
      detail: { tokenId: 'tok1' },
      at: Date.now() + 3 * DAY,
      scopes: ['p:user_acc'],
    };
    const deleted = { ...old, id: 'team_deleted:team_acc', type: 'team_deleted' };
    expect((await send([old, token, deleted], '/internal/timeline')).status).toBe(404);
    expect(logged()).toEqual([]);
    expect((await send([old, token, deleted])).status).toBe(204);
    // A batch of nothing but dropped kinds is taken too: an old outbox's backlog never retries forever.
    const dropped = [
      { ...token, type: 'token_expiring' },
      { ...token, type: 'token_revoked' },
    ];
    expect((await send(dropped)).status).toBe(204);
    expect(logged().map((e) => e.id)).toEqual(['team_renamed:team_acc:2']);
    expect(audited().map((r) => r.id)).toEqual(['team_renamed:team_acc:2']);
  });

  it('refuses another caller, a malformed event, and a kind it never knew', async () => {
    tick();
    expect((await send([renamed()], '/internal/events', 'lp-key')).status).toBe(401);
    for (const events of [
      [{ ...renamed(), type: 'edited' }],
      [{ ...renamed(), id: '' }],
      [{ ...renamed(), title: 7 }],
      ['nope'],
    ]) {
      expect((await send(events)).status, JSON.stringify(events)).toBe(400);
    }
    expect(logged()).toEqual([]);
    // A clock running fast is dated now, at most.
    expect((await send([{ ...renamed(), at: Date.now() + 10 * DAY }])).status).toBe(204);
    const row = h.db.sql.prepare('SELECT occurred_at AS at FROM events').get() as { at: number };
    expect(row.at).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000);
  });
});

describe('one item’s History', () => {
  it('lists that item’s events a page at a time, to its owner and its team alone', async () => {
    const next = tick();
    const ada = await person('user_hist1', { teams: [{ id: 'team_h' }] });
    const bo = await person('user_hist2', { teams: [{ id: 'team_h' }] });
    const eve = await person('user_hist3');
    const item = await makeItem(ada.auth, { title: 'Roadmap', teamId: 'team_h' });
    const other = await makeItem(ada.auth, { title: 'Other' });
    next();
    const patch = (id: string, title: string) =>
      call(`/items/${id}`, { method: 'PATCH', auth: ada.auth, body: { title } });
    await patch(item.id, 'Roadmap 2');
    next();
    await patch(other.id, 'Other 2');
    next();
    const { link } = await body<{ link: { code: string } }>(
      await call(`/items/${item.id}/share`, {
        method: 'POST',
        auth: ada.auth,
        body: { level: 'edit' },
      }),
    );
    next();
    // A favourite is its person's own: only they see it in the History.
    await call(`/favourites/${item.id}`, { method: 'PUT', auth: bo.auth });
    const page = await history(ada.auth, item.id);
    expect(kinds(page.events)).toEqual([
      'shared Roadmap 2',
      'renamed Roadmap 2',
      'created Roadmap',
    ]);
    expect(page.events.every((e) => e.itemId === item.id)).toBe(true);
    expect(kinds((await history(bo.auth, item.id)).events)).toEqual([
      'favourited Roadmap 2',
      'shared Roadmap 2',
      'renamed Roadmap 2',
      'created Roadmap',
    ]);
    const first = await history(ada.auth, item.id, 'limit=2');
    const rest = await history(ada.auth, item.id, `limit=2&cursor=${first.nextCursor}`);
    expect(kinds([...first.events, ...rest.events])).toEqual(kinds(page.events));
    expect(rest.nextCursor).toBeNull();
    // Anyone else is answered as for an item they can't reach: someone outside, a link visitor (even an editor),
    // nobody signed in, an item that isn't there.
    const status = async (id: string, auth: string | null, headers: Record<string, string> = {}) =>
      (await call(`/items/${id}/history`, { auth, headers })).status;
    expect(await status(item.id, eve.auth)).toBe(404);
    expect(await status(item.id, eve.auth, { 'X-Share-Code': link.code })).toBe(404);
    expect(await status(item.id, null, { 'X-Share-Code': link.code })).toBe(404);
    expect(await status(crypto.randomUUID(), ada.auth)).toBe(404);
    // A teammate who left reads it no longer.
    const left = await person('user_hist2');
    expect(await status(item.id, left.auth)).toBe(404);
  });

  it('keeps reading in the Trash and in Archived, its owner’s', async () => {
    const next = tick();
    const ada = await person('user_hist4');
    const binned = await makeItem(ada.auth, { title: 'Binned' });
    next();
    await call(`/items/${binned.id}`, { method: 'DELETE', auth: ada.auth });
    expect(kinds((await history(ada.auth, binned.id)).events)).toEqual([
      'trashed Binned',
      'created Binned',
    ]);
    const shelved = await makeItem(ada.auth, { title: 'Shelved' });
    next();
    await call(`/favourites/${shelved.id}`, { method: 'PUT', auth: ada.auth });
    next();
    const archived = await call(`/items/${shelved.id}/archive`, { method: 'POST', auth: ada.auth });
    expect(archived.status).toBe(200);
    // Archiving drops its favourites, their events with them.
    const after = (await history(ada.auth, shelved.id)).events;
    expect(after.some((e) => e.type === 'favourited')).toBe(false);
    expect(after.at(-1)!.type).toBe('created');
  });

  it('shows the last 30 days only, even before the sweep runs', async () => {
    const next = tick();
    const ada = await person('user_hist5');
    const item = await makeItem(ada.auth, { title: 'Old' });
    next();
    await call(`/items/${item.id}`, { method: 'PATCH', auth: ada.auth, body: { title: 'New' } });
    vi.setSystemTime(TODAY * DAY + EVENT_RETENTION_MS + 500);
    const again = await person('user_hist5');
    expect(kinds((await history(again.auth, item.id)).events)).toEqual(['renamed New']);
  });

  it('refuses a bad page size or cursor', async () => {
    const ada = await person('user_hist6');
    const item = await makeItem(ada.auth);
    for (const query of ['limit=0', `limit=${HISTORY_LIMIT_MAX + 1}`, 'limit=x', 'limit=1.5']) {
      const res = await call(`/items/${item.id}/history?${query}`, { auth: ada.auth });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'invalid_query' });
    }
    const bad = await call(`/items/${item.id}/history?cursor=nope`, { auth: ada.auth });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'invalid_cursor' });
    const most = await history(ada.auth, item.id, `limit=${HISTORY_LIMIT_MAX}`);
    expect(most.events).toHaveLength(1);
  });

  it('has no feed left: the Timeline’s routes and count are gone', async () => {
    const ada = await person('user_hist7');
    expect((await call('/timeline', { auth: ada.auth })).status).toBe(404);
    expect((await call('/timeline/seen', { method: 'POST', auth: ada.auth })).status).toBe(404);
    const dismiss = await call('/timeline/dismiss', {
      method: 'POST',
      auth: ada.auth,
      body: { ids: ['x'] },
    });
    expect(dismiss.status).toBe(404);
    expect(await body(await call('/inbox', { auth: ada.auth }))).not.toHaveProperty('timelineNew');
  });

  it('reads through the events’ item index, never scanning or sorting', () => {
    for (const spec of [
      { itemId: 'it-1', personId: 'user_big', owner: true, limit: 30, now: 1 },
      {
        itemId: 'it-1',
        personId: 'user_big',
        owner: false,
        limit: 30,
        cursor: { at: 5, id: 'x' },
        now: 1,
      },
    ]) {
      const { sql, args } = buildHistoryQuery(spec);
      const lines = h.db.sql
        .prepare(`EXPLAIN QUERY PLAN ${sql}`)
        .all(...(args as SQLInputValue[]))
        .map((r) => String((r as { detail: string }).detail));
      const plan = lines.join('\n');
      expect(plan).toMatch(/SEARCH events USING INDEX events_item \(item_id=\?/);
      expect(plan).not.toMatch(/TEMP B-TREE/);
      expect(
        lines.filter((l) => /\bSCAN events\b/.test(l)),
        plan,
      ).toEqual([]);
    }
  });
});

describe('the bound', () => {
  it('answers two History pages within budget beside 100,000 other events, its own 2,000 deep', async () => {
    const db = h.db.sql;
    const ada = await person('user_big');
    const item = await makeItem(ada.auth, { title: 'Busy' });
    const event = db.prepare(
      `INSERT INTO events (id, app, item_id, actor_id, type, title, occurred_at)
       VALUES (?, 'liveplanner', ?, ?, ?, ?, ?)`,
    );
    const others = db.prepare(
      `INSERT INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', 'user_o', NULL, 'p:user_o', NULL, 'Other', '{}', 1, 1)`,
    );
    const now = Date.now();
    db.exec('BEGIN');
    for (let i = 0; i < 1000; i++) others.run(`it-${i}`);
    for (let i = 0; i < 100_000; i++) {
      event.run(`o-${i}`, `it-${i % 1000}`, 'user_o', 'edited', 'Other', now - (i % 1000) * 1000);
    }
    // Its own: mostly edits, with someone else's favourites among them (skipped in the index walk).
    for (let i = 0; i < 2000; i++) {
      const fav = i % 10 === 0;
      event.run(
        `m-${i}`,
        item.id,
        fav ? 'user_x' : 'user_big',
        fav ? 'favourited' : 'edited',
        'Busy',
        now - i * 1000,
      );
    }
    db.exec('COMMIT');
    let first!: HistoryPage;
    let second!: HistoryPage;
    // Budgets are CPU time, not wall clock: a busy runner's wait for a core is not the query's cost.
    const ms = await cpuMsOfAsync(async () => {
      first = await history(ada.auth, item.id);
      second = await history(ada.auth, item.id, `cursor=${first.nextCursor}`);
    });
    expect(first.events).toHaveLength(30);
    expect(second.events).toHaveLength(30);
    expect([...first.events, ...second.events].some((e) => e.type === 'favourited')).toBe(false);
    expect(second.events[0]!.occurredAt).toBeLessThan(first.events.at(-1)!.occurredAt);
    console.info(`[events] two History pages beside 102,000 events in ${ms.toFixed(1)} ms of CPU`);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
    // Seeding outruns the 5s default on a busy runner; the budget above times only the reads.
  }, 30_000);

  it('writes a full batch of each source in a few statements, within budget', async () => {
    tick();
    const ada = await person('user_w1', { teams: [{ id: 'team_w' }] });
    const item = await makeItem(ada.auth, { title: 'Busy' });
    const threads = Array.from({ length: 500 }, (_, i) => ({
      elementId: `el${i}`,
      elementLabel: 'Box',
      resolved: false,
      commentCount: 1,
      participantIds: ['user_w1'],
      mentionedIds: [],
      latestText: 'Hi',
      latestAuthorName: 'Ada',
      firstAt: Date.now(),
      latestAt: Date.now() + i,
    }));
    const statements = vi.spyOn(h.db.env.INDEX_DB, 'batch');
    let ms = await cpuMsOfAsync(() =>
      asApp(`/app/items/${item.id}/collab/tab1`, { threads, actions: [] }),
    );
    const written = statements.mock.calls.at(-1)![0].length;
    console.info(
      `[events] a 500-thread collab push (100 events kept) in ${ms.toFixed(1)} ms of CPU, ${written} statements`,
    );
    expect(written).toBeLessThan(12);
    expect(ms).toBeLessThan(cpuBudgetMs(250));
    // The newest 100 of them (and the item's making).
    const first = await history(ada.auth, item.id, 'limit=100');
    const rest = await history(ada.auth, item.id, `limit=2&cursor=${first.nextCursor}`);
    const kept = [...first.events, ...rest.events];
    expect(kept.filter((e) => e.type === 'commented')).toHaveLength(100);
    const events = Array.from({ length: 100 }, (_, i) => ({
      id: `team_joined:team_w:${i}`,
      type: 'team_joined',
      actorId: `user_j${i}`,
      title: 'Guild',
      detail: { teamId: 'team_w' },
      at: Date.now(),
    }));
    ms = await cpuMsOfAsync(() =>
      call('/internal/events', { method: 'POST', auth: 'merge-key', body: { events } }),
    );
    console.info(
      `[events] 100 account events in one call in ${ms.toFixed(1)} ms of CPU, ${statements.mock.calls.at(-1)![0].length} statements`,
    );
    // One for the events and one for the team audit log, whatever the count.
    expect(statements.mock.calls.at(-1)![0]).toHaveLength(2);
    expect(
      h.db.sql
        .prepare("SELECT COUNT(*) AS n FROM team_audit_events WHERE team_id = 'team_w'")
        .get(),
    ).toEqual({ n: 100 });
    expect(ms).toBeLessThan(cpuBudgetMs(250));
    statements.mockRestore();
  });
});

describe('the daily sweep', () => {
  const NOW = TODAY * DAY;
  const CUT = NOW - EVENT_RETENTION_MS;
  // `old` events past the 30 days (old-0 the newest of them) and `fresh` inside them, on a thousand items.
  function seed(old: number, fresh: number) {
    const db = h.db.sql;
    const item = db.prepare(
      `INSERT OR IGNORE INTO items (id, app, kind, owner_id, team_id, scope, folder_id, title, summary, created_at, updated_at)
       VALUES (?, 'liveplanner', 'plan', 'user_s', NULL, 'p:user_s', NULL, 'Swept', '{}', 1, 1)`,
    );
    const event = db.prepare(
      `INSERT INTO events (id, app, item_id, actor_id, type, title, occurred_at)
       VALUES (?, 'liveplanner', ?, 'user_s', 'edited', 'Swept', ?)`,
    );
    db.exec('BEGIN');
    for (let i = 0; i < 1000; i++) item.run(`sw-${i}`);
    for (let i = 0; i < old; i++) event.run(`old-${i}`, `sw-${i % 1000}`, CUT - 1 - i);
    for (let i = 0; i < fresh; i++) event.run(`new-${i}`, `sw-${i % 1000}`, CUT + i);
    db.exec('COMMIT');
  }
  const count = (where: string) =>
    (h.db.sql.prepare(`SELECT COUNT(*) AS n FROM events WHERE ${where}`).get() as { n: number }).n;

  it('deletes what is past 30 days, and nothing newer', async () => {
    seed(1234, 300);
    expect(await sweepEvents(h.db.env, NOW)).toEqual({ deleted: 1234, more: false });
    expect(count('true')).toBe(300);
    // An event exactly 30 days old stays a day more.
    expect(count(`occurred_at = ${CUT}`)).toBe(1);
    expect(await sweepEvents(h.db.env, NOW)).toEqual({ deleted: 0, more: false });
  });

  it('stops at its round cap on a backlog, the oldest gone first, the rest left for the next day', async () => {
    seed(5 * 3 + 2, 10);
    expect(await sweepEvents(h.db.env, NOW, { chunk: 5, rounds: 3 })).toEqual({
      deleted: 15,
      more: true,
    });
    expect(count("id IN ('old-16', 'old-15', 'old-2')")).toBe(0);
    expect(count("id IN ('old-0', 'old-1')")).toBe(2);
    expect(await sweepEvents(h.db.env, NOW, { chunk: 5, rounds: 3 })).toEqual({
      deleted: 2,
      more: false,
    });
  });

  it('runs a realistic day and a worst-case backlog within budget, through the time index', async () => {
    const { sql } = h.db;
    const plan = sql
      .prepare(
        `EXPLAIN QUERY PLAN DELETE FROM events WHERE rowid IN (
           SELECT rowid FROM events WHERE occurred_at < ? ORDER BY occurred_at LIMIT ?)`,
      )
      .all(CUT, EVENT_SWEEP_CHUNK)
      .map((r) => String((r as { detail: string }).detail))
      .join('\n');
    expect(plan).toMatch(/events USING (COVERING )?INDEX events_occurred/);
    expect(plan).not.toMatch(/TEMP B-TREE/);
    // A realistic day: some 5,000 events lapse, beside a month of 150,000 kept.
    seed(5_000, 150_000);
    let swept!: { deleted: number; more: boolean };
    let ms = await cpuMsOfAsync(async () => {
      swept = await sweepEvents(h.db.env, NOW);
    });
    expect(swept).toEqual({ deleted: 5_000, more: false });
    console.info(`[events] sweep: a day's 5,000 beside 150,000 kept in ${ms.toFixed(1)} ms of CPU`);
    expect(ms).toBeLessThan(cpuBudgetMs(1_000));
    // The worst case: a backlog three times what one run may take. It stops at its cap, never past it.
    const cap = EVENT_SWEEP_CHUNK * EVENT_SWEEP_ROUNDS;
    sql.exec('DELETE FROM events');
    seed(cap * 3, 0);
    ms = await cpuMsOfAsync(async () => {
      swept = await sweepEvents(h.db.env, NOW);
    });
    expect(swept).toEqual({ deleted: cap, more: true });
    expect(count('true')).toBe(cap * 2);
    console.info(
      `[events] sweep: ${cap * 3} lapsed, one run's cap of ${cap} (${EVENT_SWEEP_ROUNDS} x ${EVENT_SWEEP_CHUNK}) in ${ms.toFixed(1)} ms of CPU`,
    );
    expect(ms).toBeLessThan(cpuBudgetMs(1_000));
  }, 60_000);
});
