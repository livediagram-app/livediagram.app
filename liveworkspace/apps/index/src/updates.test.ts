// Updates in the Inbox (one-explorer-contracts.md "What an item pushes" and "Inbox"): the push and its refusals, the
// rows a read lists (for whom, reach, the Trash, 14 days, the app filter), the daily sweep and a closed account.
import {
  INBOX_UPDATES_MS,
  UPDATE_PEOPLE_MAX,
  UPDATES_PUSH_MAX,
  type InboxResponse,
  type UpdatePush,
} from '@liveworkspace/index-client';
import { describe, expect, it } from 'vitest';
import { ANONYMISED_PERSON } from './account-purge';
import { body, call, h, makeItem, person, useHarness } from './test-support';
import { inboxUpdateOf, parseUpdate, sweepUpdates } from './updates';

useHarness();

const push = (itemId: string, updates: unknown, app = 'liveplanner', key = 'lp-key') =>
  call(`/app/items/${itemId}/updates`, {
    method: 'PUT',
    auth: key,
    headers: { 'X-Index-App': app },
    body: { updates },
  });

const inbox = async (auth: string, query = '') =>
  body<InboxResponse>(await call(`/inbox${query}`, { auth }));

const update = (patch: Partial<UpdatePush> = {}): UpdatePush => ({
  id: 'u1',
  tabId: 'page-1',
  tabName: 'On-Call',
  kinds: ['saved'],
  actors: [{ id: 'user_a', name: 'Ada' }],
  actorCount: 1,
  count: 2,
  firstAt: Date.now() - 1000,
  latestAt: Date.now(),
  people: ['user_b'],
  ...patch,
});

async function teamItem() {
  const ada = await person('user_a', { teams: [{ id: 'team1' }] });
  const bob = await person('user_b', { teams: [{ id: 'team1' }] });
  const item = await makeItem(ada.auth, { title: 'Handbook', teamId: 'team1' });
  return { ada, bob, item };
}

