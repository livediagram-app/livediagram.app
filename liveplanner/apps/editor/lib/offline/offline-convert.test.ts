import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_CONVERSION_HEADER } from '@liveplanner/api-schema';

// Offline Mode conversions (docs/specs/006-project/offline-mode.md). "Take offline" DELETES the server copy,
// so the ordering here is the difference between a failed conversion and a lost
// project. The module's header states the rules; nothing checked them.
//
// These mock the collaborators on purpose. The assertions are about SEQUENCE
// and ROLLBACK — did the destination get written before the source was removed,
// does a failure leave the surviving copy alone — which is what a mock can
// actually prove. Nothing here asserts what a mock returns.

const calls: string[] = [];

vi.mock('@/lib/api-client', () => ({
  apiCreateProject: vi.fn(async () => {
    calls.push('apiCreateProject');
  }),
  apiLoadProject: vi.fn(async () => ({ id: 'd1', name: 'Roadmap', tabs: [{ id: 't1' }] })),
  apiLoadTab: vi.fn(async () => ({ id: 't1', name: 'Tab 1', elements: [] })),
}));

// The person's star and tags on a plan are the index's (liveworkspace/docs/one-explorer-contracts.md).
vi.mock('@/lib/index-client', () => ({
  indexClient: {
    getItem: vi.fn(async () => ({ item: { id: 'd1', favourite: false, tagIds: [] as string[] } })),
    favourite: vi.fn(async () => {
      calls.push('favourite');
    }),
    tagItem: vi.fn(async () => {
      calls.push('tagItem');
    }),
  },
}));

vi.mock('@/lib/api/core', () => ({
  API_BASE: '/api',
  // Mirrors the real signature (action, status, code) so the type the tests
  // see and the value they construct agree.
  ApiError: class ApiError extends Error {
    action: string;
    status: number;
    code: string | null;
    constructor(action: string, status: number, code: string | null) {
      super(`${action} failed: ${status}`);
      this.name = 'ApiError';
      this.action = action;
      this.status = status;
      this.code = code;
    }
  },
  apiDelete: vi.fn(async () => {
    calls.push('apiDelete');
  }),
}));

vi.mock('../api/items', () => ({
  fetchItems: vi.fn(async () => ({ items: [], rev: 0, nextKey: 1 })),
  fetchCloudItems: vi.fn(async () => ({ items: [], rev: 0, nextKey: 1 })),
}));

vi.mock('../api/sheets', () => ({
  fetchAllSheets: vi.fn(async () => []),
  fetchCloudSheets: vi.fn(async () => []),
  sheetAsCreate: (s: unknown) => s,
}));
// The successive states the record is in when a sync goes to remove it (a write landing during
// the upload); once used up, it is the record the sync read.
const states: unknown[] = [];

vi.mock('./offline-store', () => ({
  offlineCreateProject: vi.fn(),
  offlineDeleteIfUnchanged: vi.fn(async (_id: string, unchanged: (r: unknown) => boolean) => {
    const rec: unknown = states.length
      ? states.shift()
      : await vi.mocked(store.offlineGetRecord).mock.results.at(-1)?.value;
    if (!unchanged(rec)) return { outcome: 'changed', rec };
    calls.push('offlineDeleteProject');
    return { outcome: 'deleted', rec };
  }),
  offlineDeleteProject: vi.fn(async () => {
    calls.push('offlineDeleteProject');
  }),
  offlineGetRecord: vi.fn(async () => ({ id: 'd1', name: 'Roadmap', tabs: [] })),
  offlinePutRecord: vi.fn(async () => {
    calls.push('offlinePutRecord');
  }),
}));

const apiClient = await import('@/lib/api-client');
const core = await import('@/lib/api/core');
const items = await import('../api/items');
const sheets = await import('../api/sheets');
const store = await import('./offline-store');
const { indexClient } = await import('@/lib/index-client');
const {
  ConversionInProgressError,
  conversionInProgress,
  saveOfflineToCloud,
  syncFailureMessage,
  takeCloudOffline,
} = await import('./offline-convert');

beforeEach(() => {
  calls.length = 0;
  states.length = 0;
  vi.clearAllMocks();
});

