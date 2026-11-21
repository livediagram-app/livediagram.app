import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOMATION_LATE_MAX_MS } from '../../limits';
import { rowsOf, world, type World } from '../item/test-kit';
import { COLLAB_SEEN_SCHEMA_STEP, CollabWatch } from './collab-watch';
import { ItemStandingKeeper, waitPutAwayWords, type StoredStanding } from './standing';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function kept(w: World, withCollab = false) {
  const stored = new Map<string, StoredStanding>();
  const armed = { count: 0 };
  const fail = { put: false };
  w.sql.exec(COLLAB_SEEN_SCHEMA_STEP);
  const collab = new CollabWatch({
    engine: () => w.engine,
    sql: () => w.sql,
    ready: () => w.state.ready,
    arm: () => {},
    links: 'document_tabs',
    rows: () => ({ threads: [], actions: [] }),
  });
  const keeper: ItemStandingKeeper = new ItemStandingKeeper({
    key: 'itemStanding',
    itemWord: 'document',
    put: async (key, value) => {
      if (fail.put) throw new Error('storage is down');
      stored.set(key, value);
    },
    sql: () => w.sql,
    ready: () => w.state.ready,
    engine: () => w.engine,
    ...(withCollab ? { collab: () => collab } : {}),
    arm: () => void (armed.count += 1),
  });
  // The engine reads put away from the keeper, as a room's does.
  w.kit.putAway = () => keeper.putAway;
  return { keeper, stored, armed, fail, collab };
}

describe('where an item stands', () => {
  it('is live until it hears otherwise, and reads only a stored standing', () => {
    const w = world();
    const { keeper } = kept(w);
    expect(keeper.key).toBe('itemStanding');
    expect(keeper.putAway).toBe(false);
    for (const junk of [undefined, null, 'x', { putAway: 'yes', at: 1 }, { putAway: true }]) {
      keeper.restore(junk);
      expect(keeper.putAway).toBe(false);
    }
    keeper.restore({ putAway: true, at: 5 });
    expect(keeper.putAway).toBe(true);
    expect(keeper.newer({ putAway: false, at: 5 })).toBe(false);
    expect(keeper.newer({ putAway: false, at: 6 })).toBe(true);
    keeper.forget();
    expect(keeper.putAway).toBe(false);
  });

  it('keeps the newest push, and the rules follow a change of put away', async () => {
    const w = world();
    const { keeper, stored, armed } = kept(w, true);
    const sync = vi.spyOn(w.engine, 'sync');
    const clear = vi.spyOn(w.engine.schedule, 'clear');
    const restore = vi.spyOn(w.engine, 'restore');
    await keeper.take({ archived: true, trashed: false, at: 10 });
    expect(stored.get('itemStanding')).toEqual({ putAway: true, trashed: false, at: 10 });
    expect(keeper.putAway).toBe(true);
    expect(sync).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
    expect(armed.count).toBe(1);
    // Older: ignored. Newer but the same: kept, nothing else.
    await keeper.take({ archived: false, trashed: false, at: 9 });
    expect(keeper.putAway).toBe(true);
    await keeper.take({ archived: false, trashed: true, at: 11 });
    expect(stored.get('itemStanding')).toEqual({ putAway: true, trashed: true, at: 11 });
    expect(armed.count).toBe(1);
    await keeper.take({ archived: false, trashed: false, at: 12 });
    expect(keeper.putAway).toBe(false);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(2);
    expect(armed.count).toBe(2);
  });

  it('takes a grant signed since it was put away, and only then', async () => {
    const w = world();
    const { keeper, fail } = kept(w);
    // Never heard: a grant changes nothing.
    await keeper.takeGrant({ iatMs: 50 });
    expect(keeper.fromGrant({ iatMs: 50 })).toBeNull();
    keeper.restore({ putAway: true, at: 10_000 });
    expect(keeper.fromGrant({})).toBeNull();
    expect(keeper.fromGrant({ iat: 5 })).toBeNull();
    expect(keeper.fromGrant({ iat: 20, trashed: true })).toBeNull();
    expect(keeper.fromGrant({ iat: 20 })).toEqual({ putAway: false, trashed: false, at: 20_000 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fail.put = true;
    await keeper.takeGrant({ iatMs: 30_000 });
    expect(warn).toHaveBeenCalled();
    expect(keeper.putAway).toBe(true);
    fail.put = false;
    await keeper.takeGrant({ iatMs: 30_000 });
    expect(keeper.putAway).toBe(false);
  });

  // Work Tracker 1323: a grant from before the item was put away (an API token's, cached by its worker) is refused.
  it('refuses a grant signed before it was put away, as archived or trashed', async () => {
    const w = world();
    const { keeper } = kept(w);
    expect(keeper.refusal({ iat: 1 })).toBeNull();
    await keeper.take({ archived: true, trashed: false, at: 10_000 });
    expect(keeper.refusal({ iat: 9 })).toBe('archived');
    expect(keeper.refusal({ iat: 10 })).toBeNull();
    await keeper.take({ archived: true, trashed: true, at: 20_000 });
    expect(keeper.refusal({ iatMs: 19_999 })).toBe('trashed');
    // A trashed standing read back from storage keeps saying so; one stored before it was kept reads as archived.
    keeper.restore({ putAway: true, trashed: true, at: 20_000 });
    expect(keeper.refusal({ iat: 1 })).toBe('trashed');
    keeper.restore({ putAway: true, at: 20_000 });
    expect(keeper.refusal({ iat: 1 })).toBe('archived');
    // Back: nothing is refused.
    await keeper.take({ archived: false, trashed: false, at: 30_000 });
    expect(keeper.refusal({ iat: 1 })).toBeNull();
  });

  it('skips a held run more than a day late when it comes back, and keeps a fresher one', () => {
    const w = world();
    const { keeper } = kept(w);
    const now = Date.UTC(2027, 0, 4);
    const hold = (id: string, at: number) => {
      w.sql.exec(
        'INSERT INTO automation_waiting (id, rule_id, at, event) VALUES (?, ?, ?, ?)',
        id,
        'r1',
        at,
        '{}',
      );
      w.sql.exec(
        'INSERT INTO automation_runs (id, rule_id, at, result, body) VALUES (?, ?, ?, ?, ?)',
        id,
        'r1',
        at,
        'waiting',
        JSON.stringify({ id, ruleId: 'r1', at, result: 'waiting', steps: [] }),
      );
    };
    hold('late', now - AUTOMATION_LATE_MAX_MS - 1);
    hold('fresh', now - 1000);
    keeper.resume(now);
    expect(rowsOf(w.sql, 'SELECT id FROM automation_waiting')).toEqual([{ id: 'fresh' }]);
    const late = rowsOf(w.sql, "SELECT result, body FROM automation_runs WHERE id = 'late'")[0]!;
    expect(late['result']).toBe('skipped');
    expect((JSON.parse(String(late['body'])) as { reason?: string }).reason).toBe(
      waitPutAwayWords('document'),
    );
    // No schema yet: nothing to settle, the rules still restore.
    w.state.ready = false;
    expect(() => keeper.resume(now)).not.toThrow();
  });
});
