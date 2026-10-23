// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';
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

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4). Teams'
// member lists are liveworkspace's and not offered to apps yet, so the picker is Myself alone.
describe('useAssigneeOptions', () => {
  it('offers Myself and no teammates', () => {
    const { result } = renderHook(() => useAssigneeOptions(base));
    expect(result.current.selfRow).toMatchObject({ userId: 'u1', name: 'Me' });
    expect(result.current.members).toEqual([]);
    expect(result.current.grouped).toEqual([]);
  });

  it('is yes for Myself, without asking', () => {
    const self = { userId: 'u1', name: 'Me', email: null, teamId: null, teamName: null };
    const { result } = renderHook(() => useAssigneeOptions({ ...base, assignee: self }));
    expect(result.current.assigneeAccess).toBe('yes');
  });

  it('preselects Myself when editing a self-assigned action', () => {
    const setAssignee = vi.fn();
    const existing = { assignee: { userId: 'u1' } } as unknown as Args['existing'];
    renderHook(() => useAssigneeOptions({ ...base, existing, setAssignee }));
    const pick = setAssignee.mock.calls[0]![0] as (cur: PickableMember | null) => PickableMember;
    expect(pick(null)).toMatchObject({ userId: 'u1' });
  });
});
