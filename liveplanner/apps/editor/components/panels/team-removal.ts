// What it means to remove a row from a team's member list (docs/specs/013-workspace/teams.md), and how to
// say it — the confirm copy, the failure notice, and the telemetry type.
//
// Its own module because the list mixes two genuinely different things behind
// one Remove control: people who have joined, and invitations nobody has
// accepted yet (`status: 'invited'`). Treating those as one act read wrong in
// both directions. The dialog told an admin withdrawing an unaccepted invite
// that a "member" would be "removed from" the team, when that person had never
// been in it. And telemetry recorded it as `Team·Removed·Member`, so the count
// of people who left a team was inflated by invitations that were never taken
// up — while `Team·Removed·Invite`, which docs/specs/017-telemetry/telemetry.md defines as exactly this
// withdrawal, was being emitted somewhere else entirely (by the RECIPIENT
// declining, which is now `Team·Declined·Invite`).
//
// A fourth kind arrived with rejected invites (docs/specs/013-workspace/teams.md "Declining from the email",
// "Reminders and expiry"): a declined or expired row is neither a member nor an open invitation, so clearing
// it is neither a removal nor a withdrawal.
//
// Four kinds, one decision point, so the copy and the counting can't disagree.

import type { TeamMemberStatus } from '@/lib/api-client';

type TeamRemovalKind = 'self' | 'invite' | 'rejected' | 'member';

export function teamRemovalKind(isSelf: boolean, status: TeamMemberStatus): TeamRemovalKind {
  // Leaving is checked first: a member acting on their own row is leaving the
  // team whatever the row's status says.
  if (isSelf) return 'self';
  if (status === 'declined' || status === 'expired') return 'rejected';
  return status === 'invited' ? 'invite' : 'member';
}

// The `type` slot for `Team·Removed` (docs/specs/017-telemetry/telemetry.md). Deliberately parallel to the
// kind rather than derived from it inline, so a new kind can't be added without
// choosing what it reports as.
export function teamRemovalTelemetryType(
  kind: TeamRemovalKind,
): 'Self' | 'Invite' | 'Rejected' | 'Member' {
  if (kind === 'self') return 'Self';
  if (kind === 'rejected') return 'Rejected';
  return kind === 'invite' ? 'Invite' : 'Member';
}

// What the confirm dialog says before a team goes. Read by the team
// pane.
export function teamDeleteCopy(teamName: string | undefined) {
  return {
    title: 'Delete Team?',
    message: `"${teamName}" and its member list will be permanently deleted. Plans are not affected.`,
    confirmLabel: 'Delete Team',
  };
}

type TeamRemovalCopy = {
  title: string;
  message: string;
  confirmLabel: string;
  // Shown in the pane's notice strip when the request threw.
  failureNotice: string;
};

// `memberLabel` is the resolved display name (or the invite email's local part
// for someone who has never signed in); unused for the self case, where the
// subject is "you". `expired` tells a rejected row's two causes apart.
export function teamRemovalCopy(
  kind: TeamRemovalKind,
  {
    memberLabel,
    teamName,
    expired = false,
  }: { memberLabel: string | null; teamName: string | undefined; expired?: boolean },
): TeamRemovalCopy {
  if (kind === 'self') {
    return {
      title: 'Leave Team?',
      message: `You will no longer be a member of "${teamName}".`,
      confirmLabel: 'Leave',
      failureNotice: 'Could not leave the team. Try again.',
    };
  }
  if (kind === 'invite') {
    return {
      title: 'Withdraw Invite?',
      message: `${memberLabel} has not joined "${teamName}" yet. Their invitation will be withdrawn.`,
      confirmLabel: 'Withdraw',
      failureNotice: 'Could not withdraw the invite. Try again.',
    };
  }
  if (kind === 'rejected') {
    const why = expired
      ? `${memberLabel}'s invite to "${teamName}" expired with no reply.`
      : `${memberLabel} declined the invite to "${teamName}".`;
    return {
      title: 'Remove from List?',
      message: `${why} Removing clears it from the list, and you can invite them again any time.`,
      confirmLabel: 'Remove',
      failureNotice: 'Could not remove the invite. Try again.',
    };
  }
  return {
    title: 'Remove Member?',
    message: `${memberLabel} will be removed from "${teamName}".`,
    confirmLabel: 'Remove',
    failureNotice: 'Could not remove the member. Try again.',
  };
}
