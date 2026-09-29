// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TeamListItem } from '@/lib/api-client';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';
import { useAssigneeOptions } from './useAssigneeOptions';

const apiGetTeam = vi.fn();
const apiCheckAssigneeAccess = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiGetTeam: (...a: unknown[]) => apiGetTeam(...a),
  apiCheckAssigneeAccess: (...a: unknown[]) => apiCheckAssigneeAccess(...a),
}));

afterEach(() => vi.clearAllMocks());

type Args = Parameters<typeof useAssigneeOptions>[0];
const TEAMS = [{ id: 't1', name: 'Team' }] as TeamListItem[];
const mate: PickableMember = {
  userId: 'u2',
  memberId: 'm2',
  pending: false,
  name: 'Mate',
  email: 'mate@x.io',
  teamId: 't1',
  teamName: 'Team',
};
const base: Args = {
  open: true,
  existing: null,
  teams: TEAMS,
  ownerId: 'u1',
  selfUserId: 'u1',
  selfName: 'Me',
  documentId: 'd1',
  documentTeamId: 't1',
  assignee: null,
  setAssignee: vi.fn(),
};
const teamDetail = {
  members: [
    { id: 'm1', userId: 'u1', status: 'joined', name: 'Me', email: 'me@x.io' },
    { id: 'm2', userId: 'u2', status: 'joined', name: 'Mate', email: 'mate@x.io' },
  ],
};

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4).
describe('useAssigneeOptions members', () => {
  it('loads the diagram team, without the assigner', async () => {
    apiGetTeam.mockResolvedValue(teamDetail);
    const { result } = renderHook((a: Args) => useAssigneeOptions(a), { initialProps: base });
    expect(result.current.members).toBeNull();
    await waitFor(() => expect(result.current.members).toEqual([mate]));
    expect(result.current.grouped).toEqual([['t1', { teamName: 'Team', members: [mate] }]]);
  });

  it('is empty for a guest', () => {
    const { result } = renderHook((a: Args) => useAssigneeOptions(a), {
      initialProps: { ...base, ownerId: null },
    });
    expect(result.current.members).toEqual([]);
    expect(apiGetTeam).not.toHaveBeenCalled();
  });

  it('reloads on every open', async () => {
    apiGetTeam.mockResolvedValue(teamDetail);
    const { result, rerender } = renderHook((a: Args) => useAssigneeOptions(a), {
      initialProps: base,
    });
    await waitFor(() => expect(result.current.members).toEqual([mate]));
    rerender({ ...base, open: false });
    rerender({ ...base, open: true });
    expect(result.current.members).toBeNull();
    await waitFor(() => expect(result.current.members).toEqual([mate]));
    expect(apiGetTeam).toHaveBeenCalledTimes(2);
  });
});

describe('useAssigneeOptions access', () => {
  const access = (assignee: PickableMember, extra: Partial<Args> = {}) => {
    apiGetTeam.mockResolvedValue(teamDetail);
    return renderHook((a: Args) => useAssigneeOptions(a), {
      initialProps: { ...base, ...extra, assignee },
    });
  };

  it('is yes for Myself, without asking', () => {
    const { result } = access({ ...mate, userId: 'u1' });
    expect(result.current.assigneeAccess).toBe('yes');
    expect(apiCheckAssigneeAccess).not.toHaveBeenCalled();
  });

  it('is invited for a pending member', () => {
    expect(access({ ...mate, pending: true }).result.current.assigneeAccess).toBe('invited');
  });

  it('is error when it cannot be asked', () => {
    expect(access(mate, { documentId: null }).result.current.assigneeAccess).toBe('error');
  });

  it('asks the server, unknown until it answers, and again for another pick', async () => {
    apiCheckAssigneeAccess.mockResolvedValueOnce(false).mockResolvedValueOnce(null);
    const { result, rerender } = access(mate);
    expect(result.current.assigneeAccess).toBe('unknown');
    await waitFor(() => expect(result.current.assigneeAccess).toBe('no'));
    expect(apiCheckAssigneeAccess).toHaveBeenCalledWith('u1', 't1', {
      assigneeUserId: 'u2',
      documentId: 'd1',
    });
    rerender({ ...base, assignee: { ...mate, userId: 'u3' } });
    expect(result.current.assigneeAccess).toBe('unknown');
    await waitFor(() => expect(result.current.assigneeAccess).toBe('error'));
  });
});
