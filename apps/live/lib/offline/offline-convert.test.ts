import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DIAGRAM_CONVERSION_HEADER } from '@livediagram/api-schema';

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

  it('aborts when a tab fails to load, leaving the server copy intact', async () => {
    // This used to assert the opposite — that the conversion carried on and
    // deleted the server diagram — under the name "keeps going … rather than
    // losing the rest". Carrying on is what loses: the offline record is
    // written from the tabs that survived, the server copy is deleted, and the
    // failed tab's elements exist nowhere. Nothing is recoverable and the user
    // is told it worked.
    vi.mocked(apiClient.apiLoadTab).mockRejectedValueOnce(new Error('flaky'));
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow(/tab load incomplete/i);
    expect(store.offlinePutRecord).not.toHaveBeenCalled();
    expect(core.apiDelete).not.toHaveBeenCalled();
  });

  it('aborts on a tab that 404s without throwing', async () => {
    // The second null path, and the easier one to hit: `expectOkOrNull` maps a
    // 404 to null rather than an error, so a tab that momentarily isn't there
    // never reaches the `.catch` at all.
    vi.mocked(apiClient.apiLoadTab).mockResolvedValueOnce(null as never);
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow(/tab load incomplete/i);
    expect(core.apiDelete).not.toHaveBeenCalled();
  });
});

describe('conversions declare themselves to the worker', () => {
  // Both conversions reuse ordinary endpoints, so the worker cannot tell them
  // from a real delete / a real create unless the request says so — and
  // undeclared it recorded exactly that, telling the owner in danger red that a
  // diagram they had just moved into this browser was deleted (spec/76 +
  // spec/138 §4.2).
  it('marks the take-offline DELETE as an offline conversion', async () => {
    await takeCloudOffline('d1', 'owner');
    const [, , opts] = vi.mocked(core.apiDelete).mock.calls[0]!;
    expect((opts as { extra?: Record<string, string> }).extra).toEqual({
      [DIAGRAM_CONVERSION_HEADER]: 'offline',
    });
  });

  it('marks the sync POST as a sync conversion', async () => {
    await saveOfflineToCloud('off-1', 'owner');
    const call = vi.mocked(apiClient.apiCreateDiagram).mock.calls[0]!;
    expect(call[2]).toEqual({ conversion: 'sync' });
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
