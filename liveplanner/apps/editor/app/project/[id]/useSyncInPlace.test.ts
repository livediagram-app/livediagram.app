// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/006-project/offline-mode.md "Syncing in place": Sync Project waits for the pending save,
// uploads, opens the room and refreshes the Explorer, all without a reload; a save that will not land refuses the sync.

const { convert, track, projects } = vi.hoisted(() => ({
  convert: { saveOfflineToCloud: vi.fn() },
  track: vi.fn(),
  projects: { apiLoadProject: vi.fn() },
}));
vi.mock('@/lib/api/projects', () => ({ apiLoadProject: projects.apiLoadProject }));
vi.mock('@/lib/offline/offline-convert', async (orig) => ({
  ...(await orig<typeof import('@/lib/offline/offline-convert')>()),
  saveOfflineToCloud: convert.saveOfflineToCloud,
}));
vi.mock('@/lib/telemetry', () => ({ track }));

import { SyncStillSavingError } from '@/lib/offline/offline-convert';
import { SYNC_SAVE_WAIT_MS, useSyncInPlace } from './useSyncInPlace';

function setup(over: { ownerId?: string; unsaved?: () => boolean } = {}) {
  const deps = {
    projectId: 'doc-1',
    ownerId: over.ownerId ?? 'guest-1',
    hasUnsavedChanges: over.unsaved ?? (() => false),
    setProjectServerStored: vi.fn(),
    refreshProjectList: vi.fn(),
    adoptItemTypes: vi.fn(),
  };
  const { result } = renderHook(() => useSyncInPlace(deps));
  return { sync: result.current, deps };
}

beforeEach(() => {
  convert.saveOfflineToCloud.mockResolvedValue({ id: 'doc-1' });
  projects.apiLoadProject.mockResolvedValue({ itemTypes: null, itemTypesRev: 1 });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useSyncInPlace', () => {
  it('turns the open project into a cloud project with no reload', async () => {
    const { sync, deps } = setup();
    await sync();
    expect(convert.saveOfflineToCloud).toHaveBeenCalledExactlyOnceWith('doc-1', 'guest-1');
    expect(deps.setProjectServerStored).toHaveBeenCalledWith(true);
    expect(deps.refreshProjectList).toHaveBeenCalledWith('guest-1');
    expect(track).toHaveBeenCalledWith('Project', 'Moved', 'SavedToCloud');
  });

  // Work Tracker 873: the server's catalogue and revision re-seed the card types, so the first save lands at once.
  it('re-seeds the card types from the server after the sync', async () => {
    const catalogue = { version: 1, types: [] };
    projects.apiLoadProject.mockResolvedValue({ itemTypes: catalogue, itemTypesRev: 2 });
    const { sync, deps } = setup();
    await sync();
    expect(projects.apiLoadProject).toHaveBeenCalledWith('guest-1', 'doc-1');
    expect(deps.adoptItemTypes).toHaveBeenCalledExactlyOnceWith({
      itemTypes: catalogue,
      itemTypesRev: 2,
      adopt: true,
    });
  });

  it('keeps the sync when the server read fails or finds nothing (the stale retry still lands the save)', async () => {
    projects.apiLoadProject.mockRejectedValueOnce(new Error('offline'));
    const first = setup();
    await first.sync();
    expect(first.deps.setProjectServerStored).toHaveBeenCalledWith(true);
    expect(first.deps.adoptItemTypes).not.toHaveBeenCalled();
    projects.apiLoadProject.mockResolvedValueOnce({});
    const second = setup();
    await second.sync();
    expect(second.deps.adoptItemTypes).toHaveBeenCalledWith({
      itemTypes: null,
      itemTypesRev: 0,
      adopt: true,
    });
    projects.apiLoadProject.mockResolvedValueOnce(null);
    const third = setup();
    await third.sync();
    expect(third.deps.adoptItemTypes).not.toHaveBeenCalled();
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
    expect(deps.setProjectServerStored).not.toHaveBeenCalled();
  });

  it('never syncs as the placeholder reader', async () => {
    const { sync } = setup({ ownerId: 'self' });
    await sync();
    expect(convert.saveOfflineToCloud).not.toHaveBeenCalled();
  });
});
