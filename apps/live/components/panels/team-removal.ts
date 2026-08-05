// What it means to remove a row from a team's member list (spec/32), and how to
// say it — the confirm copy, the failure notice, and the telemetry type.
//
// Its own module because the list mixes two genuinely different things behind
// one Remove control: people who have joined, and invitations nobody has
// accepted yet (`status: 'invited'`). Treating those as one act read wrong in
// both directions. The dialog told an admin withdrawing an unaccepted invite
// that a "member" would be "removed from" the team, when that person had never
// been in it. And telemetry recorded it as `Team·Removed·Member`, so the count
// of people who left a team was inflated by invitations that were never taken
// up — while `Team·Removed·Invite`, which spec/22 defines as exactly this
// withdrawal, was being emitted somewhere else entirely (by the RECIPIENT
// declining, which is now `Team·Declined·Invite`).
//
// Three kinds, one decision point, so the copy and the counting can't disagree.

import type { TeamMemberStatus } from '@/lib/api-client';

export type TeamRemovalKind = 'self' | 'invite' | 'member';

export function teamRemovalKind(isSelf: boolean, status: TeamMemberStatus): TeamRemovalKind {
  // Leaving is checked first: a member acting on their own row is leaving the
  // team whatever the row's status says.
  if (isSelf) return 'self';
  return status === 'invited' ? 'invite' : 'member';
}

// The `type` slot for `Team·Removed` (spec/22). Deliberately parallel to the
// kind rather than derived from it inline, so a new kind can't be added without
// choosing what it reports as.
export function teamRemovalTelemetryType(kind: TeamRemovalKind): 'Self' | 'Invite' | 'Member' {
  if (kind === 'self') return 'Self';
  return kind === 'invite' ? 'Invite' : 'Member';
}

export type TeamRemovalCopy = {
  title: string;
  message: string;
  confirmLabel: string;
  // Shown in the pane's notice strip when the request threw.
  failureNotice: string;
};

// `memberLabel` is the resolved display name (or the invite email's local part
// for someone who has never signed in); unused for the self case, where the
// subject is "you".
export function teamRemovalCopy(
  kind: TeamRemovalKind,
  { memberLabel, teamName }: { memberLabel: string | null; teamName: string | undefined },
): TeamRemovalCopy {
  if (kind === 'self') {
    return {
      title: 'Leave team?',
      message: `You will no longer be a member of "${teamName}".`,
      confirmLabel: 'Leave',
      failureNotice: 'Could not leave the team. Try again.',
    };
  }
  if (kind === 'invite') {
    return {
      title: 'Withdraw invite?',
      message: `${memberLabel} has not joined "${teamName}" yet. Their invitation will be withdrawn.`,
      confirmLabel: 'Withdraw',
      failureNotice: 'Could not withdraw the invite. Try again.',
    };
  }
  return {
    title: 'Remove member?',
    message: `${memberLabel} will be removed from "${teamName}".`,
    confirmLabel: 'Remove',
    failureNotice: 'Could not remove the member. Try again.',
  };
}
