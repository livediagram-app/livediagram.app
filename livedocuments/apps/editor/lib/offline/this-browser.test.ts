// @vitest-environment jsdom
// This Browser's list (this-browser.ts): every write to the offline store keeps it, and the id cache's one read
// per page load rebuilds it, so the Explorer on this address lists what is kept only here.
import { afterEach, describe, expect, it } from 'vitest';
import { readThisBrowser } from '@liveworkspace/explorer/this-browser';
import { __setOfflineBackend, offlineCreateDocument, offlineDeleteDocument, offlineUpdateRecord, isOfflineId } from './offline-store';
import { memBackend, testRecord } from './offline-test-utils';

afterEach(() => {
  __setOfflineBackend(null);
  localStorage.clear();
});

describe("This Browser's list", () => {
  it('follows a create, a star and a delete', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDocument({ id: 'a', name: 'Alpha' }, 1_000);
    expect(readThisBrowser('livedocuments')).toEqual([
      expect.objectContaining({ id: 'a', title: 'Alpha', lastOpenedAt: 1_000, trashedAt: null }),
    ]);
    await offlineUpdateRecord('a', (rec) => (rec ? { ...rec, favourite: true } : undefined));
    expect(readThisBrowser('livedocuments')[0]!.favourite).toBe(true);
    await offlineDeleteDocument('a');
    expect(readThisBrowser('livedocuments')).toEqual([]);
  });

  it('is rebuilt from the store on the first id check, trashed records included', async () => {
    const backend = memBackend();
    await backend.put(testRecord({ id: 'old', name: 'Old', savedAt: 5 }));
    await backend.put(testRecord({ id: 'binned', name: 'Binned', savedAt: 6, trashedAt: 7 }));
    __setOfflineBackend(backend);
    expect(await isOfflineId('old')).toBe(true);
    expect(readThisBrowser('livedocuments').map((i) => [i.id, i.trashedAt])).toEqual([
      ['binned', 7],
      ['old', null],
    ]);
  });
});
