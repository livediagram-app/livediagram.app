// Shared test helpers for the offline modules: an in-memory OfflineBackend
// (swapped in via __setOfflineBackend) and record/tab factories.
import type { Tab } from '@livediagram/document';
import type { OfflineBackend, OfflineDocumentRecord } from './offline-store';

export const testTab = (id: string, over: Partial<Tab> = {}): Tab => ({
  id,
  name: id,
  elements: [],
  ...over,
});

export const testRecord = (over: Partial<OfflineDocumentRecord> = {}): OfflineDocumentRecord => ({
  id: 'd1',
  name: 'Doc',
  folderId: null,
  createdAt: 100,
  savedAt: 100,
  tabs: [testTab('t1'), testTab('t2')],
  ...over,
});

export function memBackend(): OfflineBackend {
  const map = new Map<string, OfflineDocumentRecord>();
  return {
    get: async (id) => map.get(id),
    put: async (r) => void map.set(r.id, r),
    delete: async (id) => void map.delete(id),
    all: async () => [...map.values()],
    // One synchronous step, like the IndexedDB transaction it stands in for.
    update: async (id, change) => {
      const next = change(map.get(id));
      if (next === 'delete') map.delete(id);
      else if (next) map.set(next.id, next);
    },
  };
}
