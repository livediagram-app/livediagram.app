// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { offlineBackend } from './offline-backend';
import { testRecord as rec, testTab as tab } from './offline-test-utils';

// The IndexedDB backend's read-modify-write (docs/specs/006-document/offline-mode.md "Where
// offline documents live"): the read and the write share one transaction, so a write from
// another browser tab (which shares the store but not this tab's write chain) cannot land
// between them and be overwritten.

describe('offline backend update', () => {
  it('keeps both of two overlapping read-modify-writes, as two tabs would issue them', async () => {
    const store = offlineBackend();
    await store.put(rec({ id: 'race', tabs: [] }));
    const append = (id: string) =>
      store.update('race', (r) => (r ? { ...r, tabs: [...r.tabs, tab(id)] } : undefined));
    await Promise.all([append('a'), append('b')]);
    expect((await store.get('race'))?.tabs.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('writes nothing when the change answers undefined or throws', async () => {
    const store = offlineBackend();
    await store.put(rec({ id: 'keep', name: 'Before' }));
    await store.update('keep', () => undefined);
    await expect(
      store.update('keep', (r) => {
        void r;
        throw new Error('refused');
      }),
    ).rejects.toThrow('refused');
    expect((await store.get('keep'))?.name).toBe('Before');
  });

  it('hands the change undefined for a missing record and stores nothing', async () => {
    const store = offlineBackend();
    let seen: unknown = 'unset';
    await store.update('nobody', (r) => {
      seen = r;
      return undefined;
    });
    expect(seen).toBeUndefined();
    expect(await store.get('nobody')).toBeUndefined();
  });
});
