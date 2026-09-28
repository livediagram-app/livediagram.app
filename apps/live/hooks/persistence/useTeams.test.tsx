// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useTeams } from './useTeams';

const apiListTeams = vi.fn();
const apiListTeamInvites = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiListTeams: (o: string) => apiListTeams(o),
  apiListTeamInvites: (o: string) => apiListTeamInvites(o),
}));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => vi.clearAllMocks());

// Teams + invites (docs/specs/013-workspace/teams.md).
describe('useTeams', () => {
  it('loads teams and invites for a signed-in owner', async () => {
    apiListTeams.mockResolvedValue([{ id: 't1' }]);
    apiListTeamInvites.mockResolvedValue([{ memberId: 'm1' }]);
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
});
