// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Folder } from '@livediagram/api-schema';
import { useFolders } from './useFolders';

const apiListFolders = vi.fn<(ownerId: string) => Promise<Folder[]>>();
const apiDeleteFolder = vi.fn<(ownerId: string, id: string) => Promise<void>>();
const apiCreateFolder = vi.fn<typeof import('@/lib/api-client').apiCreateFolder>();
const apiUpdateFolder = vi.fn<typeof import('@/lib/api-client').apiUpdateFolder>();
vi.mock('@/lib/api-client', () => ({
  apiListFolders: (ownerId: string) => apiListFolders(ownerId),
  apiDeleteFolder: (ownerId: string, id: string) => apiDeleteFolder(ownerId, id),
  apiCreateFolder: (...a: Parameters<typeof apiCreateFolder>) => apiCreateFolder(...a),
  apiUpdateFolder: (...a: Parameters<typeof apiUpdateFolder>) => apiUpdateFolder(...a),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

const folder = (id: string, parentId: string | null = null) =>
  ({ id, name: id, parentId }) as unknown as Folder;

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

describe('useFolders deleteFolder', () => {
  it('moves the deleted folder’s subfolders up to its parent, as the api does', async () => {
    apiListFolders.mockResolvedValue([
      folder('projects'),
      folder('workshops', 'projects'),
      folder('archive', 'workshops'),
    ]);
    apiDeleteFolder.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFolders('u5'));
    await waitFor(() => expect(result.current.folders).toHaveLength(3));
    act(() => {
      void result.current.deleteFolder('workshops');
    });
    expect(result.current.folders).toEqual([folder('projects'), folder('archive', 'projects')]);
    expect(apiDeleteFolder).toHaveBeenCalledWith('u5', 'workshops');
  });
});

// A delete the server refuses is rolled back: the folder returns where it was, and the subfolders
// that moved up for it return beneath it.
describe('useFolders deleteFolder when the api refuses', () => {
  it('puts the folder and its subfolders back, and resolves false', async () => {
    const tree = [
      folder('projects'),
      folder('workshops', 'projects'),
      folder('archive', 'workshops'),
    ];
    apiListFolders.mockResolvedValue(tree);
    apiDeleteFolder.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useFolders('u5'));
    await waitFor(() => expect(result.current.folders).toHaveLength(3));
    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteFolder('workshops');
    });
    expect(deleted).toBe(false);
    expect(result.current.folders).toEqual(tree);
  });

  it('resolves true when the api deletes it', async () => {
    apiListFolders.mockResolvedValue([folder('a')]);
    apiDeleteFolder.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFolders('u5'));
    await waitFor(() => expect(result.current.folders).toHaveLength(1));
    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteFolder('a');
    });
    expect(deleted).toBe(true);
    expect(result.current.folders).toEqual([]);
  });
});

// docs/specs/013-workspace/folders.md "A write that fails says so".
describe('useFolders when the api refuses a create or a rename', () => {
  it('makes no folder and says so', async () => {
    apiListFolders.mockResolvedValue([]);
    apiCreateFolder.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useFolders('u6'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let created: unknown = 'unset';
    await act(async () => {
      created = await result.current.createFolder({ parentId: null });
    });
    expect(created).toBeUndefined();
    expect(result.current.folders).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith('Could not create “New folder”. Try again.');
  });

  it('puts the old name back and says so', async () => {
    apiListFolders.mockResolvedValue([folder('plans')]);
    apiUpdateFolder.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => useFolders('u7'));
    await waitFor(() => expect(result.current.folders).toHaveLength(1));
    act(() => result.current.renameFolder('plans', 'Roadmaps'));
    expect(result.current.folders[0]!.name).toBe('Roadmaps');
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Could not rename “plans”. Try again.'),
    );
    expect(result.current.folders[0]!.name).toBe('plans');
  });

  it('says nothing when the rename lands', async () => {
    apiListFolders.mockResolvedValue([folder('plans')]);
    apiUpdateFolder.mockResolvedValue(folder('plans'));
    const { result } = renderHook(() => useFolders('u8'));
    await waitFor(() => expect(result.current.folders).toHaveLength(1));
    await act(async () => {
      result.current.renameFolder('plans', 'Roadmaps');
      await Promise.resolve();
    });
    expect(result.current.folders[0]!.name).toBe('Roadmaps');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
