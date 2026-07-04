// Team invites (spec/32), split out of teams.ts: the email-invite rows
// (a team_members row with status 'invited'), the lazy claim that
// connects a verified email to its Clerk user, the accept flip, and the
// shareable one-week invite link with its token join. Core team /
// member CRUD stays in teams.ts.

import type { Team, TeamInvite, TeamMember } from '@livediagram/api-schema';
import type { Env } from '../types';
import { getMembership, JOINED_COUNT, rowToTeam, TEAM_COLS, type TeamRow } from './teams';

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
