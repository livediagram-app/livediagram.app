// teams + team_members (spec/32). Membership doubles as the invite
// store: a row with status 'invited' is a pending invite waiting in
// its owner's Invites section; `connectInvitesByEmail` fills in WHO
// the person is the first time their address shows up in a verified
// JWT, and `acceptTeamMember` is the explicit yes that makes them a
// member. Declining is a plain row delete.

import type { Team, TeamListItem, TeamMember, TeamRole } from '@livediagram/api-schema';
import type { Env } from '../types';
import { getParticipant } from './participants';

// TEAM_COLS / JOINED_COUNT / TeamRow / rowToTeam are shared with the
// invite machinery in team-invites.ts.
export const TEAM_COLS = 'id, name, organisation, created_at, updated_at';
const MEMBER_COLS = 'id, team_id, user_id, email, role, status, created_at, updated_at';

// Joined-members subquery used everywhere a member count surfaces:
// pending invites are not members, so they never inflate the number.
export const JOINED_COUNT = `(SELECT COUNT(*) FROM team_members c WHERE c.team_id = t.id AND c.status = 'joined')`;

export type TeamRow = {
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
  status: string | null;
  created_at: number;
  updated_at: number;
};

export function rowToTeam(row: TeamRow): Team {
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
    // Defensive default mirrors the migration backfill: an unknown /
    // NULL status reads as 'joined' so a drifted row can't lock a
    // real member out of their own team.
    status: row.status === 'invited' ? 'invited' : 'joined',
    // Filled in by listTeamMembers via the participants join; the bare
    // row mapping leaves it null.
    name: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Teams the user has JOINED — pending invites live in
// listInvitesByUser instead, so an un-accepted invite never shows up
// as a membership (spec/32 accept/decline).
export async function listTeamsByUser(env: Env, userId: string): Promise<TeamListItem[]> {
  const result = await env.DB.prepare(
    `SELECT t.id, t.name, t.organisation, t.created_at, t.updated_at,
            m.role AS my_role,
            ${JOINED_COUNT} AS member_count
     FROM teams t
     JOIN team_members m ON m.team_id = t.id AND m.user_id = ? AND m.status = 'joined'
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
  const members = (result.results ?? []).map(rowToMember);
  // Resolve each connected member's display name from their participant
  // profile (spec/32) so the list shows real names ("Anna Smith"), not
  // just the prettified invite email. Pending / profile-less rows stay
  // null and the client falls back to the email.
  return Promise.all(
    members.map(async (m) =>
      m.userId ? { ...m, name: (await getParticipant(env, m.userId))?.name ?? null } : m,
    ),
  );
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
      `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', 'joined', ?, ?)`,
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
  // Re-home the team's diagrams to their owners' personal Unsorted FIRST
  // (spec/35): deleting a team must never destroy members' work. Each
  // team diagram already carries an owner_id (its creator, or whoever a
  // move-out transferred it to), so clearing team_id + folder_id returns
  // it to that owner's personal library. The team's folders are dropped
  // (a team's folder tree doesn't map onto a personal one). Explicit
  // deletes (not FK CASCADE — SQLite enforcement is opt-in via PRAGMA),
  // mirroring deleteFolder's re-home-then-delete rationale.
  await env.DB.prepare('UPDATE diagrams SET team_id = NULL, folder_id = NULL WHERE team_id = ?')
    .bind(id)
    .run();
  await env.DB.prepare('DELETE FROM folders WHERE team_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(id).run();
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

// The last-admin guard's input (spec/32): how many JOINED admin rows
// the team has. Status-filtered on purpose — a pending invite that
// was promoted to admin hasn't accepted responsibility for the team,
// so it must not satisfy the "someone can still manage this" check.
export async function countTeamAdmins(env: Env, teamId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM team_members WHERE team_id = ? AND role = 'admin' AND status = 'joined'`,
  )
    .bind(teamId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// The Clerk user ids of a team's joined admins (spec/65): who gets told
// when someone responds to an invite. Only `joined` rows with a connected
// user_id qualify — a pending-admin invite has no identity to email yet,
// and a member isn't an admin. The notification layer resolves each id to a
// verified address via email_lifecycle.
export async function listTeamAdminUserIds(env: Env, teamId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT user_id FROM team_members
      WHERE team_id = ? AND role = 'admin' AND status = 'joined' AND user_id IS NOT NULL`,
  )
    .bind(teamId)
    .all<{ user_id: string }>();
  return (results ?? []).map((r) => r.user_id);
}

// Account deletion (spec/65): detach a user from every team BEFORE
// their rows are wiped. Without this the dead Clerk id lingered as a
// ghost member — and when it was the only joined admin, the team
// became permanently unmanageable (every admin-gated action counted
// the dead row via countTeamAdmins), while the account wipe's
// diagrams DELETE destroyed the team-library diagrams they created.
//
// Per team:
//   - Last joined member → the team dies with the account
//     (deleteTeam; nobody is left for its library to belong to).
//   - Otherwise their team-library diagrams transfer to an HEIR (the
//     longest-standing remaining joined member, admins first) so the
//     shared work survives — mirroring deleteTeam's "never destroy
//     members' work" rule — their membership row is removed, and the
//     heir is promoted when no joined admin remains.
export async function detachUserFromTeams(env: Env, userId: string): Promise<void> {
  const memberships = await env.DB.prepare(
    'SELECT id, team_id, status FROM team_members WHERE user_id = ?',
  )
    .bind(userId)
    .all<{ id: string; team_id: string; status: string }>();
  for (const m of memberships.results ?? []) {
    const others = await env.DB.prepare(
      `SELECT id, user_id, role FROM team_members
        WHERE team_id = ? AND user_id != ? AND status = 'joined' AND user_id IS NOT NULL
        ORDER BY created_at ASC, id ASC`,
    )
      .bind(m.team_id, userId)
      .all<{ id: string; user_id: string; role: string }>();
    const remaining = others.results ?? [];
    if (m.status === 'joined' && remaining.length === 0) {
      await deleteTeam(env, m.team_id);
      continue;
    }
    const heir = remaining.find((r) => r.role === 'admin') ?? remaining[0];
    if (heir) {
      await env.DB.prepare('UPDATE diagrams SET owner_id = ? WHERE owner_id = ? AND team_id = ?')
        .bind(heir.user_id, userId, m.team_id)
        .run();
    }
    await env.DB.prepare('DELETE FROM team_members WHERE id = ?').bind(m.id).run();
    if (heir && !remaining.some((r) => r.role === 'admin')) {
      await env.DB.prepare(`UPDATE team_members SET role = 'admin' WHERE id = ?`)
        .bind(heir.id)
        .run();
    }
  }
}

// Joined-member count for a team (the public "N members" number the
// invite-link landing shows). Excludes pending invites.
export async function countJoinedMembers(env: Env, teamId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM team_members WHERE team_id = ? AND status = 'joined'`,
  )
    .bind(teamId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}
