// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTeams } from './useTeams';

type Api = typeof import('@/lib/api-client');
const apiListTeams = vi.fn<Api['apiListTeams']>();
const apiListTeamInvites = vi.fn<Api['apiListTeamInvites']>();
const apiCreateTeam = vi.fn<Api['apiCreateTeam']>();
vi.mock('@/lib/api-client', () => ({
  apiListTeams: (o: string) => apiListTeams(o),
  apiListTeamInvites: (o: string) => apiListTeamInvites(o),
  apiCreateTeam: (o: string, input: Parameters<Api['apiCreateTeam']>[1]) => apiCreateTeam(o, input),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => vi.clearAllMocks());

// Teams + invites (docs/specs/013-workspace/teams.md).
describe('useTeams', () => {
  it('loads teams and invites for a signed-in owner', async () => {
    // A team and an invite, as far as the hook reads them.
    apiListTeams.mockResolvedValue([{ id: 't1' }] as Awaited<ReturnType<Api['apiListTeams']>>);
    apiListTeamInvites.mockResolvedValue([{ memberId: 'm1' }] as Awaited<
      ReturnType<Api['apiListTeamInvites']>
    >);
    const { result } = renderHook(() => useTeams('u1', { enabled: true }));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.teams).toEqual([{ id: 't1' }]);
    expect(result.current.invites).toEqual([{ memberId: 'm1' }]);
  });

  it('never loads for a guest', () => {
    const { result } = renderHook(() => useTeams('u1', { enabled: false }));
    expect(result.current.loading).toBe(false);
    expect(apiListTeams).not.toHaveBeenCalled();
  });

  it('is not loading before the owner resolves, then loads', async () => {
    apiListTeams.mockResolvedValue([]);
    apiListTeamInvites.mockResolvedValue([]);
    const { result, rerender } = renderHook(({ owner }) => useTeams(owner, { enabled: true }), {
      initialProps: { owner: null as string | null },
    });
    expect(result.current.loading).toBe(false);
    rerender({ owner: 'u2' });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(apiListTeams).toHaveBeenCalledWith('u2');
  });

  // The Move dialog's New Team tile (docs/specs/013-workspace/teams.md "Making a team").
  it('makes a team and lists it at once, as its admin', async () => {
    apiListTeams.mockResolvedValue([{ id: 't2', name: 'Zeta' }] as Awaited<
      ReturnType<Api['apiListTeams']>
    >);
    apiListTeamInvites.mockResolvedValue([]);
    apiCreateTeam.mockResolvedValue({
      id: 't1',
      name: 'Alpha',
      organisation: null,
      createdAt: 1,
      updatedAt: 1,
    });
    const { result } = renderHook(() => useTeams('u1', { enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const made = await result.current.createTeam({ name: '  Alpha ', organisation: ' ' });
    expect(apiCreateTeam).toHaveBeenCalledWith('u1', { name: 'Alpha', organisation: null });
    expect(made).toMatchObject({ id: 't1', myRole: 'admin', memberCount: 1 });
    await waitFor(() => expect(result.current.teams.map((t) => t.id)).toEqual(['t1', 't2']));
  });

  it('makes nothing from a blank name, and answers undefined when the server refuses', async () => {
    apiListTeams.mockResolvedValue([]);
    apiListTeamInvites.mockResolvedValue([]);
    const { result } = renderHook(() => useTeams('u1', { enabled: true }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(await result.current.createTeam({ name: '   ' })).toBeUndefined();
    expect(apiCreateTeam).not.toHaveBeenCalled();
    apiCreateTeam.mockRejectedValue(new Error('409'));
    expect(await result.current.createTeam({ name: 'A' })).toBeUndefined();
  });
});
