import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IndexError, type Folder } from '@liveworkspace/index-client';
import { createFakeIndex } from '../test/fakeClient';
import { folderPath, useFolderStore } from './useFolders';

const folder = (
  id: string,
  parentId: string | null = null,
  teamId: string | null = null,
): Folder => ({
  id,
  name: id.toUpperCase(),
  parentId,
  teamId,
  ownerId: 'user_me',
  createdAt: 1,
  updatedAt: 1,
});

describe('useFolderStore', () => {
  it('loads every folder, page after page, once', async () => {
    const folders = Array.from({ length: 450 }, (_, i) => folder(`f${i}`));
    const index = createFakeIndex({ folders });
    const { result } = renderHook(() => useFolderStore(index.client, vi.fn(), vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.folders).toHaveLength(450);
    expect(index.count('listFolders')).toBe(3);
  });

  it('shows a new folder at once and takes it away when refused', async () => {
    const index = createFakeIndex();
    const onError = vi.fn();
    const { result } = renderHook(() => useFolderStore(index.client, onError, vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    index.fail.set('createFolder', new IndexError(409, 'folder_exists'));
    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.create({ name: 'Plans', parentId: null, teamId: null });
    });
    expect(result.current.childrenOf(null, null).map((f) => f.name)).toEqual(['Plans']);
    await act(() => done);
    expect(result.current.folders).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith('A folder with that name is already here.');
  });

  it('renames at once and puts the old name back on a refusal', async () => {
    const index = createFakeIndex({ folders: [folder('a')] });
    const { result } = renderHook(() => useFolderStore(index.client, vi.fn(), vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    index.fail.set('updateFolder', new IndexError(403, 'forbidden'));
    let done: Promise<unknown> = Promise.resolve();
    act(() => {
      done = result.current.rename('a', 'Renamed');
    });
    expect(result.current.byId.get('a')!.name).toBe('Renamed');
    await act(() => done);
    expect(result.current.byId.get('a')!.name).toBe('A');
  });

  it('reports a rename once the index took it, and not a refused one', async () => {
    const index = createFakeIndex({ folders: [folder('a')] });
    const onOrganise = vi.fn();
    const { result } = renderHook(() => useFolderStore(index.client, vi.fn(), vi.fn(), onOrganise));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.rename('a', 'Plans'));
    expect(onOrganise).toHaveBeenCalledWith('Folder·Renamed', null);
    onOrganise.mockClear();
    index.fail.set('updateFolder', new IndexError(403, 'forbidden'));
    await act(() => result.current.rename('a', 'Other'));
    expect(onOrganise).not.toHaveBeenCalled();
  });

  it('deletes a folder, lifting its children, and reloads the lists once done', async () => {
    const index = createFakeIndex({ folders: [folder('a'), folder('b', 'a')] });
    const changed = vi.fn();
    const { result } = renderHook(() => useFolderStore(index.client, vi.fn(), changed));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.remove('a'));
    expect(result.current.byId.get('b')!.parentId).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('puts a refused delete back, children and all', async () => {
    const index = createFakeIndex({ folders: [folder('a'), folder('b', 'a')] });
    const { result } = renderHook(() => useFolderStore(index.client, vi.fn(), vi.fn()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    index.fail.set('deleteFolder', new IndexError(403, 'forbidden'));
    await act(() => result.current.remove('a'));
    expect(result.current.byId.get('a')).toBeDefined();
    expect(result.current.byId.get('b')!.parentId).toBe('a');
  });

  it('walks a folder path for breadcrumbs, safe from a cycle', () => {
    const a = folder('a', 'c');
    const b = folder('b', 'a');
    const c = folder('c', 'b');
    const byId = new Map([a, b, c].map((f) => [f.id, f]));
    expect(folderPath(byId, 'b').map((f) => f.id)).toHaveLength(3);
  });
});
