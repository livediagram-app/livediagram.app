// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/006-document/offline-mode.md "Syncing in place": Sync Document waits for the pending save,
// uploads, opens the room and refreshes the Explorer, all without a reload; a save that will not land refuses the sync.

const { convert, track } = vi.hoisted(() => ({
  convert: { saveOfflineToCloud: vi.fn() },
  track: vi.fn(),
}));
vi.mock('@/lib/offline/offline-convert', async (orig) => ({
  ...(await orig<typeof import('@/lib/offline/offline-convert')>()),
  saveOfflineToCloud: convert.saveOfflineToCloud,
}));
vi.mock('@/lib/telemetry', () => ({ track }));

import { SyncStillSavingError } from '@/lib/offline/offline-convert';
import { SYNC_SAVE_WAIT_MS, useSyncInPlace } from './useSyncInPlace';

function setup(over: { ownerId?: string; unsaved?: () => boolean } = {}) {
  const deps = {
    documentId: 'doc-1',
    ownerId: over.ownerId ?? 'guest-1',
    hasUnsavedChanges: over.unsaved ?? (() => false),
    setDocumentServerStored: vi.fn(),
    refreshDocumentList: vi.fn(),
  };
  const { result } = renderHook(() => useSyncInPlace(deps));
  return { sync: result.current, deps };
}

beforeEach(() => {
  convert.saveOfflineToCloud.mockResolvedValue({ id: 'doc-1' });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useSyncInPlace', () => {
  it('turns the open document into a cloud document with no reload', async () => {
    const { sync, deps } = setup();
    await sync();
    expect(convert.saveOfflineToCloud).toHaveBeenCalledExactlyOnceWith('doc-1', 'guest-1');
    expect(deps.setDocumentServerStored).toHaveBeenCalledWith(true);
    expect(deps.refreshDocumentList).toHaveBeenCalledWith('guest-1');
    expect(track).toHaveBeenCalledWith('Document', 'Moved', 'SavedToCloud');
  });

  it('waits for the pending save before reading the record', async () => {
    let pending = 3;
    const { sync } = setup({ unsaved: () => pending-- > 0 });
    await sync();
    expect(pending).toBeLessThan(0);
    expect(convert.saveOfflineToCloud).toHaveBeenCalledOnce();
  });

  it('refuses rather than race a save that will not land', async () => {
    vi.useFakeTimers();
    const { sync, deps } = setup({ unsaved: () => true });
    const done = sync();
    const refused = expect(done).rejects.toBeInstanceOf(SyncStillSavingError);
    await vi.advanceTimersByTimeAsync(SYNC_SAVE_WAIT_MS + 200);
    await refused;
    expect(convert.saveOfflineToCloud).not.toHaveBeenCalled();
    expect(deps.setDocumentServerStored).not.toHaveBeenCalled();
  });

  it('never syncs as the placeholder reader', async () => {
    const { sync } = setup({ ownerId: 'self' });
    await sync();
    expect(convert.saveOfflineToCloud).not.toHaveBeenCalled();
  });
});
