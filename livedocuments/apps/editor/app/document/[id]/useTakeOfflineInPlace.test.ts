// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// docs/specs/006-document/offline-mode.md "Taking offline in place": the start screen's switch takes the open
// document offline with no reload: it waits for the pending save, closes the room before the server delete, and a
// failure opens it again.

const { convert, track, pick, dismiss } = vi.hoisted(() => ({
  convert: { takeCloudOffline: vi.fn() },
  track: vi.fn(),
  pick: { read: vi.fn(), hand: vi.fn() },
  dismiss: vi.fn(),
}));
vi.mock('@/lib/offline/offline-convert', async (orig) => ({
  ...(await orig<typeof import('@/lib/offline/offline-convert')>()),
  takeCloudOffline: convert.takeCloudOffline,
}));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineListDocuments: () => Promise.resolve([{ id: 'doc-1' }]),
}));
vi.mock('@liveworkspace/workbench/lib/offline/local-move-dismissal', () => ({
  dismissLocalMove: dismiss,
}));
vi.mock('@liveworkspace/explorer', async (orig) => ({
  ...(await orig<typeof import('@liveworkspace/explorer')>()),
  readTemplatePick: pick.read,
  handTemplatePick: pick.hand,
}));
vi.mock('@/lib/telemetry', () => ({ track }));

import { SyncStillSavingError } from '@/lib/offline/offline-convert';
import { SYNC_SAVE_WAIT_MS } from './useSyncInPlace';
import { useTakeOfflineInPlace } from './useTakeOfflineInPlace';

function setup(over: { ownerId?: string; unsaved?: () => boolean } = {}) {
  const order: string[] = [];
  const deps = {
    documentId: 'doc-1',
    ownerId: over.ownerId ?? 'user-1',
    hasUnsavedChanges: over.unsaved ?? (() => false),
    setDocumentServerStored: vi.fn((v: boolean) => order.push(`stored:${v}`)),
    refreshDocumentList: vi.fn(),
  };
  convert.takeCloudOffline.mockImplementation(async () => {
    order.push('convert');
  });
  const { result } = renderHook(() => useTakeOfflineInPlace(deps));
  return { take: result.current, deps, order };
}

beforeEach(() => {
  pick.read.mockReturnValue({ itemId: 'doc-1' });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('useTakeOfflineInPlace', () => {
  it('closes the room, takes the document offline and refreshes, with no reload', async () => {
    const { take, deps, order } = setup();
    await take();
    expect(convert.takeCloudOffline).toHaveBeenCalledExactlyOnceWith('doc-1', 'user-1', null);
    expect(order).toEqual(['stored:false', 'convert']);
    expect(pick.hand).toHaveBeenCalledWith(null);
    expect(dismiss).toHaveBeenCalledWith('user-1', 1);
    expect(deps.refreshDocumentList).toHaveBeenCalledWith('user-1');
    expect(track).toHaveBeenCalledWith('Document', 'Moved', 'TakenOffline');
  });

  it('leaves another document’s template note alone', async () => {
    pick.read.mockReturnValue({ itemId: 'doc-2' });
    const { take } = setup();
    await take();
    expect(pick.hand).not.toHaveBeenCalled();
  });

  it('opens the room again and rethrows when the conversion fails', async () => {
    const { take, deps, order } = setup();
    const boom = new Error('delete refused');
    convert.takeCloudOffline.mockImplementation(async () => {
      order.push('convert');
      throw boom;
    });
    await expect(take()).rejects.toBe(boom);
    expect(order).toEqual(['stored:false', 'convert', 'stored:true']);
    expect(deps.refreshDocumentList).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('does nothing as the placeholder an early open runs under', async () => {
    const { take } = setup({ ownerId: 'self' });
    await take();
    expect(convert.takeCloudOffline).not.toHaveBeenCalled();
  });

  it('refuses when the last save will not land', async () => {
    vi.useFakeTimers();
    const { take, deps } = setup({ unsaved: () => true });
    const run = take();
    const settled = expect(run).rejects.toBeInstanceOf(SyncStillSavingError);
    await vi.advanceTimersByTimeAsync(SYNC_SAVE_WAIT_MS + 500);
    await settled;
    expect(convert.takeCloudOffline).not.toHaveBeenCalled();
    expect(deps.setDocumentServerStored).not.toHaveBeenCalled();
  });
});
