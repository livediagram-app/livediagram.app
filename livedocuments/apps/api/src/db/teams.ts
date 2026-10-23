// teams + team_members (docs/specs/013-workspace/teams.md): this app's copy of the liveworkspace
// teams its people are in, and their joined members (liveworkspace/docs/accounts.md "Teams"), kept by
// db/team-sync.ts. Every access check joins on it; nothing here writes a membership but the sync and
// account deletion.

import type { Team, TeamListItem, TeamMember, TeamMemberStatus } from '@livedocuments/api-schema';
import type { Env } from '../types';
import { getParticipant } from './participants';
import { imageGrantOwnerChangeStatement } from './image-grants';

// TEAM_COLS / JOINED_COUNT / TeamRow / rowToTeam: the columns and row shape every team read here shares.
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

// The rows that are (or may become) a membership. A rejected row ('declined' / 'expired') is a record
// an Admin reads on the list, so every permission check starts from these two only. NULL counts as
// open for the same reason memberStatus reads it as 'joined'.
export function openMemberSql(column = 'status'): string {
  return `(${column} IS NULL OR ${column} IN ('invited', 'joined'))`;
}

// Defensive default mirrors the migration backfill: an unknown / NULL status reads as 'joined' so a
// drifted row can't lock a real member out of their own team.
export function memberStatus(raw: string | null): TeamMemberStatus {
  return raw === 'invited' || raw === 'declined' || raw === 'expired' ? raw : 'joined';
}

function rowToMember(row: MemberRow): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'member',
    status: memberStatus(row.status),
    // Filled in by listTeamMembers via the participants join; the bare
    // row mapping leaves it null.
    name: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Teams the user has JOINED — pending invites live in
// listInvitesByUser instead, so an un-accepted invite never shows up
// as a membership (docs/specs/013-workspace/teams.md accept/decline).
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
  // profile (docs/specs/013-workspace/teams.md) so the list shows real names ("Anna Smith"), not
  // just the prettified invite email. Pending / profile-less rows stay
  // null and the client falls back to the email.
  return Promise.all(
    members.map(async (m) => {
      if (!m.userId) return m;
      const p = await getParticipant(env, m.userId);
      return { ...m, name: p?.name ?? null };
    }),
  );
}

// The caller's own membership row in a team — the permission check
// every team route starts from. Null = not a member, which includes a
// rejected invite: it grants nothing, not even a read of the team.
export async function getMembership(
  env: Env,
  teamId: string,
  userId: string,
): Promise<TeamMember | null> {
  const row = await env.DB.prepare(
    `SELECT ${MEMBER_COLS} FROM team_members
      WHERE team_id = ? AND user_id = ? AND ${openMemberSql()}`,
  )
    .bind(teamId, userId)
    .first<MemberRow>();
  return row ? rowToMember(row) : null;
}

export async function deleteTeam(env: Env, id: string): Promise<void> {
  // Re-home the team's documents to the root of their owners' My Work FIRST
  // (docs/specs/013-workspace/team-shared-documents.md): deleting a team must never destroy members' work. Each
  // team document already carries an owner_id (its creator, or whoever a
  // move-out transferred it to), so clearing team_id + folder_id returns
  // it to that owner's personal library. The team's folders are dropped
  // (a team's folder tree doesn't map onto a personal one). Explicit
  // deletes (not FK CASCADE — SQLite enforcement is opt-in via PRAGMA),
  // mirroring deleteFolder's re-home-then-delete rationale.
  await env.DB.prepare('UPDATE documents SET team_id = NULL, folder_id = NULL WHERE team_id = ?')
    .bind(id)
    .run();
  await env.DB.prepare('DELETE FROM folders WHERE team_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM team_members WHERE team_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(id).run();
}

// The account ids of a team's joined admins (docs/specs/014-identity/profile-and-email-notifications.md): who gets told
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

// Account deletion (docs/specs/014-identity/profile-and-email-notifications.md): detach a user from every team BEFORE
// their rows are wiped. Without this the dead account id lingered as a
// ghost member — and when it was the only joined admin, the team
// became permanently unmanageable (every admin-gated action counted
// the dead row via countTeamAdmins), while the account wipe's
// documents DELETE destroyed the team-library documents they created.
//
// Per team:
//   - Last joined member → the team dies with the account
//     (deleteTeam; nobody is left for its library to belong to).
//   - Otherwise their team-library documents transfer to an HEIR (the
//     longest-standing remaining joined member, admins first) so the
//     shared work survives — mirroring deleteTeam's "never destroy
//     members' work" rule — their membership row is removed, and the
//     heir is promoted when no joined admin remains.
// Move a departing user's team documents + team folders onto another member.
//
// Ownership of a team document is more than an audit field: every access gate
// honours `owner_id` BEFORE it checks membership (and the owner-only routes,
// share links and passwords among them, check nothing else), so work left
// owned by somebody who has gone stays open to them. The folders go too, so
// no team row is left owned by a departed (or deleted) account.
async function moveTeamWork(env: Env, teamId: string, fromUserId: string, toUserId: string) {
  // Their images in these documents keep serving once the documents are someone else's.
  await env.DB.batch([
    imageGrantOwnerChangeStatement(
      env,
      'd.owner_id = ?2 AND d.team_id = ?3',
      [fromUserId, teamId],
      Date.now(),
    ),
    env.DB.prepare('UPDATE documents SET owner_id = ? WHERE owner_id = ? AND team_id = ?').bind(
      toUserId,
      fromUserId,
      teamId,
    ),
  ]);
  await env.DB.prepare('UPDATE folders SET owner_id = ? WHERE owner_id = ? AND team_id = ?')
    .bind(toUserId, fromUserId, teamId)
    .run();
}

// A member leaving or being removed (docs/specs/013-workspace/teams.md + docs/specs/013-workspace/team-shared-documents.md): hand what they made
// in the team to the remaining joined member detachUserFromTeams would pick,
// the earliest admin, else the earliest member. Call BEFORE the membership
// row goes. A no-op when nobody else has joined.
export async function handTeamWorkToHeir(env: Env, teamId: string, userId: string): Promise<void> {
  const heir = await env.DB.prepare(
    `SELECT user_id FROM team_members
      WHERE team_id = ? AND user_id != ? AND status = 'joined' AND user_id IS NOT NULL
      ORDER BY (role = 'admin') DESC, created_at ASC, id ASC
      LIMIT 1`,
  )
    .bind(teamId, userId)
    .first<{ user_id: string }>();
  if (heir) await moveTeamWork(env, teamId, userId, heir.user_id);
}

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
    if (heir) await moveTeamWork(env, m.team_id, userId, heir.user_id);
    await env.DB.prepare('DELETE FROM team_members WHERE id = ?').bind(m.id).run();
    if (heir && !remaining.some((r) => r.role === 'admin')) {
      await env.DB.prepare(`UPDATE team_members SET role = 'admin' WHERE id = ?`)
        .bind(heir.id)
        .run();
    }
  }
}
