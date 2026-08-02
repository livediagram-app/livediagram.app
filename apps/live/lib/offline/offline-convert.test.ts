import { beforeEach, describe, expect, it, vi } from 'vitest';

// Offline Mode conversions (spec/76). "Take offline" DELETES the server copy,
// so the ordering here is the difference between a failed conversion and a lost
// diagram. The module's header states the rules; nothing checked them.
//
// These mock the collaborators on purpose. The assertions are about SEQUENCE
// and ROLLBACK — did the destination get written before the source was removed,
// does a failure leave the surviving copy alone — which is what a mock can
// actually prove. Nothing here asserts what a mock returns.

const calls: string[] = [];

vi.mock('@/lib/api-client', () => ({
  apiCreateDiagram: vi.fn(async () => {
    calls.push('apiCreateDiagram');
  }),
  apiLoadDiagram: vi.fn(async () => ({ id: 'd1', name: 'Roadmap', tabs: [{ id: 't1' }] })),
  apiLoadTab: vi.fn(async () => ({ id: 't1', name: 'Tab 1', elements: [] })),
}));

vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  // Mirrors the real signature (action, status, code) so the type the tests
  // see and the value they construct agree.
  ApiError: class ApiError extends Error {
    constructor(
      public action: string,
      public status: number,
      public code: string | null,
    ) {
      super(`${action} failed: ${status}`);
      this.name = 'ApiError';
    }
  },
  apiDelete: vi.fn(async () => {
    calls.push('apiDelete');
  }),
}));

vi.mock('./offline-images', () => ({
  embedTabImages: vi.fn(async (tabs: unknown) => tabs),
  uploadEmbeddedImages: vi.fn(async (_owner: string, tabs: unknown) => tabs),
  isDataImageId: (id: string) => id.startsWith('data:'),
}));

vi.mock('./offline-store', () => ({
  offlineCreateDiagram: vi.fn(),
  offlineDeleteDiagram: vi.fn(async () => {
    calls.push('offlineDeleteDiagram');
  }),
  offlineGetRecord: vi.fn(async () => ({ id: 'd1', name: 'Roadmap', tabs: [] })),
  offlinePutRecord: vi.fn(async () => {
    calls.push('offlinePutRecord');
  }),
}));

const apiClient = await import('@/lib/api-client');
const core = await import('@/lib/api/core');
const images = await import('./offline-images');
const store = await import('./offline-store');
const { saveOfflineToCloud, syncFailureMessage, takeCloudOffline } =
  await import('./offline-convert');

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
});

describe('saveOfflineToCloud (offline -> cloud)', () => {
  it('creates the cloud copy before removing the local one', () => {
    // A network failure part-way must leave the offline diagram intact, so the
    // destination has to exist before the source goes.
    return saveOfflineToCloud('d1', 'owner').then(() => {
      expect(calls).toEqual(['apiCreateDiagram', 'offlineDeleteDiagram']);
    });
  });

  it('keeps the local copy when the cloud write fails', async () => {
    vi.mocked(apiClient.apiCreateDiagram).mockRejectedValueOnce(new Error('offline'));
    await expect(saveOfflineToCloud('d1', 'owner')).rejects.toThrow();
    expect(store.offlineDeleteDiagram).not.toHaveBeenCalled();
  });

  it('refuses a diagram that is not in the local store', async () => {
    vi.mocked(store.offlineGetRecord).mockResolvedValueOnce(undefined as never);
    await expect(saveOfflineToCloud('missing', 'owner')).rejects.toThrow(/not found/i);
    expect(apiClient.apiCreateDiagram).not.toHaveBeenCalled();
  });
});

describe('takeCloudOffline (cloud -> offline)', () => {
  it('writes the local copy before deleting the server one', async () => {
    await takeCloudOffline('d1', 'owner');
    expect(calls).toEqual(['offlinePutRecord', 'apiDelete']);
  });

  it('embeds images before the server delete, never after', async () => {
    // Once the diagram row is gone its images count as unused, and the api's
    // 30-day reaper deletes the bytes the offline copy still points at.
    await takeCloudOffline('d1', 'owner');
    const embedOrder = vi.mocked(images.embedTabImages).mock.invocationCallOrder[0]!;
    const deleteOrder = vi.mocked(core.apiDelete).mock.invocationCallOrder[0]!;
    expect(embedOrder).toBeLessThan(deleteOrder);
  });

  it('aborts before the delete if any image failed to embed', async () => {
    // Best-effort embedding is fine; signing the stragglers up for the reaper
    // is not. The server copy and its images must survive.
    vi.mocked(images.embedTabImages).mockResolvedValueOnce([
      { id: 't1', elements: [{ type: 'image', imageId: 'r2-abc' }] },
    ] as never);
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow(/embed incomplete/i);
    expect(core.apiDelete).not.toHaveBeenCalled();
    expect(store.offlinePutRecord).not.toHaveBeenCalled();
  });

  it('rolls the local copy back when the server delete fails', async () => {
    // Both copies registered under one id would shadow the live cloud diagram
    // behind a stale offline fork. Data-safe: the server still holds it all.
    vi.mocked(core.apiDelete).mockRejectedValueOnce(new Error('500'));
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow();
    expect(store.offlineDeleteDiagram).toHaveBeenCalledWith('d1');
  });

  it('still surfaces the delete failure even if the rollback also fails', async () => {
    // The rollback is best-effort; the caller must not be told the conversion
    // succeeded because the cleanup threw on the way out.
    vi.mocked(core.apiDelete).mockRejectedValueOnce(new Error('500'));
    vi.mocked(store.offlineDeleteDiagram).mockRejectedValueOnce(new Error('idb gone'));
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow('500');
  });

  it('refuses a diagram the server does not have', async () => {
    vi.mocked(apiClient.apiLoadDiagram).mockResolvedValueOnce(null as never);
    await expect(takeCloudOffline('nope', 'owner')).rejects.toThrow(/not found/i);
    expect(store.offlinePutRecord).not.toHaveBeenCalled();
  });

  it('keeps going when one tab fails to load rather than losing the rest', async () => {
    vi.mocked(apiClient.apiLoadTab).mockRejectedValueOnce(new Error('flaky'));
    await expect(takeCloudOffline('d1', 'owner')).resolves.toBeUndefined();
    expect(core.apiDelete).toHaveBeenCalled();
  });
});

describe('syncFailureMessage', () => {
  it('names the size cap for a 413, so it does not read as a connection blip', () => {
    const e = new core.ApiError('sync', 413, null);
    expect(syncFailureMessage(e)).toMatch(/too large to sync/i);
    expect(syncFailureMessage(e)).not.toMatch(/connection/i);
  });

  it('falls back to the connection wording for anything else', () => {
    expect(syncFailureMessage(new core.ApiError('sync', 500, null))).toMatch(/connection/i);
    expect(syncFailureMessage(new Error('offline'))).toMatch(/connection/i);
    expect(syncFailureMessage(undefined)).toMatch(/connection/i);
  });
});
