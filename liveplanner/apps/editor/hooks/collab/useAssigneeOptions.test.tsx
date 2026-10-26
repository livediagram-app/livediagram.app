// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';

const api = vi.hoisted(() => ({ apiTeamMembers: vi.fn() }));
vi.mock('@/lib/api-client', () => api);

import { useAssigneeOptions } from './useAssigneeOptions';

type Args = Parameters<typeof useAssigneeOptions>[0];
const base: Args = {
  open: true,
  existing: null,
  teams: [{ id: 't1', name: 'Team' }],
  ownerId: 'u1',
  selfUserId: 'u1',
  selfName: 'Me',
  projectId: 'd1',
  projectTeamId: 't1',
  assignee: null,
  setAssignee: vi.fn(),
};

const member = (id: string, userId: string | null, status: string) => ({
  id,
  teamId: 't1',
  userId,
  email: `${id}@x.test`,
  role: 'member',
  status,
  name: null,
  createdAt: 0,
  updatedAt: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.apiTeamMembers.mockResolvedValue([
    member('m1', 'u1', 'joined'),
    member('m2', 'u2', 'joined'),
    member('m3', null, 'invited'),
    member('m4', 'u4', 'declined'),
  ]);
});

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4).
describe('useAssigneeOptions', () => {
  it("offers Myself and the plan team's people, joined and invited, grouped by team", async () => {
    const { result } = renderHook(() => useAssigneeOptions(base));
    expect(result.current.selfRow).toMatchObject({ userId: 'u1', name: 'Me' });
    expect(result.current.memberOfProjectTeam).toBe(true);
    await waitFor(() => expect(result.current.members).toHaveLength(2));
    expect(result.current.members!.map((m) => [m.memberId, m.pending])).toEqual([
      ['m2', false],
      ['m3', true],
    ]);
    expect(result.current.grouped.map(([id, g]) => [id, g.members.length])).toEqual([['t1', 2]]);
  });

  it('is Myself alone on a personal plan, or for a guest', () => {
    const personal = renderHook(() => useAssigneeOptions({ ...base, projectTeamId: null }));
    expect(personal.result.current.members).toEqual([]);
    expect(personal.result.current.memberOfProjectTeam).toBe(false);
    const guest = renderHook(() => useAssigneeOptions({ ...base, ownerId: null }));
    expect(guest.result.current.members).toEqual([]);
    expect(api.apiTeamMembers).not.toHaveBeenCalled();
  });

  it('knows who can open the plan: Myself and a joined teammate yes, an invitation on accepting', () => {
    const pick = (p: Partial<PickableMember>): PickableMember => ({
      userId: 'u2',
      name: 'X',
      email: null,
      teamId: 't1',
      teamName: 'Team',
      ...p,
    });
    const access = (assignee: PickableMember) =>
      renderHook(() => useAssigneeOptions({ ...base, assignee })).result.current.assigneeAccess;
    expect(access(pick({ userId: 'u1', teamId: null }))).toBe('yes');
    expect(access(pick({}))).toBe('yes');
    expect(access(pick({ userId: null, memberId: 'm3', pending: true }))).toBe('invited');
    expect(access(pick({ teamId: 'other' }))).toBe('unknown');
  });

  it('preselects Myself when editing a self-assigned action, and a teammate once loaded', async () => {
    const setAssignee = vi.fn();
    const mine = { assignee: { userId: 'u1' } } as unknown as Args['existing'];
    renderHook(() => useAssigneeOptions({ ...base, existing: mine, setAssignee }));
    const first = setAssignee.mock.calls[0]![0] as (cur: PickableMember | null) => PickableMember;
    expect(first(null)).toMatchObject({ userId: 'u1' });

    const theirs = { assignee: { userId: null, memberId: 'm3' } } as unknown as Args['existing'];
    const set2 = vi.fn();
    renderHook(() => useAssigneeOptions({ ...base, existing: theirs, setAssignee: set2 }));
    await waitFor(() => expect(set2).toHaveBeenCalled());
    const chosen = set2.mock.calls.at(-1)![0] as (cur: PickableMember | null) => PickableMember;
    expect(chosen(null)).toMatchObject({ memberId: 'm3' });
  });
});
