'use client';

import { useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import type { ElementAction } from '@liveplanner/project';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4): the pinned
// Myself row and the preselect-on-edit resolution. Teams are liveworkspace's now (an account's token names the
// teams it has joined, liveworkspace/docs/accounts.md "Teams"), and their member lists are not offered to apps yet,
// so the picker has no teammates to list: an action is assigned to yourself, and one already assigned to someone
// else keeps its assignee.
type Access = 'unknown' | 'yes' | 'no' | 'error' | 'invited';

const NO_MEMBERS: PickableMember[] = [];
const NO_GROUPS: [string, { teamName: string; members: PickableMember[] }][] = [];

export function useAssigneeOptions({
  open,
  existing,
  selfUserId,
  selfName,
  assignee,
  setAssignee,
}: {
  open: boolean;
  existing: ElementAction | null;
  teams: readonly { id: string; name: string }[];
  ownerId: string | null;
  selfUserId: string | null;
  selfName: string | null;
  projectId: string | null;
  projectTeamId: string | null;
  assignee: PickableMember | null;
  setAssignee: Dispatch<SetStateAction<PickableMember | null>>;
}) {
  // The pinned Myself row: every session has one once identity has
  // hydrated (account or guest participant id).
  const selfRow = useMemo<PickableMember | null>(
    () =>
      selfUserId
        ? {
            userId: selfUserId,
            name: selfName?.trim() || 'Me',
            email: null,
            teamId: null,
            teamName: null,
          }
        : null,
    [selfUserId, selfName],
  );

  // Preselect the Myself row when the action being edited is self-assigned.
  useEffect(() => {
    if (!open || !existing || !selfRow) return;
    if (existing.assignee.userId === selfRow.userId) setAssignee((cur) => cur ?? selfRow);
  }, [open, existing, selfRow, setAssignee]);

  // Self-assignment is a yes: the assigner is right here, editing it.
  const assigneeAccess = (
    assignee && selfRow && assignee.userId === selfRow.userId ? 'yes' : 'unknown'
  ) as Access;

  return {
    selfRow,
    members: NO_MEMBERS,
    grouped: NO_GROUPS,
    memberOfProjectTeam: false,
    assigneeAccess,
  };
}
