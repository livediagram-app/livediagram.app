// Reading teams (teams.ts): an account's teams, invitations and memberships, and a team's members.

import { profilePictureOf } from '@liveworkspace/sites/picture';
import { INVITATION_TTL_MS, MAX_TEAMS_PER_ACCOUNT, type TeamRole } from './shared.ts';

// One of the first few members a team's card shows, admins first, then longest-standing.
export interface MemberPreview {
  id: string;
  name: string | null;
  email: string;
  role: TeamRole;
  // Their published Google picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"), read with the name.
  picture: string | null;
}

// A joined member's published picture, as a column beside `u.name`: the account's Google picture unless its
// switch is off. `u` is the member's "user" row and `p` their profile row; checked again in code (profilePictureOf).
const MEMBER_PICTURE = 'CASE WHEN COALESCE(p.show_picture, 1) = 1 THEN u.image END';

// Members shown on each team's card in the list; the counts cover the rest.
export const LIST_PREVIEW_MEMBERS = 4;

export interface MyTeam {
  id: string;
  name: string;
  organisation: string | null;
  role: TeamRole;
  memberCount: number;
  // Invitations still waiting.
  invitedCount: number;
  members: MemberPreview[];
}

interface MyTeamRow {
  id: string;
  name: string;
  organisation: string | null;
  role: TeamRole;
  memberCount: number;
  invitedCount: number;
  memberId: string | null;
  memberName: string | null;
  memberEmail: string | null;
  memberRole: TeamRole | null;
  memberPicture: string | null;
}

// The teams an account has joined, by name, each with its counts and first few members: one
// statement however many teams (up to 50), so the list page needs no request per team. The members
// are ranked per team by a window function and cut to LIST_PREVIEW_MEMBERS; a team's rows come back
// together, in rank order.
export async function listMyTeams(db: D1Database, userId: string): Promise<MyTeam[]> {
  const { results } = await db
    .prepare(
      `WITH mine AS (
         SELECT t.id, t.name, t.organisation, m.role FROM team t JOIN team_member m ON m.teamId = t.id
         WHERE m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL
       ),
       counts AS (
         SELECT c.teamId,
                SUM(CASE WHEN c.status = 'joined' THEN 1 ELSE 0 END) AS memberCount,
                SUM(CASE WHEN c.status = 'invited' THEN 1 ELSE 0 END) AS invitedCount
         FROM team_member c JOIN mine ON mine.id = c.teamId
         WHERE c.status IN ('joined', 'invited') GROUP BY c.teamId
       ),
       ranked AS (
         SELECT c.teamId, c.id, c.email, c.role, u.name, ${MEMBER_PICTURE} AS picture,
                ROW_NUMBER() OVER (
                  PARTITION BY c.teamId
                  ORDER BY CASE c.role WHEN 'admin' THEN 0 ELSE 1 END, c.createdAt, c.id
                ) AS rank
         FROM team_member c JOIN mine ON mine.id = c.teamId LEFT JOIN "user" u ON u.id = c.userId
         LEFT JOIN profile p ON p.owner_id = c.userId
         WHERE c.status = 'joined'
       )
       SELECT mine.id, mine.name, mine.organisation, mine.role,
              COALESCE(counts.memberCount, 0) AS memberCount,
              COALESCE(counts.invitedCount, 0) AS invitedCount,
              r.id AS memberId, r.name AS memberName, r.email AS memberEmail, r.role AS memberRole,
              r.picture AS memberPicture
       FROM mine
       LEFT JOIN counts ON counts.teamId = mine.id
       LEFT JOIN ranked r ON r.teamId = mine.id AND r.rank <= ?
       ORDER BY mine.name COLLATE NOCASE, mine.id, r.rank`,
    )
    .bind(userId, LIST_PREVIEW_MEMBERS)
    .all<MyTeamRow>();
  const teams: MyTeam[] = [];
  for (const row of results) {
    let team = teams.at(-1);
    if (team?.id !== row.id) {
      team = {
        id: row.id,
        name: row.name,
        organisation: row.organisation,
        role: row.role,
        memberCount: row.memberCount,
        invitedCount: row.invitedCount,
        members: [],
      };
      teams.push(team);
    }
    if (row.memberId && row.memberEmail && row.memberRole) {
      team.members.push({
        id: row.memberId,
        name: row.memberName,
        email: row.memberEmail,
        role: row.memberRole,
        picture: profilePictureOf(row.memberPicture),
      });
    }
  }
  return teams;
}

export interface TeamClaim {
  id: string;
  name: string;
  role: TeamRole;
}

