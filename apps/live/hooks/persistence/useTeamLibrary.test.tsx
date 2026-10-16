// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTeamLibrary } from './useTeamLibrary';

const apiGetTeamLibrary = vi.fn<typeof import('@/lib/api-client').apiGetTeamLibrary>();
const apiCreateFolder = vi.fn<typeof import('@/lib/api-client').apiCreateFolder>();
const apiUpdateFolder = vi.fn<typeof import('@/lib/api-client').apiUpdateFolder>();
vi.mock('@/lib/api-client', () => ({
  apiGetTeamLibrary: (o: string, t: string) => apiGetTeamLibrary(o, t),
  apiCreateFolder: (...a: Parameters<typeof apiCreateFolder>) => apiCreateFolder(...a),
  apiUpdateFolder: (...a: Parameters<typeof apiUpdateFolder>) => apiUpdateFolder(...a),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

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
