'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { ElementAction } from '@livedocuments/document';
import { apiTeamMembers } from '@/lib/api-client';
import { teamMemberRows } from './team-member-rows';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4): the pinned
// Myself row, the plan team's people (joined AND invited), the preselect-on-edit resolution, whether the pick can
// open the plan, and the by-team grouping the picker renders. The dialog keeps the `assignee` selection itself.
//
// Only the team whose library holds this plan is pickable, and its people can open the plan by being in it: a
// joined teammate is a yes, an invited one gets in on accepting. Anyone else (an action kept from before the plan
// moved) is unknown, and the email names no plan they cannot open (the api decides).
type Access = 'unknown' | 'yes' | 'no' | 'error' | 'invited';

// A member list, kept with the owner and team it was loaded for.
type LoadedMembers = { key: string; members: PickableMember[] };

const NO_MEMBERS: PickableMember[] = [];

function accessOf(
  assignee: PickableMember,
  selfUserId: string | null,
  documentTeamId: string | null,
): Access {
  // Self-assignment is a yes: the assigner is right here, editing it.
  if (assignee.userId !== null && assignee.userId === selfUserId) return 'yes';
  if (assignee.teamId === null || assignee.teamId !== documentTeamId) return 'unknown';
  return assignee.pending ? 'invited' : 'yes';
}

export function useAssigneeOptions({
  open,
  existing,
  teams,
  ownerId,
  selfUserId,
  selfName,
  documentTeamId,
  assignee,
  setAssignee,
}: {
  open: boolean;
  existing: ElementAction | null;
  teams: readonly { id: string; name: string }[];
  ownerId: string | null;
  selfUserId: string | null;
  selfName: string | null;
  documentId: string | null;
  documentTeamId: string | null;
  assignee: PickableMember | null;
  setAssignee: Dispatch<SetStateAction<PickableMember | null>>;
}) {
  const [loaded, setLoaded] = useState<LoadedMembers | null>(null);

  // The pinned Myself row: every session has one once identity has hydrated (account or guest participant id).
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

  // The plan's team, when the caller is in it; none for a personal plan, a guest, or a share-link editor
  // outside the team.
  const team = useMemo(
    () => (ownerId ? (teams.find((t) => t.id === documentTeamId) ?? null) : null),
    [ownerId, teams, documentTeamId],
  );
  const memberOfDocumentTeam = team !== null;
  const key = team && ownerId ? `${ownerId}:${team.id}` : null;
  // Null while loading. A guest picker, or a plan with no team, is Myself alone.
  const members = !key ? NO_MEMBERS : loaded?.key === key ? loaded.members : null;

  // Load the team's people when the dialog opens (one request, shared with the mention list's). A failure
  // leaves them out.
  useEffect(() => {
    if (!open || !key || !team || !ownerId) return;
    let cancelled = false;
    void apiTeamMembers(ownerId, team.id)
      .then((list) => teamMemberRows(list, team, ownerId))
      .catch(() => NO_MEMBERS)
      .then((rows) => {
        if (!cancelled) setLoaded({ key, members: rows });
      });
    return () => {
      cancelled = true;
    };
  }, [open, key, team, ownerId]);

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

  const assigneeAccess: Access = assignee ? accessOf(assignee, selfUserId, documentTeamId) : 'unknown';

  const grouped = useMemo(() => {
    const byTeam = new Map<string, { teamName: string; members: PickableMember[] }>();
    for (const m of members ?? []) {
      if (m.teamId === null) continue;
      const bucket = byTeam.get(m.teamId) ?? { teamName: m.teamName ?? '', members: [] };
      bucket.members.push(m);
      byTeam.set(m.teamId, bucket);
    }
    return [...byTeam.entries()];
  }, [members]);

  return { selfRow, members, grouped, memberOfDocumentTeam, assigneeAccess };
}
