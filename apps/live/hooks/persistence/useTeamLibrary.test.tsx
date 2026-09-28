// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTeamLibrary } from './useTeamLibrary';

const apiGetTeamLibrary = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGetTeamLibrary: (o: string, t: string) => apiGetTeamLibrary(o, t),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => vi.clearAllMocks());

const lib = (teamId: string) => ({
  folders: [{ id: `${teamId}-f`, name: 'F', parentId: null }],
  diagrams: [{ id: `${teamId}-d`, name: 'D', folderId: null }],
});

// One team's shared library (docs/specs/013-workspace/team-shared-diagrams.md).
describe('useTeamLibrary', () => {
  it('loads the team library', async () => {
    apiGetTeamLibrary.mockResolvedValue(lib('t1'));
    const { result } = renderHook(() => useTeamLibrary('u1', 't1'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rootFolders.map((f) => f.id)).toEqual(['t1-f']);
  });

  it('empties and reloads for another team, never showing the previous one', async () => {
    apiGetTeamLibrary.mockImplementation(async (_o: string, t: string) => lib(t));
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
});
