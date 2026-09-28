// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@livediagram/api-schema';
import { useFolders } from './useFolders';

const apiListFolders = vi.fn<(ownerId: string) => Promise<Folder[]>>();
vi.mock('@/lib/api-client', () => ({
  apiListFolders: (ownerId: string) => apiListFolders(ownerId),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

const folder = (id: string) => ({ id, name: id, parentId: null }) as unknown as Folder;

afterEach(() => vi.clearAllMocks());

describe('useFolders', () => {
  it('auto-loads the owner, loading until the list lands', async () => {
    apiListFolders.mockResolvedValue([folder('f1')]);
    const { result } = renderHook(() => useFolders('u1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.folders).toEqual([folder('f1')]);
  });

  it('is not loading without an owner, and loads once one arrives', async () => {
    apiListFolders.mockResolvedValue([folder('f2')]);
    const { result, rerender } = renderHook(({ owner }) => useFolders(owner), {
      initialProps: { owner: null as string | null },
    });
    expect(result.current.loading).toBe(false);
    expect(apiListFolders).not.toHaveBeenCalled();
    rerender({ owner: 'u2' });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.folders).toEqual([folder('f2')]));
    expect(result.current.loading).toBe(false);
  });

  it('keeps the list through a failed load', async () => {
    apiListFolders.mockResolvedValueOnce([folder('f3')]).mockRejectedValueOnce(new Error('503'));
    const { result } = renderHook(() => useFolders('u3'));
    await waitFor(() => expect(result.current.folders).toEqual([folder('f3')]));
    await act(() => result.current.refresh());
    expect(result.current.folders).toEqual([folder('f3')]);
    expect(result.current.loading).toBe(false);
  });

  it('does not load unless asked to', () => {
    const { result } = renderHook(() => useFolders('u4', { autoLoad: false }));
    expect(result.current.loading).toBe(false);
    expect(apiListFolders).not.toHaveBeenCalled();
  });
});