describe('saveOfflineToCloud (offline -> cloud)', () => {
  it('creates the cloud copy before removing the local one', () => {
    // A network failure part-way must leave the offline project intact, so the
    // destination has to exist before the source goes.
    return saveOfflineToCloud('d1', 'owner').then(() => {
      expect(calls).toEqual(['apiCreateProject', 'offlineDeleteProject']);
    });
  });

  it('keeps the local copy when the cloud write fails', async () => {
    vi.mocked(apiClient.apiCreateProject).mockRejectedValueOnce(new Error('offline'));
    await expect(saveOfflineToCloud('d1', 'owner')).rejects.toThrow();
    expect(store.offlineDeleteIfUnchanged).not.toHaveBeenCalled();
  });

  it('carries the star to the server once the local copy is gone', async () => {
    // Before the delete, the id still routes stars to the offline store.
    vi.mocked(store.offlineGetRecord).mockResolvedValueOnce({
      id: 'd1',
      name: 'Roadmap',
      tabs: [],
      favourite: true,
    } as never);
    await saveOfflineToCloud('d1', 'owner');
    expect(calls).toEqual(['apiCreateProject', 'offlineDeleteProject', 'favourite']);
    expect(indexClient.favourite).toHaveBeenCalledWith('d1');
  });

  it('puts the tags back on the server copy once the local copy is gone', async () => {
    vi.mocked(store.offlineGetRecord).mockResolvedValueOnce({
      id: 'd1',
      name: 'Roadmap',
      tabs: [],
      tagIds: ['a', 'b'],
    } as never);
    vi.mocked(indexClient.tagItem).mockRejectedValueOnce(new Error('tag gone'));
    await saveOfflineToCloud('d1', 'owner');
    // One refused (a tag deleted meanwhile) leaves the sync done all the same.
    expect(calls).toEqual(['apiCreateProject', 'offlineDeleteProject', 'tagItem']);
    expect(indexClient.tagItem).toHaveBeenCalledWith('a', 'd1');
    expect(indexClient.tagItem).toHaveBeenCalledWith('b', 'd1');
  });

  it('carries the folder and created date, not just the tabs', async () => {
    // The local record is deleted straight after, so whatever the create
    // leaves behind is lost.
    vi.mocked(store.offlineGetRecord).mockResolvedValueOnce({
      id: 'd1',
      name: 'Roadmap',
      tabs: [],
      folderId: 'f1',
      createdAt: 123,
    } as never);
    await saveOfflineToCloud('d1', 'owner');
    expect(vi.mocked(apiClient.apiCreateProject).mock.calls[0]![1]).toMatchObject({
      folderId: 'f1',
      createdAt: 123,
    });
  });

  it.each(['folder_not_found', 'folder_scope_mismatch'])(
    'files the project at the root, saying so, when the server refuses its folder: %s',
    async (code) => {
      // docs/specs/006-project/offline-mode.md: the server refuses by name; the sync decides.
      vi.mocked(store.offlineGetRecord).mockResolvedValueOnce({
        id: 'd1',
        name: 'Roadmap',
        tabs: [],
        folderId: 'deleted-since',
      } as never);
      vi.mocked(apiClient.apiCreateProject).mockRejectedValueOnce(
        new core.ApiError('create project', 404, code),
      );
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await saveOfflineToCloud('d1', 'owner');
      const creates = vi.mocked(apiClient.apiCreateProject).mock.calls;
      expect(creates).toHaveLength(2);
      expect(creates[1]![1]).toMatchObject({ folderId: null });
      expect(warn).toHaveBeenCalledWith(
        `[offline-sync] placement refused reason=${code}, filed at root`,
      );
      expect(calls).toEqual(['apiCreateProject', 'offlineDeleteProject']);
      warn.mockRestore();
    },
  );

  it('fails the sync on any other refusal, keeping the local copy', async () => {
    vi.mocked(store.offlineGetRecord).mockResolvedValueOnce({
      id: 'd1',
      name: 'Roadmap',
      tabs: [],
      folderId: 'f1',
    } as never);
    vi.mocked(apiClient.apiCreateProject).mockRejectedValueOnce(
      new core.ApiError('create project', 413, 'payload_too_large'),
    );
    await expect(saveOfflineToCloud('d1', 'owner')).rejects.toThrow();
    expect(apiClient.apiCreateProject).toHaveBeenCalledTimes(1);
    expect(store.offlineDeleteIfUnchanged).not.toHaveBeenCalled();
  });

  it('stars nothing for an unstarred project', async () => {
    await saveOfflineToCloud('d1', 'owner');
    expect(indexClient.favourite).not.toHaveBeenCalled();
  });

  it('uploads again when the project changed during the upload, removing the local copy only then', async () => {
    // docs/specs/006-project/offline-mode.md "Save to server": an edit made while the upload ran
    // would be deleted with the local copy, yet missing from the cloud one.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const edited = { id: 'd1', name: 'Roadmap', tabs: [], savedAt: 2 };
    states.push(edited, edited);
    await saveOfflineToCloud('d1', 'owner');
    const creates = vi.mocked(apiClient.apiCreateProject).mock.calls;
    expect(creates).toHaveLength(2);
    // The first cloud copy is taken back (declared a move, so it skips the Trash) before the second.
    expect(calls).toEqual([
      'apiCreateProject',
      'apiDelete',
      'apiCreateProject',
      'offlineDeleteProject',
    ]);
    const [, , opts] = vi.mocked(core.apiDelete).mock.calls[0]!;
    expect((opts as { extra?: Record<string, string> }).extra).toEqual({
      [PROJECT_CONVERSION_HEADER]: 'offline',
    });
    expect(warn).toHaveBeenCalledWith('[offline-sync] changed-during-upload attempt=1');
    warn.mockRestore();
  });

  it('gives up, keeping the local copy, when the project changes during every upload', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const at = (savedAt: number) => ({ id: 'd1', name: 'Roadmap', tabs: [], savedAt });
    states.push(at(2), at(3), at(4));
    await expect(saveOfflineToCloud('d1', 'owner')).rejects.toMatchObject({
      name: 'OfflineSyncIncompleteError',
      reason: 'kept_changing',
    });
    expect(apiClient.apiCreateProject).toHaveBeenCalledTimes(3);
    expect(calls).not.toContain('offlineDeleteProject');
    expect(calls.at(-1)).toBe('apiDelete');
  });

  it('keeps the local copy when the cloud copy is short of sheets', async () => {
    // A create that resolves to an existing row never re-seeds the stores, so a retried sync
    // could land without them; deleting the local copy then would lose them.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(store.offlineGetRecord).mockResolvedValueOnce({
      id: 'd1',
      name: 'Roadmap',
      tabs: [],
      sheets: [{ id: 's1', rev: 0, updatedAt: 1 }],
    } as never);
    await expect(saveOfflineToCloud('d1', 'owner')).rejects.toMatchObject({
      reason: 'stores_short',
    });
    expect(store.offlineDeleteIfUnchanged).not.toHaveBeenCalled();
    expect(calls).toEqual(['apiCreateProject', 'apiDelete']);
  });

  it('checks the cloud stores only for a record that has some', async () => {
    await saveOfflineToCloud('d1', 'owner');
    expect(items.fetchCloudItems).not.toHaveBeenCalled();
    expect(sheets.fetchCloudSheets).not.toHaveBeenCalled();
  });

  it('refuses a project that is not in the local store', async () => {
    vi.mocked(store.offlineGetRecord).mockResolvedValueOnce(undefined as never);
    await expect(saveOfflineToCloud('missing', 'owner')).rejects.toThrow(/not found/i);
    expect(apiClient.apiCreateProject).not.toHaveBeenCalled();
  });
});

