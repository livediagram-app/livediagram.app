// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamMember } from '@liveworkspace/api-schema/teams';
import type { PickableMember } from '../../components/dialogs/AssignActionAssigneePicker';
import { useAssigneeOptions } from './useAssigneeOptions';

const loadTeamMembers = vi.fn<(ownerId: string, teamId: string) => Promise<TeamMember[]>>();

type Args = Parameters<typeof useAssigneeOptions>[0];
const base: Args = {
  open: true,
  existing: null,
  teams: [{ id: 't1', name: 'Team' }],
  ownerId: 'u1',
  selfUserId: 'u1',
  selfName: 'Me',
  itemTeamId: 't1',
  assignee: null,
  setAssignee: vi.fn(),
  loadTeamMembers,
};

const member = (id: string, userId: string | null, status: TeamMember['status']): TeamMember => ({
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
  loadTeamMembers.mockResolvedValue([
    member('m1', 'u1', 'joined'),
    member('m2', 'u2', 'joined'),
    member('m3', null, 'invited'),
    member('m4', 'u4', 'declined'),
  ]);
});

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4), one copy
// for every editor, each handing in its own read of a team's people.
describe('useAssigneeOptions', () => {
  it("offers Myself and the item team's people, joined and invited, grouped by team", async () => {
    const { result } = renderHook(() => useAssigneeOptions(base));
    expect(result.current.selfRow).toMatchObject({ userId: 'u1', name: 'Me', color: null });
    expect(result.current.memberOfItemTeam).toBe(true);
    expect(result.current.members).toBeNull();
    await waitFor(() => expect(result.current.members).toHaveLength(2));
    expect(loadTeamMembers).toHaveBeenCalledWith('u1', 't1');
    expect(result.current.members!.map((m) => [m.memberId, m.pending])).toEqual([
      ['m2', false],
      ['m3', true],
    ]);
    expect(result.current.grouped.map(([id, g]) => [id, g.teamName, g.members.length])).toEqual([
      ['t1', 'Team', 2],
    ]);
  });

  it('names Myself "Me" without a name, and wears the caller’s colour', () => {
    const { result } = renderHook(() =>
      useAssigneeOptions({ ...base, selfName: '  ', selfColor: '#8b5cf6' }),
    );
    expect(result.current.selfRow).toMatchObject({ name: 'Me', color: '#8b5cf6' });
    const unnamed = renderHook(() => useAssigneeOptions({ ...base, selfName: null }));
    expect(unnamed.result.current.selfRow?.name).toBe('Me');
    const before = renderHook(() => useAssigneeOptions({ ...base, selfUserId: null }));
    expect(before.result.current.selfRow).toBeNull();
  });

  it('is Myself alone on a personal item, or for a guest', () => {
    const personal = renderHook(() => useAssigneeOptions({ ...base, itemTeamId: null }));
    expect(personal.result.current.members).toEqual([]);
    expect(personal.result.current.memberOfItemTeam).toBe(false);
    const guest = renderHook(() => useAssigneeOptions({ ...base, ownerId: null }));
    expect(guest.result.current.members).toEqual([]);
    expect(loadTeamMembers).not.toHaveBeenCalled();
  });

  it('reads nobody while the dialog is closed, and leaves the people out when the read fails', async () => {
    renderHook(() => useAssigneeOptions({ ...base, open: false }));
    expect(loadTeamMembers).not.toHaveBeenCalled();
    loadTeamMembers.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useAssigneeOptions(base));
    await waitFor(() => expect(result.current.members).toEqual([]));
  });

  it('drops a read that lands after the dialog closed', async () => {
    let answer: (members: TeamMember[]) => void = () => {};
    loadTeamMembers.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const { result, rerender } = renderHook((args: Args) => useAssigneeOptions(args), {
      initialProps: base,
    });
    rerender({ ...base, open: false });
    answer([member('m2', 'u2', 'joined')]);
    await Promise.resolve();
    await Promise.resolve();
    expect(result.current.members).toBeNull();
  });

  it('knows who can open the item: Myself and a joined teammate yes, an invitation on accepting', () => {
    const pick = (p: Partial<PickableMember>): PickableMember => ({
      userId: 'u2',
      name: 'X',
      email: null,
      teamId: 't1',
      teamName: 'Team',
      ...p,
    });
    const access = (assignee: PickableMember | null) =>
      renderHook(() => useAssigneeOptions({ ...base, assignee })).result.current.assigneeAccess;
    expect(access(null)).toBe('unknown');
    expect(access(pick({ userId: 'u1', teamId: null }))).toBe('yes');
    expect(access(pick({}))).toBe('yes');
    expect(access(pick({ userId: null, memberId: 'm3', pending: true }))).toBe('invited');
    expect(access(pick({ teamId: 'other' }))).toBe('unknown');
    expect(access(pick({ teamId: null }))).toBe('unknown');
  });

  it('preselects Myself when editing a self-assigned action, and a teammate once loaded', async () => {
    const setAssignee = vi.fn();
    const mine = { assignee: { userId: 'u1', name: 'Me' } };
    renderHook(() => useAssigneeOptions({ ...base, existing: mine, setAssignee }));
    const first = setAssignee.mock.calls[0]![0] as (cur: PickableMember | null) => PickableMember;
    expect(first(null)).toMatchObject({ userId: 'u1' });
    const kept = { userId: 'u9', name: 'Kept', email: null, teamId: null, teamName: null };
    expect(first(kept)).toBe(kept);

    const theirs = { assignee: { userId: null, memberId: 'm3', name: 'Dee' } };
    const set2 = vi.fn();
    renderHook(() => useAssigneeOptions({ ...base, existing: theirs, setAssignee: set2 }));
    await waitFor(() => expect(set2).toHaveBeenCalled());
    const chosen = set2.mock.calls.at(-1)![0] as (cur: PickableMember | null) => PickableMember;
    expect(chosen(null)).toMatchObject({ memberId: 'm3' });
  });

  it('finds an older action’s teammate by account when it names no membership, and nobody when gone', async () => {
    const byUser = { assignee: { userId: 'u2', name: 'Bea' } };
    const set = vi.fn();
    renderHook(() => useAssigneeOptions({ ...base, existing: byUser, setAssignee: set }));
    await waitFor(() => expect(set).toHaveBeenCalled());
    const chosen = set.mock.calls.at(-1)![0] as (cur: PickableMember | null) => PickableMember;
    expect(chosen(null)).toMatchObject({ memberId: 'm2' });

    const gone = { assignee: { userId: null, name: 'Gone' } };
    const set2 = vi.fn();
    renderHook(() => useAssigneeOptions({ ...base, existing: gone, setAssignee: set2 }));
    await waitFor(() => expect(set2).toHaveBeenCalled());
    const none = set2.mock.calls.at(-1)![0] as (
      cur: PickableMember | null,
    ) => PickableMember | null;
    expect(none(null)).toBeNull();
  });

  it('draws no team group for a team with nobody else in it', async () => {
    loadTeamMembers.mockResolvedValueOnce([member('m1', 'u1', 'joined')]);
    const { result } = renderHook(() => useAssigneeOptions(base));
    await waitFor(() => expect(result.current.members).toEqual([]));
    expect(result.current.grouped).toEqual([]);
  });

  it('preselects a teammate before identity has hydrated a Myself row', async () => {
    const theirs = { assignee: { userId: 'u2', name: 'Bea' } };
    const set = vi.fn();
    renderHook(() =>
      useAssigneeOptions({ ...base, selfUserId: null, existing: theirs, setAssignee: set }),
    );
    await waitFor(() => expect(set).toHaveBeenCalled());
    const chosen = set.mock.calls.at(-1)![0] as (cur: PickableMember | null) => PickableMember;
    expect(chosen(null)).toMatchObject({ memberId: 'm2' });
  });
});
