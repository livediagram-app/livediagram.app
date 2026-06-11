// teams + team_members (spec/32). Membership doubles as the invite
// store: a row with status 'invited' is a pending invite waiting in
// its owner's Invites section; `connectInvitesByEmail` fills in WHO
// the person is the first time their address shows up in a verified
// JWT, and `acceptTeamMember` is the explicit yes that makes them a
// member. Declining is a plain row delete.

import type { Team, TeamInvite, TeamListItem, TeamMember, TeamRole } from '@livediagram/api-schema';
import type { Env } from '../types';
import { getParticipant } from './participants';

const TEAM_COLS = 'id, name, organisation, created_at, updated_at';
const MEMBER_COLS = 'id, team_id, user_id, email, role, status, created_at, updated_at';

// Joined-members subquery used everywhere a member count surfaces:
// pending invites are not members, so they never inflate the number.
const JOINED_COUNT = `(SELECT COUNT(*) FROM team_members c WHERE c.team_id = t.id AND c.status = 'joined')`;

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
  status: string | null;
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

// The caller's pending invites, oldest first: their own 'invited'
// rows joined with enough of the team to decide on (spec/32).
export async function listInvitesByUser(env: Env, userId: string): Promise<TeamInvite[]> {
  const result = await env.DB.prepare(
    `SELECT t.id, t.name, t.organisation, t.created_at, t.updated_at,
            m.id AS member_id, m.created_at AS invited_at,
            ${JOINED_COUNT} AS member_count
     FROM teams t
     JOIN team_members m ON m.team_id = t.id AND m.user_id = ? AND m.status = 'invited'
     ORDER BY m.created_at ASC`,
  )
    .bind(userId)
    .all<TeamRow & { member_id: string; invited_at: number; member_count: number }>();
  return (result.results ?? []).map((row) => ({
    memberId: row.member_id,
    team: rowToTeam(row),
    memberCount: row.member_count,
    invitedAt: row.invited_at,
  }));
}

// The explicit yes (spec/32): flips the caller's own invite row to
// 'joined'. Row-level authorisation (own row, currently invited)
// happens in the route; this is the plain write.
export async function acceptTeamMember(env: Env, memberId: string): Promise<void> {
  await env.DB.prepare(`UPDATE team_members SET status = 'joined', updated_at = ? WHERE id = ?`)
    .bind(Date.now(), memberId)
    .run();
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

// --- Shareable team invite link (spec/32) -----------------------------

// One week — the fixed lifetime of an invite link from when it's turned on.
export const TEAM_INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Turn the link on (token + expiry) or off (both null). Regenerating
// while it's on rotates the token and resets the week.
export async function setTeamInviteLink(
  env: Env,
  teamId: string,
  token: string | null,
  expiresAt: number | null,
): Promise<void> {
  await env.DB.prepare(
    'UPDATE teams SET invite_link_token = ?, invite_link_expires_at = ?, updated_at = ? WHERE id = ?',
  )
    .bind(token, expiresAt, Date.now(), teamId)
    .run();
}

// The team's current link (admin view). Null when off OR expired — an
// expired link reads as off so the admin sees they need to turn it on.
export async function getTeamInviteLink(
  env: Env,
  teamId: string,
): Promise<{ token: string; expiresAt: number } | null> {
  const row = await env.DB.prepare(
    'SELECT invite_link_token, invite_link_expires_at FROM teams WHERE id = ?',
  )
    .bind(teamId)
    .first<{ invite_link_token: string | null; invite_link_expires_at: number | null }>();
  if (!row?.invite_link_token || !row.invite_link_expires_at) return null;
  if (row.invite_link_expires_at <= Date.now()) return null;
  return { token: row.invite_link_token, expiresAt: row.invite_link_expires_at };
}

// Resolve a join token to its team, ONLY when the link is on and
// unexpired. Null = unknown / turned-off / expired token.
export async function getTeamByInviteToken(env: Env, token: string): Promise<Team | null> {
  const row = await env.DB.prepare(
    `SELECT ${TEAM_COLS} FROM teams
     WHERE invite_link_token = ? AND invite_link_expires_at > ?`,
  )
    .bind(token, Date.now())
    .first<TeamRow>();
  return row ? rowToTeam(row) : null;
}

// Join the caller to the team behind a valid invite token (spec/32).
// Idempotent: an existing joined member is a no-op; a pending email
// invite for the caller is accepted in place rather than duplicated.
// Returns null when the token is invalid / expired.
export async function joinTeamByInviteToken(
  env: Env,
  token: string,
  userId: string,
  callerEmail: string | null,
): Promise<{ teamId: string; alreadyMember: boolean } | null> {
  const team = await getTeamByInviteToken(env, token);
  if (!team) return null;
  // Already on the team (any prior row keyed to this user): accept a
  // pending invite, else no-op.
  const existing = await getMembership(env, team.id, userId);
  if (existing) {
    if (existing.status === 'invited') await acceptTeamMember(env, existing.id);
    return { teamId: team.id, alreadyMember: existing.status === 'joined' };
  }
  // Connect + accept a pending email invite for this user first, so a
  // link-join doesn't duplicate a row an admin already added by email.
  if (callerEmail) {
    await connectInvitesByEmail(env, userId, callerEmail);
    const connected = await getMembership(env, team.id, userId);
    if (connected) {
      if (connected.status === 'invited') await acceptTeamMember(env, connected.id);
      return { teamId: team.id, alreadyMember: connected.status === 'joined' };
    }
  }
  // Fresh join. Carry the caller's email for display only when it isn't
  // already taken on the team (the UNIQUE(team_id, email) gate), else null.
  const emailForRow =
    callerEmail && !(await teamHasEmail(env, team.id, callerEmail)) ? callerEmail : null;
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'member', 'joined', ?, ?)`,
  )
    .bind(crypto.randomUUID(), team.id, userId, emailForRow, now, now)
    .run();
  return { teamId: team.id, alreadyMember: false };
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
    `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
     VALUES (?, ?, NULL, ?, 'member', 'invited', ?, ?)`,
  )
    .bind(id, m.teamId, m.email, now, now)
    .run();
  return {
    id,
    teamId: m.teamId,
    userId: null,
    email: m.email,
    role: 'member',
    status: 'invited',
    name: null,
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
