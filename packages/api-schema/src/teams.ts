// Teams (docs/specs/013-workspace/teams.md): the rows the api serves and the invite states, every product's.

export type TeamRole = 'admin' | 'member';

// A team row. No owner column: ownership is expressed through the
// Admin role on the member link rows, so a team survives its creator
// leaving. `organisation` is free text (docs/specs/013-workspace/teams.md), not a foreign key.
export type Team = {
  id: string;
  name: string;
  organisation: string | null;
  createdAt: number;
  updatedAt: number;
};

// `GET /api/teams` list projection: the team plus the caller's own
// role (drives which management controls the UI shows) and a member
// count for the sidebar badge, both joined server-side so the list
// doesn't need N member fetches.
export type TeamListItem = Team & {
  myRole: TeamRole;
  memberCount: number;
};

// The invite's state (docs/specs/013-workspace/teams.md). An 'invited' row grants no membership: it
// waits in the invitee's Invites section until they accept ('joined'). The two rejected states are
// records, not memberships: 'declined' (they said no, in the app or from the email) and 'expired'
// (nobody answered within 28 days). Both stay on the list, as Rejected, until an Admin removes them.
export type TeamMemberStatus = 'invited' | 'joined' | 'declined' | 'expired';

// True for a row that is (or may become) a membership. A rejected row ('declined' / 'expired') is only a
// record for the admins' list: never a mention, an assignee, or anyone to email.
export function isOpenTeamMember(member: { status: TeamMemberStatus }): boolean {
  return member.status === 'invited' || member.status === 'joined';
}

// One member link row. `userId` is the account id, null while the
// invite hasn't connected yet (docs/specs/013-workspace/teams.md's lazy claim fills it in —
// connecting identifies the person, it does NOT accept for them).
// `email` is the lowercased invite address; null only on a creator
// row minted when the deployment's JWT carries no email claim. One of
// the two is always set.
export type TeamMember = {
  id: string;
  teamId: string;
  userId: string | null;
  email: string | null;
  role: TeamRole;
  status: TeamMemberStatus;
  // The member's display name (docs/specs/013-workspace/teams.md), resolved from their
  // participant profile once they've joined and used the app. Null on
  // a pending invite or a member with no profile yet; the client then
  // falls back to the invite email's local part.
  name: string | null;
  createdAt: number;
  updatedAt: number;
};

// One row of `GET /api/teams/invites`: an invitation waiting for the caller on liveworkspace.app, where
// it is answered (liveworkspace/docs/specs/003-accounts/accounts.md "Invitations"), with enough of the team to decide:
// its name and organisation, how many people have joined, the role offered, who invited them and when.
export type TeamInvite = {
  memberId: string;
  team: Team;
  memberCount: number;
  invitedAt: number;
  role: TeamRole;
  invitedByName: string | null;
};
