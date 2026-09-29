// @vitest-environment jsdom

// The open editor follows a change made in Google Drive
// (docs/specs/022-drive-mirror/drive-mirror.md, "Other views follow").

import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/core';
import { notifyApiWrite, resetApiWriteListeners } from '@/lib/api/write-signal';
import { AFTER_WRITE_DELAY_MS } from '@/hooks/persistence/useAfterApiWrite';
import { useDriveFollow } from './useDriveFollow';

beforeEach(() => {
  resetApiWriteListeners();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(loadMeta: () => Promise<{ name: string } | null>) {
  const calls = { list: vi.fn(), name: vi.fn(), trashed: vi.fn() };
  renderHook(() =>
    useDriveFollow({
      ownerId: 'user_me',
      documentId: 'd1',
      enabled: true,
      refreshDocumentList: calls.list,
      setDocumentName: calls.name,
      setDocumentTrashed: calls.trashed,
      loadMeta,
    }),
  );
  return calls;
}

const settle = async () => {
  vi.advanceTimersByTime(AFTER_WRITE_DELAY_MS);
  await vi.runAllTicks();
  await Promise.resolve();
  await Promise.resolve();
};

describe('useDriveFollow', () => {
  it('re-reads the list and takes the new name after a rename in Drive', async () => {
    const calls = setup(async () => ({ name: 'Renamed in Drive' }));
    notifyApiWrite({ drive: true });
    await settle();
    expect(calls.list).toHaveBeenCalledWith('user_me');
    expect(calls.name).toHaveBeenCalledWith('Renamed in Drive');
    expect(calls.trashed).not.toHaveBeenCalled();
  });

  it('shows the deleted card when the document went to the Trash from Drive', async () => {
    const calls = setup(async () => {
      throw new ApiError('load', 410, 'document_trashed');
    });
    notifyApiWrite({ drive: true });
    await settle();
    expect(calls.trashed).toHaveBeenCalledWith(true);
  });

  it('ignores ordinary writes', async () => {
    const calls = setup(async () => ({ name: 'x' }));
    notifyApiWrite();
    await settle();
    vi.advanceTimersByTime(10_000);
    expect(calls.list).not.toHaveBeenCalled();
  });
});
