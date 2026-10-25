// The team card's rules (packages/explorer/README.md "Teams"): who shows in what order, the last-admin rule as the
// server keeps it, and how each removal is worded by who goes.

import type { TeamMember } from '../data/teams';

/** What a member is called: their name, else their email's local part made readable ("anna.smith" → "Anna Smith"). */
export function memberName(m: Pick<TeamMember, 'name' | 'email'>, self: boolean): string {
  if (m.name?.trim()) return m.name.trim();
  if (m.email) {
    const local = m.email.split('@')[0] ?? m.email;
    const words = local.split(/[._\-+]+/).filter(Boolean);
    if (words.length > 0) return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
    return m.email;
  }
  return self ? 'You' : 'Member';
}

export type MemberState = 'joined' | 'invited' | 'declined' | 'expired';

export function memberState(m: Pick<TeamMember, 'status' | 'expired'>): MemberState {
  if (m.status === 'joined') return 'joined';
  if (m.status === 'declined') return 'declined';
  return m.expired ? 'expired' : 'invited';
}

/** Joined members first (admins, then by name), then the invitations waiting (oldest first), then the ones turned
 *  down or expired. */
export function orderMembers(members: readonly TeamMember[]): TeamMember[] {
  const rank: Record<MemberState, number> = { joined: 0, invited: 1, declined: 2, expired: 2 };
  return [...members].sort((a, b) => {
    const ra = rank[memberState(a)];
    const rb = rank[memberState(b)];
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      return (
        Number(b.role === 'admin') - Number(a.role === 'admin') ||
        memberName(a, false).localeCompare(memberName(b, false))
      );
    }
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

/** The last-admin rule, as the server keeps it (liveworkspace/docs/accounts.md "Teams"): a team always keeps a joined
 *  admin. So the only one can't step down, and can't leave while anyone else is in it; alone, leaving deletes the
 *  team. */
export function lastAdmin(members: readonly TeamMember[], myMemberId: string) {
  const joined = members.filter((m) => m.status === 'joined');
  const admins = joined.filter((m) => m.role === 'admin');
  const onlyAdmin = admins.length === 1 && admins[0]!.id === myMemberId;
  const alone = joined.length === 1 && joined[0]!.id === myMemberId;
  return { onlyAdmin, alone, canLeave: !onlyAdmin || alone };
}

export type Removal = 'self' | 'invite' | 'declined' | 'member';

export function removalOf(m: TeamMember, self: boolean): Removal {
  if (self) return 'self';
  const state = memberState(m);
  if (state === 'invited') return 'invite';
  if (state === 'declined' || state === 'expired') return 'declined';
  return 'member';
}

/** The question asked before a removal, and its button. */
export function removalCopy(
  kind: Removal,
  name: string,
  teamName: string,
  alone = false,
): { title: string; message: string; confirm: string } {
  switch (kind) {
    case 'self':
      return alone
        ? {
            title: 'Leave Team?',
            message: `You’re the only member of ${teamName}, so leaving deletes the team.`,
            confirm: 'Leave and Delete',
          }
        : {
            title: 'Leave Team?',
            message: `You’ll lose access to ${teamName}’s work in every app. You can be invited back.`,
            confirm: 'Leave Team',
          };
    case 'invite':
      return {
        title: 'Withdraw Invite?',
        message: `${name} won’t be able to join ${teamName} with this invitation.`,
        confirm: 'Withdraw Invite',
      };
    case 'declined':
      return {
        title: 'Remove from List?',
        message: `${name} is taken off ${teamName}’s list. You can invite them again.`,
        confirm: 'Remove',
      };
    case 'member':
      return {
        title: 'Remove Member?',
        message: `${name} loses access to ${teamName}’s work in every app. You can invite them back.`,
        confirm: 'Remove Member',
      };
  }
}

export function deleteCopy(teamName: string) {
  return {
    title: 'Delete Team?',
    message: `${teamName} goes from every app, for everyone in it. Work kept in the team stays with whoever made it.`,
    confirm: 'Delete Team',
  };
}

export const TEAM_NAME_MAX = 80;
export const ORGANISATION_MAX = 80;
