// @vitest-environment jsdom
// Sync Canvas leaves Browser Storage (Work Tracker 1198, docs/specs/006-document/offline-mode.md "Syncing in place"):
// once the server has the canvas, its record and its row in This Browser's list are gone, so the Explorer lists it once,
// under its server home. And /new makes a first visit's canvas once: the guest token's round trip comes back to /new,
// so it is fetched before the create ("Instant open"), never after, which left a second canvas behind here.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readThisBrowser } from '@liveworkspace/explorer/this-browser';
import { __setOfflineBackend, offlineCreateDocument, offlineGetRecord } from './offline-store';
import { memBackend } from './offline-test-utils';
import { syncOfflineDocument } from './offline-sync';

const created: string[] = [];
vi.mock('@/lib/api-client', () => ({
  apiCreateDocument: vi.fn(async (_owner: string, doc: { id: string }) => {
    created.push(doc.id);
  }),
}));
vi.mock('./offline-images', () => ({
  uploadEmbeddedImages: vi.fn(async (_owner: string, tabs: unknown) => ({
    tabs,
    imageIds: new Map(),
  })),
}));

afterEach(() => {
  __setOfflineBackend(null);
  localStorage.clear();
  created.length = 0;
});

describe('Sync Canvas and Browser Storage', () => {
  it('drops the record and its row once the server has it, leaving the others', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDocument({ id: 'synced', name: 'Roadmap' }, 1_000);
    await offlineCreateDocument({ id: 'kept', name: 'Notes' }, 2_000);
    expect(readThisBrowser('livediagram').map((i) => i.id)).toEqual(['kept', 'synced']);
    await syncOfflineDocument('synced', 'owner');
    expect(created).toEqual(['synced']);
    expect(await offlineGetRecord('synced')).toBeNull();
    expect(readThisBrowser('livediagram').map((i) => i.id)).toEqual(['kept']);
  });

  it('keeps both while the server has not taken it', async () => {
    __setOfflineBackend(memBackend());
    await offlineCreateDocument({ id: 'synced', name: 'Roadmap' }, 1_000);
    const { apiCreateDocument } = await import('@/lib/api-client');
    vi.mocked(apiCreateDocument).mockRejectedValueOnce(new Error('offline'));
    await expect(syncOfflineDocument('synced', 'owner')).rejects.toThrow('offline');
    expect(await offlineGetRecord('synced')).not.toBeNull();
    expect(readThisBrowser('livediagram').map((i) => i.id)).toEqual(['synced']);
  });

  it("takes a first visit's guest token on /new before it creates the canvas", () => {
    const page = readFileSync(join(import.meta.dirname, '../../app/new/page.tsx'), 'utf8');
    const token = page.indexOf('await ensureGuestToken();');
    expect(token).toBeGreaterThan(-1);
    expect(token).toBeLessThan(page.indexOf('await offlineCreateDocument('));
  });
});