describe('the updates push', () => {
  it('lists an update to the people it is for, on an item they reach', async () => {
    const { ada, bob, item } = await teamItem();
    const res = await push(item.id, [update()]);
    expect(res.status).toBe(204);
    const forBob = await inbox(bob.auth);
    expect(forBob.updates).toEqual([
      {
        id: 'u1',
        app: 'liveplanner',
        itemId: item.id,
        itemTitle: 'Handbook',
        itemTeamId: 'team1',
        tabId: 'page-1',
        tabName: 'On-Call',
        kinds: ['saved'],
        actors: [{ id: 'user_a', name: 'Ada' }],
        actorCount: 1,
        count: 2,
        firstAt: expect.any(Number),
        latestAt: expect.any(Number),
      },
    ]);
    // Not for Ada, whose change it is.
    expect((await inbox(ada.auth)).updates).toEqual([]);
  });

  it('replaces the item’s set whole, and an empty list clears it', async () => {
    const { bob, item } = await teamItem();
    await push(item.id, [update({ id: 'old' }), update({ id: 'kept' })]);
    await push(item.id, [update({ id: 'kept', kinds: ['saved', 'moved'] })]);
    const listed = (await inbox(bob.auth)).updates!;
    expect(listed.map((u) => [u.id, u.kinds])).toEqual([['kept', ['saved', 'moved']]]);
    expect(
      h.db.sql.prepare('SELECT COUNT(*) AS n FROM item_update_people').get() as { n: number },
    ).toEqual({ n: 1 });
    expect((await push(item.id, [])).status).toBe(204);
    expect((await inbox(bob.auth)).updates).toEqual([]);
  });

  it('lists nobody who no longer reaches the item, nothing in the Trash, nothing past 14 days', async () => {
    const { bob, item } = await teamItem();
    const carl = await person('user_c');
    const old = Date.now() - INBOX_UPDATES_MS - 60_000;
    await push(item.id, [
      update({ id: 'fresh', people: ['user_b', 'user_c'] }),
      update({ id: 'stale', firstAt: old, latestAt: old }),
    ]);
    expect((await inbox(carl.auth)).updates).toEqual([]);
    expect((await inbox(bob.auth)).updates!.map((u) => u.id)).toEqual(['fresh']);
    h.db.sql.prepare('UPDATE items SET trashed_at = ? WHERE id = ?').run(Date.now(), item.id);
    expect((await inbox(bob.auth)).updates).toEqual([]);
  });

  it('reads through the app filter, newest first, and within the limit', async () => {
    const { bob, item } = await teamItem();
    const now = Date.now();
    await push(item.id, [
      update({ id: 'a', latestAt: now - 2000, firstAt: now - 3000 }),
      update({ id: 'b', latestAt: now, firstAt: now - 3000 }),
    ]);
    expect((await inbox(bob.auth)).updates!.map((u) => u.id)).toEqual(['b', 'a']);
    expect((await inbox(bob.auth, '?app=liveplanner&limit=1')).updates!.map((u) => u.id)).toEqual([
      'b',
    ]);
    expect((await inbox(bob.auth, '?app=livediagram')).updates).toEqual([]);
  });

  it('refuses another app’s item, an unknown item and a malformed push', async () => {
    const { item } = await teamItem();
    expect((await push(item.id, [update()], 'livediagram', 'ld-key')).status).toBe(403);
    expect((await push('nope', [update()])).status).toBe(404);
    const bad = await push(item.id, [update({ id: 'x' }), update({ id: 'x' })]);
    expect(bad.status).toBe(400);
    expect(await body(bad)).toMatchObject({ error: 'invalid_updates' });
    expect(
      (
        await call(`/app/items/${item.id}/updates`, {
          method: 'PUT',
          auth: 'lp-key',
          headers: { 'X-Index-App': 'liveplanner' },
          body: { nothing: true },
        })
      ).status,
    ).toBe(400);
    const tooMany = Array.from({ length: UPDATES_PUSH_MAX + 1 }, (_, i) => update({ id: `u${i}` }));
    expect((await push(item.id, tooMany)).status).toBe(400);
  });

  it('takes a full push, 50 updates of 200 people, in one batch', async () => {
    const { item } = await teamItem();
    const people = Array.from({ length: UPDATE_PEOPLE_MAX }, (_, i) => `user_p${i}`);
    const full = Array.from({ length: UPDATES_PUSH_MAX }, (_, i) =>
      update({ id: `u${i}`, people }),
    );
    expect((await push(item.id, full)).status).toBe(204);
    expect(
      h.db.sql.prepare('SELECT COUNT(*) AS n FROM item_update_people').get() as { n: number },
    ).toEqual({ n: UPDATES_PUSH_MAX * UPDATE_PEOPLE_MAX });
  });

  it('takes an archived item’s push and keeps nothing', async () => {
    const { bob, item } = await teamItem();
    h.db.sql.prepare("UPDATE items SET scope = 'a:user_a' WHERE id = ?").run(item.id);
    expect((await push(item.id, [update()])).status).toBe(204);
    h.db.sql.prepare("UPDATE items SET scope = 'team:team1' WHERE id = ?").run(item.id);
    expect((await inbox(bob.auth)).updates).toEqual([]);
  });

  it('goes with its item', async () => {
    const { item } = await teamItem();
    await push(item.id, [update()]);
    h.db.sql.prepare('DELETE FROM items WHERE id = ?').run(item.id);
    const left = h.db.sql
      .prepare(
        'SELECT (SELECT COUNT(*) FROM item_updates) + (SELECT COUNT(*) FROM item_update_people) AS n',
      )
      .get() as { n: number };
    expect(left.n).toBe(0);
  });
});

