'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { TeamMember } from '@liveworkspace/api-schema/teams';
import type { ElementAction } from '@liveworkspace/element-model/element-action';
import { teamMemberRows } from './team-member-rows';
import type { PickableMember } from '../../components/dialogs/AssignActionAssigneePicker';

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4), one copy
// for every editor: the pinned Myself row, the item team's people (joined AND invited), the preselect-on-edit
// resolution, whether the pick can open the item, and the by-team grouping the picker renders. The dialog keeps the
// `assignee` selection itself; each editor hands in its own read of a team's people (`loadTeamMembers`).
//
// Only the team whose library holds this item is pickable, and its people can open the item by being in it: a
// joined teammate is a yes, an invited one gets in on accepting. Anyone else (an action kept from before the item
// moved) is unknown, and the email names no item they cannot open (the api decides).
export type AssigneeAccess = 'unknown' | 'yes' | 'no' | 'error' | 'invited';

// A member list, kept with the owner and team it was loaded for.
type LoadedMembers = { key: string; members: PickableMember[] };

const NO_MEMBERS: PickableMember[] = [];

function accessOf(
  assignee: PickableMember,
  selfUserId: string | null,
  itemTeamId: string | null,
): AssigneeAccess {
  // Self-assignment is a yes: the assigner is right here, editing it.
  if (assignee.userId !== null && assignee.userId === selfUserId) return 'yes';
  if (assignee.teamId === null || assignee.teamId !== itemTeamId) return 'unknown';
  return assignee.pending ? 'invited' : 'yes';
}

export function useAssigneeOptions({
  open,
  existing,
  teams,
  ownerId,
  selfUserId,
  selfName,
  selfColor = null,
  itemTeamId,
  assignee,
  setAssignee,
  loadTeamMembers,
}: {
  open: boolean;
  existing: Pick<ElementAction, 'assignee'> | null;
  teams: readonly { id: string; name: string }[];
  ownerId: string | null;
  selfUserId: string | null;
  selfName: string | null;
  // The caller's own participant colour, as their cursor wears it: the Myself row's disc.
  selfColor?: string | null;
  // The team whose library holds the item; null for a personal item.
  itemTeamId: string | null;
  assignee: PickableMember | null;
  setAssignee: Dispatch<SetStateAction<PickableMember | null>>;
  // The editor's read of a team's people (its api client's `apiTeamMembers`, one request shared with the mention
  // list's). A module-level function, so it never changes between renders.
  loadTeamMembers: (ownerId: string, teamId: string) => Promise<readonly TeamMember[]>;
}) {
  const [loaded, setLoaded] = useState<LoadedMembers | null>(null);

  // The pinned Myself row: every session has one once identity has hydrated (account or guest participant id).
  const selfRow = useMemo<PickableMember | null>(
    () =>
      selfUserId
        ? {
            userId: selfUserId,
            name: selfName?.trim() || 'Me',
            color: selfColor,
            email: null,
            teamId: null,
            teamName: null,
          }
        : null,
    [selfUserId, selfName, selfColor],
  );

  // The item's team, when the caller is in it; none for a personal item, a guest, or a share-link editor
  // outside the team.
  const team = useMemo(
    () => (ownerId ? (teams.find((t) => t.id === itemTeamId) ?? null) : null),
    [ownerId, teams, itemTeamId],
  );
  const memberOfItemTeam = team !== null;
  // A team is only ever found for a signed-in owner, so the key names both.
  const key = team ? `${ownerId}:${team.id}` : null;
  // Null while loading. A guest picker, or an item with no team, is Myself alone.
  const members = !key ? NO_MEMBERS : loaded?.key === key ? loaded.members : null;

  // Load the team's people when the dialog opens. A failure leaves them out.
  useEffect(() => {
    if (!open || !team || !ownerId) return;
    const key = `${ownerId}:${team.id}`;
    let cancelled = false;
    void loadTeamMembers(ownerId, team.id)
      .then((list) => teamMemberRows(list, team, ownerId))
      .catch(() => NO_MEMBERS)
      .then((rows) => {
        if (!cancelled) setLoaded({ key, members: rows });
      });
    return () => {
      cancelled = true;
    };
  }, [open, team, ownerId, loadTeamMembers]);

  // Preselect the existing assignee on edit: the Myself row when the action is self-assigned, else the matching
  // member row once loaded (by membership row first, which holds across an invitation being accepted).
  useEffect(() => {
    if (!open || !existing) return;
    if (selfRow && existing.assignee.userId === selfRow.userId) {
      setAssignee((cur) => cur ?? selfRow);
      return;
    }
    if (!members) return;
    setAssignee(
      (cur) =>
        cur ??
        (existing.assignee.memberId
          ? members.find((m) => m.memberId === existing.assignee.memberId)
          : undefined) ??
        (existing.assignee.userId
          ? members.find((m) => m.userId === existing.assignee.userId)
          : undefined) ??
        null,
    );
  }, [open, existing, members, selfRow, setAssignee]);

  const assigneeAccess: AssigneeAccess = assignee
    ? accessOf(assignee, selfUserId, itemTeamId)
    : 'unknown';

  // The picker's groups: the one pickable team, under its name, once it has people to list.
  const grouped = useMemo<[string, { teamName: string; members: PickableMember[] }][]>(
    () => (team && members?.length ? [[team.id, { teamName: team.name, members }]] : []),
    [team, members],
  );

  return { selfRow, members, grouped, memberOfItemTeam, assigneeAccess };
}
