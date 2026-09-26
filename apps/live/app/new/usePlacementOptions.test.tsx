// @vitest-environment jsdom

// The wizard's placement lists (docs/specs/006-diagram/save-locations.md, docs/specs/013-workspace/team-shared-diagrams.md), and what inline creation
// does to them: a new folder lands in the list it was made in, a new team
// joins the overview with an empty library, and either returning null on
// failure so the tile stays open for another go.

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const apiListFolders = vi.fn(async () => [
  { id: 'f1', name: 'Alpha', parentId: null, teamId: null },
]);
const apiListTeams = vi.fn(async () => [{ id: 't1', name: 'Zeta Team' }]);
const apiGetTeamLibrary = vi.fn(async () => ({ folders: [] }));
const apiCreateFolder = vi.fn(
  async (
    _owner: string,
    input: { id: string; name: string; parentId: string | null; teamId: string | null },
  ) => ({ ...input }),
);
const apiCreateTeam = vi.fn(async (_owner: string, input: { id: string; name: string }) => ({
  id: input.id,
  name: input.name,
}));

vi.mock('@/lib/api-client', () => ({
  apiListFolders: (...a: unknown[]) => apiListFolders(...(a as [])),
  apiListTeams: (...a: unknown[]) => apiListTeams(...(a as [])),
  apiGetTeamLibrary: (...a: unknown[]) => apiGetTeamLibrary(...(a as [])),
  apiCreateFolder: (...a: unknown[]) => apiCreateFolder(...(a as [string, never])),
  apiCreateTeam: (...a: unknown[]) => apiCreateTeam(...(a as [string, never])),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

import { usePlacementOptions } from './usePlacementOptions';

describe('usePlacementOptions', () => {
  it('loads folders for everyone and teams only once signed in', async () => {
    const guest = renderHook(() => usePlacementOptions({ selfId: 'g1', clerkUserId: null }));
    await waitFor(() => expect(guest.result.current.folders).toHaveLength(1));
    expect(apiListTeams).not.toHaveBeenCalled();

    const user = renderHook(() => usePlacementOptions({ selfId: 'u1', clerkUserId: 'clerk_1' }));
    await waitFor(() =>
      expect(user.result.current.teams).toEqual([{ id: 't1', name: 'Zeta Team' }]),
    );
    await waitFor(() => expect(user.result.current.teamFolders).toEqual({ t1: [] }));
  });

  it('adds a created team to the overview, sorted, with an empty library', async () => {
    const { result } = renderHook(() =>
      usePlacementOptions({ selfId: 'u1', clerkUserId: 'clerk_1' }),
    );
    await waitFor(() => expect(result.current.teams).toHaveLength(1));
    let created: { id: string; name: string } | null = null;
    await act(async () => {
      created = await result.current.createPickerTeam('Design');
    });
    expect(created).toMatchObject({ name: 'Design' });
    expect(result.current.teams.map((t) => t.name)).toEqual(['Design', 'Zeta Team']);
    expect(result.current.teamFolders[created!.id]).toEqual([]);
  });

  it('returns null when the api refuses, leaving the lists as they were', async () => {
    apiCreateTeam.mockRejectedValueOnce(new Error('401'));
    const { result } = renderHook(() =>
      usePlacementOptions({ selfId: 'u1', clerkUserId: 'clerk_1' }),
    );
    await waitFor(() => expect(result.current.teams).toHaveLength(1));
    let created: unknown = 'unset';
    await act(async () => {
      created = await result.current.createPickerTeam('Design');
    });
    expect(created).toBeNull();
    expect(result.current.teams).toHaveLength(1);
  });

  it('files a created folder into the list it was made in', async () => {
    const { result } = renderHook(() =>
      usePlacementOptions({ selfId: 'u1', clerkUserId: 'clerk_1' }),
    );
    await waitFor(() => expect(result.current.teamFolders).toEqual({ t1: [] }));
    await act(async () => {
      await result.current.createPickerFolder('Sub', 'f1', null);
      await result.current.createPickerFolder('Team root', null, 't1');
    });
    expect(result.current.folders.map((f) => f.name)).toEqual(['Alpha', 'Sub']);
    expect(result.current.teamFolders.t1!.map((f) => f.name)).toEqual(['Team root']);
  });
});
