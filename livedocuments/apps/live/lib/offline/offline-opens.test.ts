import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from './offline-store';
import { localOpensOf, nextLocalOpens, offlineListOpens, offlineRecordOpen } from './offline-opens';
import { memBackend, testRecord as rec } from './offline-test-utils';

// This browser's own opens of the documents stored only here
// (docs/specs/013-workspace/blueprints/explorer-home-view.md "Local opens"): the UTC days with an
// open, inside the 90-day use window, and the last open, kept on the document's record.

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 30, 10, 0, 0);

describe('nextLocalOpens', () => {
  it('counts a first open: its day and the open itself', () => {
    expect(nextLocalOpens(undefined, T0)).toEqual({ days: ['2026-09-30'], lastOpenedAt: T0 });
  });

  it('counts the day once, but moves the last open on every open', () => {
    const first = nextLocalOpens(undefined, T0);
    expect(nextLocalOpens(first, T0 + 3 * 60 * 60 * 1000)).toEqual({
      days: ['2026-09-30'],
      lastOpenedAt: T0 + 3 * 60 * 60 * 1000,
    });
  });

  it('adds the next UTC day first', () => {
    const first = nextLocalOpens(undefined, T0);
    expect(nextLocalOpens(first, T0 + DAY)).toEqual({
      days: ['2026-10-01', '2026-09-30'],
      lastOpenedAt: T0 + DAY,
    });
  });

  it('forgets days that fall out of the 90-day window', () => {
    const old = { days: ['2026-07-02', '2026-07-01'], lastOpenedAt: Date.UTC(2026, 6, 2) };
    // The 90 days up to 2026-09-30 start on 2026-07-03.
    expect(nextLocalOpens(old, T0).days).toEqual(['2026-09-30']);
    const kept = { days: ['2026-07-03'], lastOpenedAt: Date.UTC(2026, 6, 3) };
    expect(nextLocalOpens(kept, T0).days).toEqual(['2026-09-30', '2026-07-03']);
  });

  it('never moves the last open backwards', () => {
    const later = { days: ['2026-09-30'], lastOpenedAt: T0 + 1000 };
    expect(nextLocalOpens(later, T0).lastOpenedAt).toBe(T0 + 1000);
  });
});

describe('localOpensOf', () => {
  it('reads the current shape as it is', () => {
    const opens = { days: ['2026-09-30'], lastOpenedAt: T0 };
    expect(localOpensOf(opens)).toEqual(opens);
  });

  it('reads the earlier frecency shape as its last open day', () => {
    expect(
      localOpensOf({ openDays: 4, lastOpenDay: '2026-09-29', lastOpenedAt: T0, frecencyKey: 9 }),
    ).toEqual({ days: ['2026-09-29'], lastOpenedAt: T0 });
  });

  it('reads anything else as never opened', () => {
    expect(localOpensOf(undefined)).toBeUndefined();
    expect(localOpensOf({ days: 'x' })).toBeUndefined();
    expect(localOpensOf({ lastOpenDay: '2026-09-29' })).toBeUndefined();
  });
});

describe('offlineRecordOpen', () => {
  beforeEach(() => {
    __setOfflineBackend(memBackend());
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    __setOfflineBackend(null);
    vi.restoreAllMocks();
  });

  it('writes the opens onto the record and leaves savedAt alone', async () => {
    await offlinePutRecord(rec({ id: 'd1', savedAt: 5 }));
    await offlineRecordOpen('d1', T0);
    const stored = await offlineGetRecord('d1');
    expect(stored?.opens).toEqual(nextLocalOpens(undefined, T0));
    expect(stored?.savedAt).toBe(5);
    expect(console.info).toHaveBeenCalledWith('[home] local-open-recorded days=1');
  });

  it('moves the last open on a second open the same day', async () => {
    await offlinePutRecord(rec({ id: 'd1' }));
    await offlineRecordOpen('d1', T0);
    await offlineRecordOpen('d1', T0 + 1000);
    expect((await offlineGetRecord('d1'))?.opens).toEqual({
      days: ['2026-09-30'],
      lastOpenedAt: T0 + 1000,
    });
  });

  it('rewrites a record of the earlier shape in the current one', async () => {
    await offlinePutRecord(
      rec({
        id: 'd1',
        opens: { openDays: 2, lastOpenDay: '2026-09-29', lastOpenedAt: T0 - DAY, frecencyKey: 1 },
      }),
    );
    await offlineRecordOpen('d1', T0);
    expect((await offlineGetRecord('d1'))?.opens).toEqual({
      days: ['2026-09-30', '2026-09-29'],
      lastOpenedAt: T0,
    });
  });

  it('never counts a trashed or missing record', async () => {
    await offlinePutRecord(rec({ id: 'd1', trashedAt: 1 }));
    await offlineRecordOpen('d1', T0);
    await offlineRecordOpen('gone', T0);
    expect((await offlineGetRecord('d1'))?.opens).toBeUndefined();
    expect(await offlineGetRecord('gone')).toBeNull();
  });

  it('logs and resolves when the store fails', async () => {
    __setOfflineBackend({
      get: async () => {
        throw new Error('quota');
      },
      put: async () => {},
      delete: async () => {},
      all: async () => [],
      update: async () => {
        throw new Error('quota');
      },
    });
    await expect(offlineRecordOpen('d1', T0)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[home] local-open-failed', expect.any(Error));
  });
});

describe('offlineListOpens', () => {
  afterEach(() => __setOfflineBackend(null));

  it('lists live opened records with their summaries, in the current shape', async () => {
    __setOfflineBackend(memBackend());
    const opens = nextLocalOpens(undefined, T0);
    await offlinePutRecord(rec({ id: 'opened', name: 'Opened', opens }));
    await offlinePutRecord(rec({ id: 'never' }));
    await offlinePutRecord(rec({ id: 'binned', opens, trashedAt: 2 }));
    await offlinePutRecord(
      rec({
        id: 'earlier',
        opens: { openDays: 1, lastOpenDay: '2026-09-29', lastOpenedAt: T0, frecencyKey: 1 },
      }),
    );
    const listed = await offlineListOpens();
    expect(listed.map((l) => l.document.id).sort()).toEqual(['earlier', 'opened']);
    expect(listed.find((l) => l.document.id === 'opened')!.opens).toEqual(opens);
    expect(listed.find((l) => l.document.id === 'earlier')!.opens).toEqual({
      days: ['2026-09-29'],
      lastOpenedAt: T0,
    });
    expect(listed[0]!.document).toMatchObject({ ownerId: 'offline' });
  });
});
