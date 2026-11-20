import { describe, expect, it, vi } from 'vitest';
import {
  dueRows,
  giveUpStale,
  NOTICE_GIVE_UP_MS,
  NOTICE_RETRY_AFTER_MS,
  settle,
  type NoticeQueue,
} from './notice-queue';
import { h, useHarness } from './test-support';

useHarness();

const QUEUE: NoticeQueue = {
  table: 'assistant_notices',
  givenUp: '[test] given up',
  notTaken: '[test] not taken',
};
const MERGES: NoticeQueue = {
  table: 'person_app_merges',
  givenUp: '[test] merges given up',
  notTaken: '[test] merge not taken',
};
const NOW = 10 * NOTICE_GIVE_UP_MS;

function notice(item: string, options: { client?: string; created?: number; tried?: number } = {}) {
  h.db.sql
    .prepare(
      `INSERT INTO assistant_notices (person_id, client, app, item_id, created_at, last_attempt_at)
       VALUES ('user_ada', ?, 'liveplanner', ?, ?, ?)`,
    )
    .run(options.client ?? 'Claude', item, options.created ?? NOW, options.tried ?? null);
}

const left = () =>
  h.db.sql
    .prepare(
      'SELECT client, item_id, attempts, last_attempt_at FROM assistant_notices ORDER BY client, item_id',
    )
    .all() as {
    client: string;
    item_id: string;
    attempts: number;
    last_attempt_at: number | null;
  }[];

const key = { person_id: 'user_ada', client: 'Claude', app: 'liveplanner' as const };

describe('the shared notice retry', () => {
  it('gives up rows recorded over a week ago, in one batch with what the queue adds, and logs it', async () => {
    notice('old', { created: NOW - NOTICE_GIVE_UP_MS - 1 });
    notice('edge', { created: NOW - NOTICE_GIVE_UP_MS });
    notice('new');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = h.db.env.INDEX_DB;
    await giveUpStale(
      db,
      QUEUE,
      NOW,
      db.prepare("DELETE FROM assistant_notices WHERE item_id = 'new'"),
    );
    expect(left().map((r) => r.item_id)).toEqual(['edge']);
    expect(warn).toHaveBeenCalledWith('[test] given up', { rows: 1 });

    warn.mockClear();
    await giveUpStale(db, QUEUE, NOW);
    expect(left().map((r) => r.item_id)).toEqual(['edge']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('takes the distinct due groups: never tried, or last tried over an hour ago', async () => {
    notice('a', { client: 'Claude' });
    notice('b', { client: 'Claude', tried: NOW - NOTICE_RETRY_AFTER_MS - 1 });
    notice('c', { client: 'Cursor', tried: NOW - NOTICE_RETRY_AFTER_MS });
    notice('d', { client: 'Zed', tried: NOW - 1 });
    const db = h.db.env.INDEX_DB;
    expect(await dueRows(db, QUEUE, 'client', 10, NOW)).toEqual([{ client: 'Claude' }]);
    expect(await dueRows(db, QUEUE, 'item_id', 10, NOW)).toEqual([
      { item_id: 'a' },
      { item_id: 'b' },
    ]);
    expect(await dueRows(db, QUEUE, 'item_id', 1, NOW)).toHaveLength(1);
    expect(await dueRows(db, QUEUE, 'client', 10, NOW + 1)).toEqual([
      { client: 'Claude' },
      { client: 'Cursor' },
    ]);
  });

  it('deletes only the confirmed scope, and counts an app this deployment does not run as confirmed', async () => {
    for (const item of ['a', 'b', 'c']) notice(item);
    notice('a', { client: 'Cursor' });
    const db = h.db.env.INDEX_DB;
    const scopes = (items: string[]) => ({
      confirm: { key, items },
      fail: { key },
    });
    expect(await settle(db, QUEUE, { ok: true }, scopes(['a', 'b']), NOW)).toBe(true);
    expect(left().map((r) => `${r.client}:${r.item_id}`)).toEqual(['Claude:c', 'Cursor:a']);
    expect(
      await settle(db, QUEUE, { ok: false, error: 'app_not_configured' }, scopes(['c']), NOW),
    ).toBe(true);
    expect(left().map((r) => `${r.client}:${r.item_id}`)).toEqual(['Cursor:a']);
  });

  it('confirms a whole key with no items', async () => {
    const db = h.db.env.INDEX_DB;
    h.db.sql
      .prepare(
        `INSERT INTO person_app_merges (guest_id, user_id, app, created_at)
         VALUES ('guest_1', 'user_new', 'liveplanner', ?), ('guest_1', 'user_new', 'livediagram', ?)`,
      )
      .run(NOW, NOW);
    const merge = { guest_id: 'guest_1', app: 'liveplanner' as const };
    // A row merged again since (user_id rewritten) is not the one confirmed: it stays to be told.
    const stale = { confirm: { key: { ...merge, user_id: 'user_old' } }, fail: { key: merge } };
    expect(await settle(db, MERGES, { ok: true }, stale, NOW)).toBe(true);
    const fresh = { confirm: { key: { ...merge, user_id: 'user_new' } }, fail: { key: merge } };
    expect(
      h.db.sql.prepare('SELECT COUNT(*) AS n FROM person_app_merges').get() as { n: number },
    ).toEqual({ n: 2 });
    expect(await settle(db, MERGES, { ok: true }, fresh, NOW)).toBe(true);
    expect(h.db.sql.prepare('SELECT app FROM person_app_merges').all()).toEqual([
      { app: 'livediagram' },
    ]);
  });

  it('marks a try on the fail scope alone and logs it', async () => {
    for (const item of ['a', 'b']) notice(item);
    notice('a', { client: 'Cursor' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = h.db.env.INDEX_DB;
    const outcome = { ok: false as const, error: 'http_503' };
    // The whole group, as person notices mark it.
    expect(await settle(db, QUEUE, outcome, { confirm: { key }, fail: { key } }, NOW)).toBe(false);
    // Only the batch, as AI tool notices mark it.
    const batch = { key, items: ['a'] };
    expect(await settle(db, QUEUE, outcome, { confirm: batch, fail: batch }, NOW + 1)).toBe(false);
    expect(left()).toEqual([
      { client: 'Claude', item_id: 'a', attempts: 2, last_attempt_at: NOW + 1 },
      { client: 'Claude', item_id: 'b', attempts: 1, last_attempt_at: NOW },
      { client: 'Cursor', item_id: 'a', attempts: 0, last_attempt_at: null },
    ]);
    expect(warn).toHaveBeenCalledWith('[test] not taken', {
      app: 'liveplanner',
      error: 'http_503',
    });
  });
});
