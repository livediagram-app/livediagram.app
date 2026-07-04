'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { ElementAction } from '@livediagram/diagram';
import {
  apiCheckAssigneeAccess,
  apiGetTeam,
  type TeamListItem,
  type TeamMember,
} from '@/lib/api-client';
import { memberName } from '@/components/panels/team-pane-parts';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';

// The Assign Action dialog's assignee dataset (spec/68 §2 + §4), lifted
// out of AssignActionDialog: the pinned Myself row, the diagram team's
// member list (joined AND invited), the preselect-on-edit resolution,
// the per-pick server access check, and the by-team grouping the picker
// renders. The dialog keeps the `assignee` selection state itself (its
// open-seed effect writes it alongside the name / description fields)
// and passes it through.
export function useAssigneeOptions({
  open,
  existing,
  teams,
  ownerId,
  selfUserId,
  selfName,
  diagramId,
  diagramTeamId,
  assignee,
  setAssignee,
}: {
  open: boolean;
  existing: ElementAction | null;
  teams: TeamListItem[];
  ownerId: string | null;
  selfUserId: string | null;
  selfName: string | null;
  diagramId: string | null;
  diagramTeamId: string | null;
  assignee: PickableMember | null;
  setAssignee: Dispatch<SetStateAction<PickableMember | null>>;
}) {
  // Whether the picked teammate can actually open this diagram
  // (spec/68 §4): asked of the server per selection. 'unknown' while in
  // flight (show nothing); 'error' falls back to the picked-team
  // heuristic with hedged wording.
  const [assigneeAccess, setAssigneeAccess] = useState<
    'unknown' | 'yes' | 'no' | 'error' | 'invited'
  >('unknown');
  const [members, setMembers] = useState<PickableMember[] | null>(null);

  // The pinned Myself row: every session has one once identity has
  // hydrated (Clerk account or guest participant id).
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

  // Only the team whose shared library holds this diagram is pickable
  // (spec/68 §2): members of the user's other teams almost certainly
  // can't open the diagram to complete the action, so offering them
  // just manufactures the access warning. Empty for a personal diagram
  // and for a share-link editor who isn't a member of the team.
  const pickableTeams = useMemo(
    () => teams.filter((t) => t.id === diagramTeamId),
    [teams, diagramTeamId],
  );
  const memberOfDiagramTeam = pickableTeams.length > 0;

  // Load the diagram team's joined members once per open (signed-in
  // only; a guest picker is Myself alone). One GET per pickable team
  // (zero or one); a failure just leaves its members out.
  useEffect(() => {
    if (!open) return;
    if (!ownerId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setMembers(null);
    void Promise.all(
      pickableTeams.map(async (team) => {
        try {
          const detail = await apiGetTeam(ownerId, team.id);
          return detail.members
            .filter(
              // Everyone on the team — joined AND invited (spec/68: work
              // gets divided while invites are in flight) — except the
              // assigner themselves, whom the pinned Myself row covers.
              (m: TeamMember) => m.userId !== ownerId,
            )
            .map(
              (m: TeamMember): PickableMember => ({
                // Null for an invited member the lazy claim hasn't
                // identified yet; memberId is their key then.
                userId: m.userId,
                memberId: m.id,
                pending: m.status === 'invited',
                name: memberName(m, false, null),
                email: m.email,
                teamId: team.id,
                teamName: team.name,
              }),
            );
        } catch {
          return [];
        }
      }),
    ).then((lists) => {
      if (!cancelled) setMembers(lists.flat());
    });
    return () => {
      cancelled = true;
    };
  }, [open, ownerId, pickableTeams]);

  // Preselect the existing assignee on edit: the Myself row when the
  // action is self-assigned, else the matching member row once loaded
  // (prefer the row from the action's own team).
  useEffect(() => {
    if (!open || !existing) return;
    if (selfRow && existing.assignee.userId === selfRow.userId) {
      setAssignee((cur) => cur ?? selfRow);
      return;
    }
    if (!members) return;
    // Match by memberId first (stable across the invited -> joined
    // transition), then by userId.
    setAssignee(
      (cur) =>
        cur ??
        (existing.assignee.memberId
          ? members.find((m) => m.memberId === existing.assignee.memberId)
          : undefined) ??
        (existing.assignee.userId
          ? (members.find(
              (m) => m.userId === existing.assignee.userId && m.teamId === existing.teamId,
            ) ?? members.find((m) => m.userId === existing.assignee.userId))
          : undefined) ??
        null,
    );
  }, [open, existing, members, selfRow, setAssignee]);

  // Ask the server whether the picked teammate can open this diagram.
  // Self-assignment short-circuits to yes (the assigner is right here,
  // editing it). Stale responses are ignored via the cancelled flag.
  useEffect(() => {
    if (!open || !assignee) return;
    setAssigneeAccess('unknown');
    if (assignee.userId !== null && assignee.userId === selfUserId) {
      setAssigneeAccess('yes');
      return;
    }
    // Invited member: there may be no account to ask about, and the
    // answer is knowable without the server — they get access when they
    // accept the invite. The hint below says exactly that.
    if (assignee.pending) {
      setAssigneeAccess('invited');
      return;
    }
    if (!ownerId || !diagramId || !assignee.teamId || !assignee.userId) {
      setAssigneeAccess('error');
      return;
    }
    let cancelled = false;
    void apiCheckAssigneeAccess(ownerId, assignee.teamId, {
      assigneeUserId: assignee.userId,
      diagramId,
    }).then((canAccess) => {
      if (cancelled) return;
      setAssigneeAccess(canAccess === null ? 'error' : canAccess ? 'yes' : 'no');
    });
    return () => {
      cancelled = true;
    };
  }, [open, assignee, ownerId, diagramId, selfUserId]);

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

  return { selfRow, members, grouped, memberOfDiagramTeam, assigneeAccess };
}
