// A team's members as pickable people (docs/specs/012-collaboration/assigned-actions.md §2,
// comment-mentions.md "Who can be mentioned"): everyone on the team, joined
// AND invited, except the caller. Shared by the Assign Action picker and the
// comment mention list so the two agree on who "your teammates" are.

import type { TeamMember } from '@/lib/api-client';
import { memberName } from '@/components/panels/team-pane-parts';
import type { PickableMember } from '@/components/dialogs/AssignActionAssigneePicker';

export function teamMemberRows(
  members: readonly TeamMember[],
  team: { id: string; name: string },
  excludeUserId: string,
): PickableMember[] {
  return members
    .filter((m) => m.userId !== excludeUserId)
    .map((m) => ({
      // Null for an invited member the lazy claim hasn't identified yet;
      // memberId is their key then.
      userId: m.userId,
      memberId: m.id,
      pending: m.status === 'invited',
      name: memberName(m, false, null),
      email: m.email,
      teamId: team.id,
      teamName: team.name,
    }));
}
