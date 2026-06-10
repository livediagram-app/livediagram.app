// teams + team_members (spec/32). Membership doubles as the invite
// store: a row with user_id NULL is a pending email invite that
// `connectInvitesByEmail` claims the first time that address shows up
// in a verified JWT.

import type { Team, TeamListItem, TeamMember, TeamRole } from '@livediagram/api-schema';
import type { Env } from '../types';

const TEAM_COLS = 'id, name, organisation, created_at, updated_at';
const MEMBER_COLS = 'id, team_id, user_id, email, role, created_at, updated_at';

type TeamRow = {
  id: string;
  name: string;
  organisation: string | null;
  created_at: number;
  updated_at: number;
};

type MemberRow = {
  id: string;
  team_id: string;
  user_id: string | null;
  email: string | null;
  role: string;
  created_at: number;
  updated_at: number;
};

function rowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    organisation: row.organisation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'member',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// The lazy invite claim (spec/32): connect every pending row for this
// verified email to the caller's Clerk user id. Runs at the top of
// GET /api/teams so an invitee sees the team on their next Explorer
// visit whether they signed up before or after the invite. Idempotent
// and cheap when there's nothing pending (indexed on email).
export async function connectInvitesByEmail(
  env: Env,
  userId: string,
  email: string,
): Promise<void> {
  await env.DB.prepare(
    'UPDATE team_members SET user_id = ?, updated_at = ? WHERE email = ? AND user_id IS NULL',
  )
    .bind(userId, Date.now(), email)
    .run();
}

export async function listTeamsByUser(env: Env, userId: string): Promise<TeamListItem[]> {
  const result = await env.DB.prepare(
    `SELECT t.id, t.name, t.organisation, t.created_at, t.updated_at,
            m.role AS my_role,
            (SELECT COUNT(*) FROM team_members c WHERE c.team_id = t.id) AS member_count
     FROM teams t
     JOIN team_members m ON m.team_id = t.id AND m.user_id = ?
     ORDER BY t.name ASC`,
  )
    .bind(userId)
    .all<TeamRow & { my_role: string; member_count: number }>();
  return (result.results ?? []).map((row) => ({
    ...rowToTeam(row),
    myRole: row.my_role === 'admin' ? 'admin' : 'member',
    memberCount: row.member_count,
  }));
}

export async function getTeam(env: Env, id: string): Promise<Team | null> {
  const row = await env.DB.prepare(`SELECT ${TEAM_COLS} FROM teams WHERE id = ?`)
    .bind(id)
    .first<TeamRow>();
  return row ? rowToTeam(row) : null;
}

export async function listTeamMembers(env: Env, teamId: string): Promise<TeamMember[]> {
  // Admins first, then alphabetical by address, so the list reads
  // "who runs this" before "who's in it".
  const result = await env.DB.prepare(
    `SELECT ${MEMBER_COLS} FROM team_members WHERE team_id = ?
     ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, email ASC`,
  )
    .bind(teamId)
    .all<MemberRow>();
  return (result.results ?? []).map(rowToMember);
}

// The caller's own membership row in a team — the permission check
// every team route starts from. Null = not a member.
export async function getMembership(
  env: Env,
  teamId: string,
  userId: string,
): Promise<TeamMember | null> {
  const row = await env.DB.prepare(
    `SELECT ${MEMBER_COLS} FROM team_members WHERE team_id = ? AND user_id = ?`,
  )
    .bind(teamId, userId)
    .first<MemberRow>();
  return row ? rowToMember(row) : null;
}

export async function getTeamMember(env: Env, memberId: string): Promise<TeamMember | null> {
  const row = await env.DB.prepare(`SELECT ${MEMBER_COLS} FROM team_members WHERE id = ?`)
    .bind(memberId)
    .first<MemberRow>();
  return row ? rowToMember(row) : null;
}

// Create the team plus the creator's Admin member row in one batch so
// a half-created team (no admin) can't exist.
export async function createTeam(
  env: Env,
  t: { id: string; name: string; organisation: string | null },
  creator: { userId: string; email: string | null },
): Promise<Team> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO teams (id, name, organisation, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    ).bind(t.id, t.name, t.organisation, now, now),
    env.DB.prepare(
      `INSERT INTO team_members (id, team_id, user_id, email, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', ?, ?)`,
    ).bind(crypto.randomUUID(), t.id, creator.userId, creator.email, now, now),
  ]);
  return { id: t.id, name: t.name, organisation: t.organisation, createdAt: now, updatedAt: now };
}

export async function updateTeam(
  env: Env,
  id: string,
  patch: { name?: string; organisation?: string | null },
): Promise<void> {
  const now = Date.now();
  // Partial UPDATE, same semantics as updateFolder: undefined = leave
  // the column alone (organisation may be set to null explicitly).
  if (patch.name !== undefined) {
    await env.DB.prepare('UPDATE teams SET name = ?, updated_at = ? WHERE id = ?')
      .bind(patch.name, now, id)
      .run();
  }
  if (patch.organisation !== undefined) {
    await env.DB.prepare('UPDATE teams SET organisation = ?, updated_at = ? WHERE id = ?')
      .bind(patch.organisation, now, id)
      .run();
  }
}

export async function deleteTeam(env: Env, id: string): Promise<void> {
  // Explicit member delete before the team row, mirroring
  // deleteFolder's rationale: SQLite FK enforcement is opt-in via
  // PRAGMA, so don't depend on ON DELETE CASCADE firing.
  await env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(id).run();
}

// True when the address already has a row (pending or connected) on
// this team — the duplicate-invite gate.
export async function teamHasEmail(env: Env, teamId: string, email: string): Promise<boolean> {
  const row = await env.DB.prepare(
    'SELECT 1 AS x FROM team_members WHERE team_id = ? AND email = ?',
  )
    .bind(teamId, email)
    .first<{ x: number }>();
  return row !== null;
}

export async function addTeamMember(
  env: Env,
  m: { teamId: string; email: string },
): Promise<TeamMember> {
  const now = Date.now();
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO team_members (id, team_id, user_id, email, role, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'member', ?, ?)`,
  )
    .bind(id, m.teamId, m.email, now, now)
    .run();
  return {
    id,
    teamId: m.teamId,
    userId: null,
    email: m.email,
    role: 'member',
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateTeamMemberRole(
  env: Env,
  memberId: string,
  role: TeamRole,
): Promise<void> {
  await env.DB.prepare('UPDATE team_members SET role = ?, updated_at = ? WHERE id = ?')
    .bind(role, Date.now(), memberId)
    .run();
}

export async function removeTeamMember(env: Env, memberId: string): Promise<void> {
  await env.DB.prepare('DELETE FROM team_members WHERE id = ?').bind(memberId).run();
}

// The last-admin guard's input (spec/32): how many admin rows the
// team has. Counts pending-invite admins too — there are none today
// (invites are always members) but if that ever changes the guard
// should still see them.
export async function countTeamAdmins(env: Env, teamId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM team_members WHERE team_id = ? AND role = 'admin'`,
  )
    .bind(teamId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
