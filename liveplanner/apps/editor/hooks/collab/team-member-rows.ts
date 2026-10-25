// A team's people as pickable teammates (docs/specs/012-collaboration/assigned-actions.md §2,
// comment-mentions.md "Who can be mentioned"): everyone in the team, joined AND invited, except the caller. A
// rejected invite is no teammate and is left out. Shared by the Assign Action picker and the comment mention list
// so the two agree on who "your teammates" are.

import { isOpenTeamMember } from '@liveplanner/api-schema';
import type { TeamMember } from '@/lib/api-client';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';

// Their profile name once they have one, else their address's local part, prettified (`ada.lovelace` ->
// `Ada Lovelace`).
export function teamMemberName(m: Pick<TeamMember, 'name' | 'email'>): string {
  if (m.name?.trim()) return m.name.trim();
  if (!m.email) return 'Member';
  const words = (m.email.split('@')[0] ?? m.email).split(/[._\-+]+/).filter(Boolean);
  if (words.length === 0) return m.email;
  return words.map((w) => w[0]!.toUpperCase() + w.slice(1)).join(' ');
}

export function teamMemberRows(
  members: readonly TeamMember[],
  team: { id: string; name: string },
  excludeUserId: string,
): PickableMember[] {
  return members
    .filter((m) => m.userId !== excludeUserId && isOpenTeamMember(m))
    .map((m) => ({
      // Null for an invited person with no account yet; memberId is their key then.
      userId: m.userId,
      memberId: m.id,
      pending: m.status === 'invited',
      name: teamMemberName(m),
      email: m.email,
      teamId: team.id,
      teamName: team.name,
    }));
}