describe('takeCloudOffline (cloud -> offline)', () => {
  it('keeps the personal folder on the offline record', async () => {
    vi.mocked(apiClient.apiLoadProject).mockResolvedValueOnce({
      id: 'd1',
      name: 'Roadmap',
      tabs: [{ id: 't1' }],
      folderId: 'f1',
      teamId: null,
    } as never);
    await takeCloudOffline('d1', 'owner');
    expect(vi.mocked(store.offlinePutRecord).mock.calls[0]![0]).toMatchObject({
      folderId: 'f1',
    });
  });

  it('keeps a starred project starred on the offline record', async () => {
    vi.mocked(indexClient.getItem).mockResolvedValueOnce({
      item: { id: 'd1', favourite: true, tagIds: [] },
    } as never);
    await takeCloudOffline('d1', 'owner');
    expect(vi.mocked(store.offlinePutRecord).mock.calls[0]![0]).toMatchObject({ favourite: true });
  });

  // docs/specs/013-workspace/tags.md "An offline project's tags live in the browser".
  it('carries the plan’s tags onto the offline record', async () => {
    vi.mocked(indexClient.getItem).mockResolvedValueOnce({
      item: { id: 'd1', favourite: false, tagIds: ['a', 'c'] },
    } as never);
    await takeCloudOffline('d1', 'owner');
    expect(vi.mocked(store.offlinePutRecord).mock.calls[0]![0]).toMatchObject({
      tagIds: ['a', 'c'],
    });
  });

  it('aborts before writing anything when the star and tags could not be read', async () => {
    // Taken as "none", they would go with the server row.
    vi.mocked(indexClient.getItem).mockRejectedValueOnce(new Error('offline'));
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow('offline');
    expect(calls).toEqual([]);
  });

  it('writes the local copy before deleting the server one', async () => {
    await takeCloudOffline('d1', 'owner');
    expect(calls).toEqual(['offlinePutRecord', 'apiDelete']);
  });

  it('rolls the local copy back when the server delete fails', async () => {
    // Both copies registered under one id would shadow the live cloud project
    // behind a stale offline fork. Data-safe: the server still holds it all.
    vi.mocked(core.apiDelete).mockRejectedValueOnce(new Error('500'));
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow();
    expect(store.offlineDeleteProject).toHaveBeenCalledWith('d1');
  });

  it('still surfaces the delete failure even if the rollback also fails', async () => {
    // The rollback is best-effort; the caller must not be told the conversion
    // succeeded because the cleanup threw on the way out.
    vi.mocked(core.apiDelete).mockRejectedValueOnce(new Error('500'));
    vi.mocked(store.offlineDeleteProject).mockRejectedValueOnce(new Error('idb gone'));
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow('500');
  });

  it('refuses a project the server does not have', async () => {
    vi.mocked(apiClient.apiLoadProject).mockResolvedValueOnce(null);
    await expect(takeCloudOffline('nope', 'owner')).rejects.toThrow(/not found/i);
    expect(store.offlinePutRecord).not.toHaveBeenCalled();
  });

  it('aborts when a tab fails to load, leaving the server copy intact', async () => {
    // This used to assert the opposite — that the conversion carried on and
    // deleted the server project — under the name "keeps going … rather than
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
    vi.mocked(apiClient.apiLoadTab).mockResolvedValueOnce(null);
    await expect(takeCloudOffline('d1', 'owner')).rejects.toThrow(/tab load incomplete/i);
    expect(core.apiDelete).not.toHaveBeenCalled();
  });
});