describe('parseUpdate', () => {
  const base = update();
  it.each([
    ['a missing id', { ...base, id: '' }],
    ['a long id', { ...base, id: 'x'.repeat(129) }],
    ['no tab', { ...base, tabId: '' }],
    ['a name that is no text', { ...base, tabName: 3 }],
    ['no kinds', { ...base, kinds: [] }],
    ['an unknown kind', { ...base, kinds: ['commented'] }],
    ['a repeated kind', { ...base, kinds: ['saved', 'saved'] }],
    ['too many actors', { ...base, actors: Array(6).fill({ id: 'user_a', name: 'A' }) }],
    ['a malformed actor', { ...base, actors: [{ id: 'bad id', name: 'A' }] }],
    ['an actor with no name', { ...base, actors: [{ id: 'user_a' }] }],
    ['an actor count under the actors', { ...base, actorCount: 0 }],
    ['no change', { ...base, count: 0 }],
    ['times out of order', { ...base, firstAt: 10, latestAt: 5 }],
    ['nobody', { ...base, people: [] }],
    ['a repeated person', { ...base, people: ['user_b', 'user_b'] }],
    ['a malformed person', { ...base, people: ['no way'] }],
    ['no object', null],
    ['a list', []],
  ])('refuses %s', (_, value) => {
    expect(parseUpdate(value)).toBeNull();
  });

  it('cuts long names', () => {
    const parsed = parseUpdate({
      ...base,
      tabName: 'p'.repeat(300),
      actors: [{ id: 'user_a', name: 'n'.repeat(100) }],
    });
    expect(parsed!.tabName).toHaveLength(200);
    expect(parsed!.actors[0]!.name).toHaveLength(80);
  });
});

describe('inboxUpdateOf', () => {
  it('reads a stored list that is no list, or no JSON, as empty', () => {
    const row = {
      update_id: 'u',
      app: 'liveplanner' as const,
      item_id: 'i',
      item_title: 'T',
      item_team_id: null,
      tab_id: 'p',
      tab_name: 'P',
      kinds: '{"saved":1}',
      actors: 'not json',
      actor_count: 0,
      count: 1,
      first_at: 1,
      latest_at: 2,
    };
    expect(inboxUpdateOf(row)).toMatchObject({ kinds: [], actors: [] });
  });
});

describe('the daily sweep', () => {
  it('drops updates past 14 days with their people, in bounded rounds', async () => {
    const { item } = await teamItem();
    const old = Date.now() - INBOX_UPDATES_MS - 60_000;
    await push(item.id, [
      update({ id: 'old-1', firstAt: old, latestAt: old }),
      update({ id: 'old-2', firstAt: old, latestAt: old }),
      update({ id: 'new' }),
    ]);
    expect(await sweepUpdates(h.db.env, Date.now(), { chunk: 1, rounds: 1 })).toEqual({
      deleted: 1,
      more: true,
    });
    expect(await sweepUpdates(h.db.env)).toEqual({ deleted: 1, more: false });
    const ids = h.db.sql.prepare('SELECT update_id FROM item_update_people').all() as {
      update_id: string;
    }[];
    expect(ids.map((r) => r.update_id)).toEqual(['new']);
  });
});

describe('a closed account', () => {
  it('loses the updates told to them, and their name on the updates they made', async () => {
    const { item } = await teamItem();
    await push(item.id, [
      update({
        actors: [
          { id: 'user_b', name: 'Bob' },
          { id: 'user_a', name: 'Ada' },
        ],
        actorCount: 2,
        people: ['user_a', 'user_b'],
      }),
    ]);
    const res = await call('/internal/purge-person', {
      method: 'POST',
      auth: 'merge-key',
      body: { personId: 'user_b', teamIds: [] },
    });
    expect(res.status).toBe(200);
    const people = h.db.sql.prepare('SELECT person_id FROM item_update_people').all() as {
      person_id: string;
    }[];
    expect(people.map((p) => p.person_id)).toEqual(['user_a']);
    const row = h.db.sql.prepare('SELECT actors FROM item_updates').get() as { actors: string };
    expect(JSON.parse(row.actors)).toEqual([
      { id: ANONYMISED_PERSON, name: 'Someone' },
      { id: 'user_a', name: 'Ada' },
    ]);
  });
});
