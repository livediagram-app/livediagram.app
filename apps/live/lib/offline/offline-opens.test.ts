import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextFrecencyKey } from '@livediagram/api-schema';
import { __setOfflineBackend, offlineGetRecord, offlinePutRecord } from './offline-store';
import { nextLocalOpens, offlineListOpens, offlineRecordOpen } from './offline-opens';
import { memBackend, testRecord as rec } from './offline-test-utils';

// This browser's own opens of the documents stored only here
// (docs/specs/013-workspace/blueprints/explorer-home-view.md "Local opens"): once per UTC day,
// keyed by the same frecency as a server open, kept on the document's record.

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.UTC(2026, 8, 30, 10, 0, 0);

describe('nextLocalOpens', () => {
  it('counts a first open at the open itself', () => {
    expect(nextLocalOpens(undefined, T0)).toEqual({
      openDays: 1,
      lastOpenDay: '2026-09-30',
      lastOpenedAt: T0,
      frecencyKey: T0,
    });
  });

  it('counts nothing more on the same UTC day', () => {
    const first = nextLocalOpens(undefined, T0)!;
    expect(nextLocalOpens(first, T0 + 13 * 60 * 60 * 1000)).toBeNull();
  });

  it('adds a day with the server frecency on the next UTC day', () => {
    const first = nextLocalOpens(undefined, T0)!;
    expect(nextLocalOpens(first, T0 + DAY)).toEqual({
      openDays: 2,
      lastOpenDay: '2026-10-01',
      lastOpenedAt: T0 + DAY,
      frecencyKey: nextFrecencyKey(T0, T0 + DAY),
    });
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

  it('skips a second open the same day', async () => {
    await offlinePutRecord(rec({ id: 'd1' }));
    await offlineRecordOpen('d1', T0);
    await offlineRecordOpen('d1', T0 + 1000);
    expect((await offlineGetRecord('d1'))?.opens?.openDays).toBe(1);
    expect(console.info).toHaveBeenCalledWith('[home] local-open-skipped reason=same-day');
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
    });
    await expect(offlineRecordOpen('d1', T0)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[home] local-open-failed', expect.any(Error));
  });
});

describe('offlineListOpens', () => {
  afterEach(() => __setOfflineBackend(null));

  it('lists live opened records with their summaries', async () => {
    __setOfflineBackend(memBackend());
    const opens = nextLocalOpens(undefined, T0)!;
    await offlinePutRecord(rec({ id: 'opened', name: 'Opened', opens }));
    await offlinePutRecord(rec({ id: 'never' }));
    await offlinePutRecord(rec({ id: 'binned', opens, trashedAt: 2 }));
    const listed = await offlineListOpens();
    expect(listed).toHaveLength(1);
    expect(listed[0]!.opens).toEqual(opens);
    expect(listed[0]!.document).toMatchObject({ id: 'opened', name: 'Opened', ownerId: 'offline' });
  });
});
