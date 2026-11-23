// Watches on a plan's Sheets (liveworkspace/docs/specs/004-index/sheet-sources.md "Keeping in step"): kept a day from
// the last read and capped, a burst of changes told once, ids only, the watchers the index answers gone forgotten,
// and an unwatched Sheet costing nothing but a probe.
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { answerInternal, type InternalRoom } from '../room-internal';
import {
  SHEET_CHANGE_SETTLE_MS,
  SHEET_WATCH_TTL_MS,
  SHEET_WATCHERS_PER_SOURCE,
  SheetWatches,
  watchIdsOfOp,
} from './sheet-watchers';

let now = 1_000_000;
let db: DatabaseSync;
const sql = () => nodeItemSql(db);
const rows = () => db.prepare('SELECT watcher, sheet_id FROM sheet_watches ORDER BY watcher').all();

beforeEach(() => {
  vi.useFakeTimers();
  now = 1_000_000;
  db = new DatabaseSync(':memory:');
});
afterEach(() => vi.useRealTimers());

function watches(answer: (watchers: readonly string[]) => string[] | Promise<string[]> = () => []) {
  const sheetChanged = vi.fn(
    async (_plan: string, _sheets: readonly string[], watchers: readonly string[]) =>
      answer(watchers),
  );
  const store = new SheetWatches(
    sql(),
    () => ({ sheetChanged }),
    () => now,
  );
  return { store, sheetChanged };
}

describe('keeping watches', () => {
  it('keeps one row per watcher and sheet, a day from the last read', () => {
    const { store } = watches();
    store.watch('P1', 's1', 'doc_a');
    store.watch('P1', 's1', 'doc_a');
    store.watch('P1', 's2', 'doc_a');
    expect(rows()).toEqual([
      { watcher: 'doc_a', sheet_id: 's1' },
      { watcher: 'doc_a', sheet_id: 's2' },
    ]);
    now += SHEET_WATCH_TTL_MS + 1;
    store.watch('P1', 's3', 'doc_b');
    expect(rows()).toEqual([{ watcher: 'doc_b', sheet_id: 's3' }]);
  });

  it('keeps at most SHEET_WATCHERS_PER_SOURCE, the soonest to lapse going first', () => {
    const { store } = watches();
    for (let i = 0; i <= SHEET_WATCHERS_PER_SOURCE; i++) {
      now += 1;
      store.watch('P1', 's1', `doc_${String(i).padStart(3, '0')}`);
    }
    const kept = rows();
    expect(kept).toHaveLength(SHEET_WATCHERS_PER_SOURCE);
    expect(kept.some((r) => r.watcher === 'doc_000')).toBe(false);
  });
});

describe('telling the index', () => {
  it('gathers a burst of changes into one signal, ids only', async () => {
    const { store, sheetChanged } = watches();
    store.watch('P1', 's1', 'doc_a');
    store.watch('P1', 's2', 'doc_b');
    store.changed('s1');
    store.changed('s1');
    store.changed('s2');
    expect(sheetChanged).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SHEET_CHANGE_SETTLE_MS);
    expect(sheetChanged).toHaveBeenCalledTimes(1);
    expect(sheetChanged).toHaveBeenCalledWith('P1', ['s1', 's2'], ['doc_a', 'doc_b']);
  });

  it('tells nothing for an unwatched or lapsed sheet', async () => {
    const { store, sheetChanged } = watches();
    store.changed('s1');
    store.watch('P1', 's2', 'doc_a');
    now += SHEET_WATCH_TTL_MS;
    store.changed('s2');
    await vi.advanceTimersByTimeAsync(SHEET_CHANGE_SETTLE_MS);
    expect(sheetChanged).not.toHaveBeenCalled();
    await store.flush();
    expect(sheetChanged).not.toHaveBeenCalled();
  });

  it('forgets the watchers the index answers gone', async () => {
    const { store } = watches(() => ['doc_gone']);
    store.watch('P1', 's1', 'doc_a');
    store.watch('P1', 's1', 'doc_gone');
    store.changed('s1');
    await vi.advanceTimersByTimeAsync(SHEET_CHANGE_SETTLE_MS);
    expect(rows()).toEqual([{ watcher: 'doc_a', sheet_id: 's1' }]);
  });

  it('logs a failed signal and keeps the watches', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { store } = watches(() => {
      throw new Error('index down');
    });
    store.watch('P1', 's1', 'doc_a');
    store.changed('s1');
    await vi.advanceTimersByTimeAsync(SHEET_CHANGE_SETTLE_MS);
    expect(warn).toHaveBeenCalledWith('[sheets] sheet-changed failed', expect.anything());
    expect(rows()).toHaveLength(1);
    warn.mockRestore();
  });

  it('tells nothing where the index is not configured', async () => {
    const store = new SheetWatches(
      sql(),
      () => null,
      () => now,
    );
    store.watch('P1', 's1', 'doc_a');
    store.changed('s1');
    await expect(store.flush()).resolves.toBeUndefined();
  });

  it('splits many watchers into calls of SHEET_WATCHERS_MAX', async () => {
    const { store, sheetChanged } = watches();
    for (let i = 0; i < 25; i++) store.watch('P1', 's1', `doc_${i}`);
    store.changed('s1');
    await vi.advanceTimersByTimeAsync(SHEET_CHANGE_SETTLE_MS);
    expect(sheetChanged.mock.calls.map((c) => c[2].length)).toEqual([20, 5]);
  });
});

describe('the room relay', () => {
  it('passes a relayed op to sheetChanged after broadcasting it', async () => {
    const seen: unknown[] = [];
    const room = {
      broadcastSystemOp: () => {},
      broadcastOrderedSystemOp: () => {},
      closeSessionsOfChangedLink: () => {},
      clearAgentsFor: async () => {},
      sheetChanged: (op: unknown) => seen.push(op),
    } as unknown as InternalRoom;
    const op = { kind: 'sheets', sheetId: 's1', tabId: 't1', rev: 2 };
    const res = await answerInternal(
      room,
      new Request('https://room/broadcast', {
        method: 'POST',
        body: JSON.stringify({ op, ordered: true }),
      }),
      new URL('https://room/broadcast'),
    );
    expect(res?.status).toBe(204);
    expect(seen).toEqual([op]);
  });
});

describe('the ops that change a watch', () => {
  it("marks a Sheet's own id, and the plan's cards for any card or card-type change", () => {
    expect(watchIdsOfOp({ kind: 'sheets', sheetId: 's1' })).toEqual(['s1']);
    expect(watchIdsOfOp({ kind: 'items', upserts: [], removed: ['c1'], rev: 2 })).toEqual(['cards']);
    expect(watchIdsOfOp({ kind: 'item-types', itemTypes: {} })).toEqual(['cards']);
    expect(watchIdsOfOp({ kind: 'sheets' })).toEqual([]);
    expect(watchIdsOfOp({ kind: 'tab-meta' })).toEqual([]);
    expect(watchIdsOfOp(null)).toEqual([]);
  });
});
