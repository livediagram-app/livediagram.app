// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTeamLibrary } from './useTeamLibrary';

const apiGetTeamLibrary = vi.fn<typeof import('@/lib/api-client').apiGetTeamLibrary>();
const apiCreateFolder = vi.fn<typeof import('@/lib/api-client').apiCreateFolder>();
const apiUpdateFolder = vi.fn<typeof import('@/lib/api-client').apiUpdateFolder>();
const apiDeleteFolder = vi.fn<typeof import('@/lib/api-client').apiDeleteFolder>();
const apiSetDocumentFolder = vi.fn<typeof import('@/lib/api-client').apiSetDocumentFolder>();
const apiSaveDocumentMeta = vi.fn<typeof import('@/lib/api-client').apiSaveDocumentMeta>();
vi.mock('@/lib/api-client', () => ({
  apiGetTeamLibrary: (o: string, t: string) => apiGetTeamLibrary(o, t),
  apiCreateFolder: (...a: Parameters<typeof apiCreateFolder>) => apiCreateFolder(...a),
  apiUpdateFolder: (...a: Parameters<typeof apiUpdateFolder>) => apiUpdateFolder(...a),
  apiDeleteFolder: (...a: Parameters<typeof apiDeleteFolder>) => apiDeleteFolder(...a),
  apiSetDocumentFolder: (...a: Parameters<typeof apiSetDocumentFolder>) => apiSetDocumentFolder(...a),
  apiSaveDocumentMeta: (...a: Parameters<typeof apiSaveDocumentMeta>) => apiSaveDocumentMeta(...a),
}));
const duplicateDocument = vi.fn<typeof import('@/lib/duplicate-document').duplicateDocument>();
vi.mock('@/lib/duplicate-document', () => ({
  duplicateDocument: (...a: Parameters<typeof duplicateDocument>) => duplicateDocument(...a),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('@/hooks/ui/useToast', () => ({ useToast: () => toast }));

afterEach(() => vi.clearAllMocks());

// A team's library, as far as the hook reads it.
const lib = (teamId: string) =>
  ({
    folders: [{ id: `${teamId}-f`, name: 'F', parentId: null }],
    documents: [{ id: `${teamId}-d`, name: 'D', folderId: null }],
  }) as unknown as Awaited<ReturnType<typeof apiGetTeamLibrary>>;

// One team's shared library (docs/specs/013-workspace/team-shared-documents.md).
describe('useTeamLibrary', () => {
  it('loads the team library', async () => {
    apiGetTeamLibrary.mockResolvedValue(lib('t1'));
    const { result } = renderHook(() => useTeamLibrary('u1', 't1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rootFolders.map((f) => f.id)).toEqual(['t1-f']);
  });

  it('empties and reloads for another team, never showing the previous one', async () => {
    apiGetTeamLibrary.mockImplementation(async (_o, t) => lib(t));
    const { result, rerender } = renderHook(({ team }) => useTeamLibrary('u1', team), {
      initialProps: { team: 't1' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ team: 't2' });
    expect(result.current.loading).toBe(true);
    expect(result.current.rootFolders).toEqual([]);
    await waitFor(() => expect(result.current.rootFolders.map((f) => f.id)).toEqual(['t2-f']));
  });

  it('keeps the library through a failed refresh', async () => {
    apiGetTeamLibrary.mockResolvedValueOnce(lib('t1')).mockRejectedValueOnce(new Error('503'));
    const { result } = renderHook(() => useTeamLibrary('u1', 't1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.refresh();
    expect(result.current.rootFolders.map((f) => f.id)).toEqual(['t1-f']);
  });

  // A folder made or changed on a team page reaches the Explorer's own lists (the sidebar, search and every other
  // move picker), which used to show it only after a reload.
  it('tells its caller after each change, once it has refetched', async () => {
    apiGetTeamLibrary.mockResolvedValue(lib('t1'));
    apiCreateFolder.mockResolvedValue({ id: 'new', name: 'Planning', parentId: null } as Awaited<
      ReturnType<typeof apiCreateFolder>
    >);
    apiUpdateFolder.mockResolvedValue({ id: 'new', name: 'Plans', parentId: null } as Awaited<
      ReturnType<typeof apiUpdateFolder>
    >);
    const onChange = vi.fn();
    const { result } = renderHook(() => useTeamLibrary('u1', 't1', { onChange }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onChange).not.toHaveBeenCalled();
    await result.current.createFolder(null, 'Planning');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(apiGetTeamLibrary.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      onChange.mock.invocationCallOrder[0]!,
    );
    await result.current.renameFolder('new', 'Plans');
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

// docs/specs/013-workspace/folders.md "A write that fails says so": every write a team page makes either lands or
// ends in an error toast, and the refetch after it shows the library as the server holds it.
describe('useTeamLibrary when the server refuses', () => {
  it('says so for every folder and document write', async () => {
    apiGetTeamLibrary.mockResolvedValue(lib('t1'));
    const refused = () => Promise.reject(new Error('403'));
    apiCreateFolder.mockImplementation(refused);
    apiUpdateFolder.mockImplementation(refused);
    apiDeleteFolder.mockImplementation(refused);
    apiSetDocumentFolder.mockImplementation(refused);
    apiSaveDocumentMeta.mockImplementation(refused);
    duplicateDocument.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTeamLibrary('u1', 't1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(await result.current.createFolder(null, 'Planning')).toBeUndefined();
    await result.current.renameFolder('t1-f', 'Plans');
    await result.current.moveFolder('t1-f', null);
    await result.current.deleteFolder('t1-f');
    await result.current.moveDocument('t1-d', 't1-f');
    await result.current.renameDocument('t1-d', 'Doc');
    await result.current.duplicateDocument('t1-d');
    expect(toast.error.mock.calls).toEqual([
      ['Could not create “Planning”. Try again.'],
      ['Could not rename “F”. Try again.'],
      ['Could not move “F”. Try again.'],
      ['Could not delete “F”. Try again.'],
      ['Could not move “D”. Try again.'],
      ['Could not rename “D”. Try again.'],
      ['Could not duplicate “D”. Try again.'],
    ]);
  });

  it('says nothing when the writes land', async () => {
    apiGetTeamLibrary.mockResolvedValue(lib('t1'));
    apiUpdateFolder.mockResolvedValue({ id: 't1-f', name: 'Plans', parentId: null } as Awaited<
      ReturnType<typeof apiUpdateFolder>
    >);
    apiDeleteFolder.mockResolvedValue(undefined);
    apiSetDocumentFolder.mockResolvedValue(undefined);
    apiSaveDocumentMeta.mockResolvedValue(undefined);
    duplicateDocument.mockResolvedValue('copy');
    const { result } = renderHook(() => useTeamLibrary('u1', 't1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await result.current.renameFolder('t1-f', 'Plans');
    await result.current.moveFolder('t1-f', null);
    await result.current.deleteFolder('t1-f');
    await result.current.moveDocument('t1-d', null);
    await result.current.renameDocument('t1-d', 'Doc');
    await result.current.duplicateDocument('t1-d');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
