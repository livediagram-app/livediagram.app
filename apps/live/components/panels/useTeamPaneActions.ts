'use client';

import { useState } from 'react';
import {
  apiDeleteTeam,
  apiInviteTeamMember,
  apiRemoveTeamMember,
  apiUpdateTeam,
  apiUpdateTeamMemberRole,
  type TeamMember,
  type TeamRole,
} from '@/lib/api-client';
import type { TeamDetailResponse } from '@/lib/api/teams';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { track } from '@/lib/telemetry';
import { memberName } from './team-pane-parts';
import { teamRemovalCopy, teamRemovalKind, teamRemovalTelemetryType } from './team-removal';

// The TeamPane's mutation handlers (spec/32), lifted out of the pane:
// edit / delete team, email invite, role change, and remove / leave —
// each with its confirm, failure notice, and refresh choreography. The
// pane keeps the load state and render; this hook owns the notice +
// invite-form state the handlers write. Mounted before the pane's
// loading / 404 early returns, so it reads `detail` lazily inside each
// handler (they only ever run once the detail has rendered).
export function useTeamPaneActions({
  ownerId,
  teamId,
  detail,
  refresh,
  onTeamsChanged,
  onLeftTeam,
}: {
  ownerId: string;
  teamId: string;
  detail: TeamDetailResponse | null;
  refresh: () => Promise<void>;
  onTeamsChanged: () => void;
  onLeftTeam: () => void;
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const confirm = useConfirm();

  const submitEdit = async (values: { name: string; organisation: string | null }) => {
    try {
      await apiUpdateTeam(ownerId, teamId, values);
    } catch {
      // Don't leave the optimistic name on screen as if it saved: refresh back
      // to the stored value and tell the user.
      setNotice('Could not save the team. Try again.');
      await refresh();
      return;
    }
    track('Team', 'Changed');
    await refresh();
    onTeamsChanged();
  };

  const deleteTeam = async () => {
    const ok = await confirm({
      title: 'Delete team?',
      message: `"${detail?.team.name}" and its member list will be permanently deleted. Diagrams are not affected.`,
      confirmLabel: 'Delete team',
    });
    if (!ok) return;
    // Only navigate away once the delete actually succeeds — a failed delete
    // must not bounce the user out as though the team were gone.
    try {
      await apiDeleteTeam(ownerId, teamId);
    } catch {
      setNotice('Could not delete the team. Try again.');
      return;
    }
    track('Team', 'Deleted');
    onTeamsChanged();
    onLeftTeam();
  };

  const invite = async () => {
    const email = inviteEmail.trim();
    if (!email || inviteBusy) return;
    setInviteBusy(true);
    setNotice(null);
    try {
      const result = await apiInviteTeamMember(ownerId, teamId, email);
      if (!result.ok) {
        setNotice(
          result.reason === 'already_member'
            ? 'That address is already on this team.'
            : 'That does not look like an email address.',
        );
        return;
      }
      track('Team', 'Added', 'Member');
      setInviteEmail('');
      await refresh();
      onTeamsChanged();
    } catch {
      setNotice('Invite failed. Try again.');
    } finally {
      setInviteBusy(false);
    }
  };

  const changeRole = async (member: TeamMember, role: TeamRole) => {
    if (role === member.role) return;
    const result = await apiUpdateTeamMemberRole(ownerId, teamId, member.id, role).catch(
      () => null,
    );
    // `null` is a thrown error (network / 5xx) — the role did NOT
    // change; without a notice the select just silently reverts.
    if (!result) {
      setNotice('Could not change the role. Try again.');
      return;
    }
    if (!result.ok) {
      setNotice('A team needs at least one Admin. Promote someone else first.');
      return;
    }
    track('Team', 'Changed', 'Role');
    await refresh();
  };

  const removeMember = async (member: TeamMember, isSelf: boolean) => {
    // One control, three acts: leaving, withdrawing an invitation nobody
    // accepted, and removing someone who did join. team-removal.ts decides
    // which, so the wording and the telemetry can't drift apart.
    const kind = teamRemovalKind(isSelf, member.status);
    const copy = teamRemovalCopy(kind, {
      memberLabel: isSelf ? null : memberName(member, false, null),
      teamName: detail?.team.name,
    });
    const ok = await confirm({
      title: copy.title,
      message: copy.message,
      confirmLabel: copy.confirmLabel,
    });
    if (!ok) return;
    const result = await apiRemoveTeamMember(ownerId, teamId, member.id).catch(() => null);
    // `null` is a thrown error (network / 5xx) — nothing was removed.
    // Falling through treated the failure as success: "Leave team"
    // bounced the user to Recent while they were still a member
    // (mirrors deleteTeam's guard directly above).
    if (!result) {
      setNotice(copy.failureNotice);
      return;
    }
    if (!result.ok) {
      setNotice('A team needs at least one Admin. Promote someone else first.');
      return;
    }
    track('Team', 'Removed', teamRemovalTelemetryType(kind));
    onTeamsChanged();
    if (isSelf) {
      onLeftTeam();
      return;
    }
    await refresh();
  };

  return {
    inviteEmail,
    setInviteEmail,
    inviteBusy,
    notice,
    setNotice,
    submitEdit,
    deleteTeam,
    invite,
    changeRole,
    removeMember,
  };
}
