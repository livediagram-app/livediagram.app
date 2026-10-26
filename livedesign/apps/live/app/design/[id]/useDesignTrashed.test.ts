// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { markDesignDeleted, unmarkDesignDeleted } from '@/lib/design-tombstones';
import { useDesignTrashed } from './useDesignTrashed';

const index = vi.hoisted(() => ({ getItem: vi.fn(), restoreItem: vi.fn() }));
vi.mock('@liveworkspace/workbench/lib/index-client', () => ({ indexClient: index }));

// docs/specs/013-workspace/trash.md: the open design turns to its deleted page when the room says it was
// trashed, except when this page deleted it and is already leaving for the Explorer. Whether it can be restored
// here is the index's answer (liveworkspace/docs/specs/004-index/one-explorer-contracts.md).

afterEach(() => {
  unmarkDesignDeleted('d1');
  vi.clearAllMocks();
});

const item = (over: Record<string, unknown>) => ({
  item: {
    id: 'd1',
    trashedAt: 1_000,
    trashReason: 'deleted',
    access: 'edit',
    teamId: null,
    ...over,
  },
});

const render = (viaShareLink = false) =>
  renderHook(() => useDesignTrashed({ designId: 'd1', viaShareLink }));

describe('useDesignTrashed', () => {
  it('shows the deleted page when someone else trashes the design', () => {
    index.getItem.mockResolvedValue(item({}));
    const { result } = render();
    act(() => result.current.setDesignTrashed(true));
    expect(result.current.trashed).toBe(true);
  });

  it('ignores the echo of a delete made from this page', () => {
    markDesignDeleted('d1');
    const { result } = render();
    act(() => result.current.setDesignTrashed(true));
    expect(result.current.trashed).toBe(false);
  });

  it('offers Restore to someone who holds edit on the trashed item', async () => {
    index.getItem.mockResolvedValue(item({}));
    const { result } = render();
    act(() => result.current.setDesignTrashed(true));
    await waitFor(() =>
      expect(result.current.restorable).toEqual({ trashedAt: 1_000, reason: 'deleted' }),
    );
    expect(index.getItem).toHaveBeenCalledWith('d1');
  });

  it('offers nothing below edit, or to a link visitor', async () => {
    index.getItem.mockResolvedValue(item({ access: 'view' }));
    const { result } = render();
    act(() => result.current.setDesignTrashed(true));
    await waitFor(() => expect(index.getItem).toHaveBeenCalled());
    expect(result.current.restorable).toBeNull();

    index.getItem.mockClear();
    const visitor = render(true);
    act(() => visitor.result.current.setDesignTrashed(true));
    expect(index.getItem).not.toHaveBeenCalled();
  });
});