describe('conversions declare themselves to the worker', () => {
  // Both conversions reuse ordinary endpoints, so the worker cannot tell them
  // from a real delete / a real create unless the request says so — and
  // undeclared it recorded exactly that, telling the owner in danger red that a
  // project they had just moved into this browser was deleted (docs/specs/006-project/offline-mode.md +
  // docs/specs/013-workspace/timeline.md §4.2).
  it('marks the take-offline DELETE as an offline conversion', async () => {
    await takeCloudOffline('d1', 'owner');
    const [, , opts] = vi.mocked(core.apiDelete).mock.calls[0]!;
    expect((opts as { extra?: Record<string, string> }).extra).toEqual({
      [PROJECT_CONVERSION_HEADER]: 'offline',
    });
  });

  it('marks the sync POST as a sync conversion', async () => {
    await saveOfflineToCloud('off-1', 'owner');
    const call = vi.mocked(apiClient.apiCreateProject).mock.calls[0]!;
    expect(call[2]).toEqual({ conversion: 'sync' });
  });
});

describe('one conversion per project at a time', () => {
  // The menu that starts a conversion unmounts when it closes, so its own guard went with it and a
  // second menu could start an overlapping conversion of the same project.
  it('refuses a second conversion of a project while the first runs, then allows the next', async () => {
    let land: () => void = () => {};
    vi.mocked(apiClient.apiCreateProject).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          land = () => resolve(undefined as never);
        }),
    );
    const first = saveOfflineToCloud('d1', 'owner');
    expect(conversionInProgress('d1')).toBe(true);
    await expect(saveOfflineToCloud('d1', 'owner')).rejects.toBeInstanceOf(
      ConversionInProgressError,
    );
    await expect(takeCloudOffline('d1', 'owner')).rejects.toBeInstanceOf(ConversionInProgressError);
    land();
    await first;
    expect(conversionInProgress('d1')).toBe(false);
    expect(apiClient.apiCreateProject).toHaveBeenCalledTimes(1);
    await expect(saveOfflineToCloud('d1', 'owner')).resolves.toMatchObject({ id: 'd1' });
  });

  it('lets a failed conversion be tried again', async () => {
    vi.mocked(apiClient.apiCreateProject).mockRejectedValueOnce(new Error('offline'));
    await expect(saveOfflineToCloud('d1', 'owner')).rejects.toThrow('offline');
    expect(conversionInProgress('d1')).toBe(false);
  });
});

describe('syncFailureMessage', () => {
  it('names the size cap for a 413, so it does not read as a connection blip', () => {
    const e = new core.ApiError('sync', 413, null);
    expect(syncFailureMessage(e)).toMatch(/too large to sync/i);
    expect(syncFailureMessage(e)).not.toMatch(/connection/i);
  });

  it('says the local copy is safe when the sync stopped itself', async () => {
    const { OfflineSyncIncompleteError } = await import('./offline-sync');
    expect(syncFailureMessage(new OfflineSyncIncompleteError('kept_changing'))).toMatch(
      /kept changing/i,
    );
    expect(syncFailureMessage(new OfflineSyncIncompleteError('stores_short'))).toMatch(
      /yours was kept/i,
    );
  });

  it('falls back to the connection wording for anything else', () => {
    expect(syncFailureMessage(new core.ApiError('sync', 500, null))).toMatch(/connection/i);
    expect(syncFailureMessage(new Error('offline'))).toMatch(/connection/i);
    expect(syncFailureMessage(undefined)).toMatch(/connection/i);
  });
});