// What the apps' access tokens carry: every team the account is in, so an app can tell from the token
// alone when its copy of the account's teams is out of date (liveworkspace/docs/specs/003-accounts/accounts.md).
export async function teamsClaim(db: D1Database, userId: string): Promise<TeamClaim[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.name, m.role FROM team t JOIN team_member m ON m.teamId = t.id
       WHERE m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL
       ORDER BY t.id LIMIT ?`,
    )
    .bind(userId, MAX_TEAMS_PER_ACCOUNT)
    .all<TeamClaim>();
  return results;
}

export interface Invitation {
  id: string;
  teamId: string;
  teamName: string;
  organisation: string | null;
  memberCount: number;
  role: TeamRole;
  invitedByName: string | null;
  createdAt: number;
}

// Invitations waiting for this address, those past their 28 days left out (the hourly sweep marks them expired).
export async function listMyInvitations(
  db: D1Database,
  email: string | null,
  now = Date.now(),
): Promise<Invitation[]> {
  if (!email) return [];
  const { results } = await db
    .prepare(
      `SELECT m.id, m.teamId, t.name AS teamName, t.organisation, m.role, u.name AS invitedByName,
              m.createdAt,
              (SELECT COUNT(*) FROM team_member c WHERE c.teamId = t.id AND c.status = 'joined') AS memberCount
       FROM team_member m JOIN team t ON t.id = m.teamId
       LEFT JOIN "user" u ON u.id = m.invitedBy
       WHERE m.email = ? AND m.status = 'invited' AND t.deletedAt IS NULL AND ${UNEXPIRED}
       ORDER BY m.createdAt DESC`,
    )
    .bind(email, now - INVITATION_TTL_MS)
    .all<Invitation>();
  return results;
}

interface Membership {
  memberId: string;
  role: TeamRole;
  teamName: string;
  organisation: string | null;
}

export async function getMembership(
  db: D1Database,
  teamId: string,
  userId: string,
): Promise<Membership | null> {
  return db
    .prepare(
      `SELECT m.id AS memberId, m.role, t.name AS teamName, t.organisation
       FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.teamId = ? AND m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL`,
    )
    .bind(teamId, userId)
    .first<Membership>();
}

// The teams an account (the one `?`) is in, as SQL: the caps are read before a write for its answer, and again inside
// the write, so requests racing past the first read can't together go over (MAX_TEAMS_PER_ACCOUNT,
// MAX_MEMBERS_PER_TEAM).
export const JOINED_TEAMS = `(SELECT COUNT(*) FROM team_member jm JOIN team jt ON jt.id = jm.teamId
  WHERE jm.userId = ? AND jm.status = 'joined' AND jt.deletedAt IS NULL)`;
// A team's (the one `?`) open rows, invited or joined.
export const OPEN_MEMBERS = `(SELECT COUNT(*) FROM team_member om WHERE om.teamId = ? AND om.status IN ('invited', 'joined'))`;
// An invitation `m` still in its 28 days (the one `?` is now - INVITATION_TTL_MS): the hourly sweep marks it expired
// later, and until then it can't be accepted.
export const UNEXPIRED = `(m.clockStartedAt IS NULL OR m.clockStartedAt > ?)`;

export async function joinedTeamCount(db: D1Database, userId: string): Promise<number> {
  const row = await db.prepare(`SELECT ${JOINED_TEAMS} AS n`).bind(userId).first<{ n: number }>();
  return row?.n ?? 0;
}

export interface Member {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: TeamRole;
  // 'declined' is an invitation turned down, or left unanswered until it expired (`expired`). It
  // stays on the list, granting nothing, so the admins can see the answer, until an admin removes it
  // or invites the address again.
  status: 'invited' | 'joined' | 'declined';
  expired: boolean;
  createdAt: number;
  // A joined member's published Google picture; null for an invitation.
  picture: string | null;
}

// Joined members, then open invitations, then the ones turned down; admins first in each.
export async function listMembers(db: D1Database, teamId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.userId, m.email, u.name, m.role, m.status, m.expiredAt, m.createdAt,
              CASE WHEN m.status = 'joined' THEN ${MEMBER_PICTURE} END AS picture
       FROM team_member m LEFT JOIN "user" u ON u.id = m.userId
       LEFT JOIN profile p ON p.owner_id = m.userId
       WHERE m.teamId = ? AND m.status IN ('invited', 'joined', 'declined')
       ORDER BY CASE m.status WHEN 'joined' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
                CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, m.email`,
    )
    .bind(teamId)
    .all<Omit<Member, 'expired'> & { expiredAt: number | null }>();
  return results.map(({ expiredAt, ...member }) => ({
    ...member,
    expired: expiredAt !== null,
    picture: profilePictureOf(member.picture),
  }));
}
