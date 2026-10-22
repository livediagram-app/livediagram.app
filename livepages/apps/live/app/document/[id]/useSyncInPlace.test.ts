// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

// docs/specs/006-document/offline-mode.md "Syncing in place": Sync Document waits for the pending save,
// uploads, re-points the open tabs' images at their gallery copies, opens the room and refreshes the
// Explorer, all without a reload; a save that will not land refuses the sync.

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

const DATA = 'data:image/png;base64,AAAA';
const tab = (imageId: string): Tab =>
  ({ id: 't1', name: 'Tab', elements: [{ id: 'e1', type: 'image', imageId }] }) as unknown as Tab;

function setup(over: { ownerId?: string; unsaved?: () => boolean } = {}) {
  let tabs: Tab[] = [tab(DATA)];
  const resetTabs = vi.fn((next: Tab[] | ((prev: Tab[]) => Tab[])) => {
    tabs = typeof next === 'function' ? next(tabs) : next;
  });
  const lastSavedTabsRef = { current: [tab(DATA)] };
  const deps = {
    documentId: 'doc-1',
    ownerId: over.ownerId ?? 'guest-1',
    hasUnsavedChanges: over.unsaved ?? (() => false),
    resetTabs,
    lastSavedTabsRef,
    setDocumentServerStored: vi.fn(),
    refreshDocumentList: vi.fn(),
  };
  const { result } = renderHook(() => useSyncInPlace(deps));
  return { sync: result.current, deps, tabs: () => tabs };
}
const imageOf = (t: Tab) => (t.elements[0] as unknown as { imageId: string }).imageId;

beforeEach(() => {
  convert.saveOfflineToCloud.mockResolvedValue({
    id: 'doc-1',
    imageIds: new Map([[DATA, 'img-9']]),
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useSyncInPlace', () => {
  it('turns the open document into a cloud document with no reload', async () => {
    const { sync, deps, tabs } = setup();
    await sync();
    expect(convert.saveOfflineToCloud).toHaveBeenCalledExactlyOnceWith('doc-1', 'guest-1');
    expect(imageOf(tabs()[0]!)).toBe('img-9');
    expect(imageOf(deps.lastSavedTabsRef.current[0]!)).toBe('img-9');
    expect(deps.setDocumentServerStored).toHaveBeenCalledWith(true);
    expect(deps.refreshDocumentList).toHaveBeenCalledWith('guest-1');
    expect(track).toHaveBeenCalledWith('Document', 'Moved', 'SavedToCloud');
  });

  it('leaves the tabs alone when no image moved', async () => {
    convert.saveOfflineToCloud.mockResolvedValue({ id: 'doc-1', imageIds: new Map() });
    const { sync, deps } = setup();
    await sync();
    expect(deps.resetTabs).not.toHaveBeenCalled();
    expect(deps.setDocumentServerStored).toHaveBeenCalledWith(true);
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
