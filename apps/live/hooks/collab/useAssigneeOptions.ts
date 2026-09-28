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

// The Assign Action dialog's assignee dataset (docs/specs/012-collaboration/assigned-actions.md §2 + §4), lifted
// out of AssignActionDialog: the pinned Myself row, the diagram team's
// member list (joined AND invited), the preselect-on-edit resolution,
// the per-pick server access check, and the by-team grouping the picker
// renders. The dialog keeps the `assignee` selection state itself (its
// seeds it on open, alongside the name / description fields)
// and passes it through.
// Whether the picked teammate can actually open this diagram
// (docs/specs/012-collaboration/assigned-actions.md §4), asked of the server per selection. 'error'
// falls back to the picked-team heuristic with hedged wording.
type Access = 'unknown' | 'yes' | 'no' | 'error' | 'invited';

// A server answer, kept with the question it answers.
type CheckedAccess = {
  assignee: PickableMember;
  ownerId: string;
  diagramId: string;
  access: Access;
};

// A member list, kept with the owner and teams it was loaded for.
type LoadedMembers = { ownerId: string; teams: TeamListItem[]; members: PickableMember[] };

const NO_MEMBERS: PickableMember[] = [];

// The answer knowable without the server, or null when it must be asked.
function localAccess(
  assignee: PickableMember,
  ids: { ownerId: string | null; selfUserId: string | null; diagramId: string | null },
): Access | null {
  // Self-assignment is a yes: the assigner is right here, editing it.
  if (assignee.userId !== null && assignee.userId === ids.selfUserId) return 'yes';
  // Invited member: there may be no account to ask about, and the
  // answer is knowable without the server — they get access when they
  // accept the invite. The hint says exactly that.
  if (assignee.pending) return 'invited';
  if (!ids.ownerId || !ids.diagramId || !assignee.teamId || !assignee.userId) return 'error';
  return null;
}

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
  const [checked, setChecked] = useState<CheckedAccess | null>(null);
  const [loaded, setLoaded] = useState<LoadedMembers | null>(null);
  // Every open starts afresh: members reload and each pick is asked again.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLoaded(null);
      setChecked(null);
    }
  }

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
  // (docs/specs/012-collaboration/assigned-actions.md §2): members of the user's other teams almost certainly
  // can't open the diagram to complete the action, so offering them
  // just manufactures the access warning. Empty for a personal diagram
  // and for a share-link editor who isn't a member of the team.
  const pickableTeams = useMemo(
    () => teams.filter((t) => t.id === diagramTeamId),
    [teams, diagramTeamId],
  );
  const memberOfDiagramTeam = pickableTeams.length > 0;
  // Null while loading. A guest picker is Myself alone.
  const members = !ownerId
    ? NO_MEMBERS
    : loaded?.ownerId === ownerId && loaded.teams === pickableTeams
      ? loaded.members
      : null;

  // Load the diagram team's joined members once per open (signed-in
  // only; a guest picker is Myself alone). One GET per pickable team
  // (zero or one); a failure just leaves its members out.
  useEffect(() => {
    if (!open || !ownerId) return;
    let cancelled = false;
    void Promise.all(
      pickableTeams.map(async (team) => {
        try {
          const detail = await apiGetTeam(ownerId, team.id);
          return detail.members
            .filter(
              // Everyone on the team — joined AND invited (docs/specs/012-collaboration/assigned-actions.md: work
              // gets divided while invites are in flight) — except the
              // assigner themselves, whom the pinned Myself row covers.
              (m: TeamMember) => m.userId !== ownerId,
            )
            .map((m: TeamMember): PickableMember => ({
              // Null for an invited member the lazy claim hasn't
              // identified yet; memberId is their key then.
              userId: m.userId,
              memberId: m.id,
              pending: m.status === 'invited',
              name: memberName(m, false, null),
              email: m.email,
              teamId: team.id,
              teamName: team.name,
            }));
        } catch {
          return [];
        }
      }),
    ).then((lists) => {
      if (!cancelled) setLoaded({ ownerId, teams: pickableTeams, members: lists.flat() });
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

  // Ask the server whether the picked teammate can open this diagram,
  // unless the answer is knowable without it (localAccess). Stale responses
  // are ignored via the cancelled flag.
  const local = open && assignee ? localAccess(assignee, { ownerId, selfUserId, diagramId }) : null;
  const askServer = open && assignee !== null && local === null;
  useEffect(() => {
    if (!askServer || !assignee?.teamId || !assignee.userId || !ownerId || !diagramId) return;
    let cancelled = false;
    void apiCheckAssigneeAccess(ownerId, assignee.teamId, {
      assigneeUserId: assignee.userId,
      diagramId,
    }).then((canAccess) => {
      if (cancelled) return;
      setChecked({
        assignee,
        ownerId,
        diagramId,
        access: canAccess === null ? 'error' : canAccess ? 'yes' : 'no',
      });
    });
    return () => {
      cancelled = true;
    };
  }, [askServer, assignee, ownerId, diagramId]);
  // 'unknown' while in flight (show nothing).
  const assigneeAccess: Access =
    local ??
    (checked?.assignee === assignee &&
    checked.ownerId === ownerId &&
    checked.diagramId === diagramId
      ? checked.access
      : 'unknown');

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
