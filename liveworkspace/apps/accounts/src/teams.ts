// Teams (liveworkspace/docs/accounts.md "Teams"): made and run on liveworkspace.app, the same team in
// every app. A member row doubles as the invitation: 'invited' until the person with that verified
// address accepts ('joined') or declines ('declined', from the site or the email's link; an invitation
// nobody answers in 28 days becomes 'declined' too, stamped expiredAt); leaving or being removed
// makes it 'removed'. A team can also have one join link an admin turns on, good for a week.
// Rows are never deleted, and every write takes the next rev from team_seq in the same batch, so the
// apps can follow every change through teamChanges().

// Longer names are cut to this, like account names.
export const TEAM_NAME_MAX_LENGTH = 80;
// Teams one account can be in: the access token carries them all (teamsClaim), so this bounds it.
export const MAX_TEAMS_PER_ACCOUNT = 50;
// Members and open invitations in one team.
export const MAX_MEMBERS_PER_TEAM = 200;
// The free-text organisation line under a team's name.
export const ORGANISATION_MAX_LENGTH = 80;
// How long a join link works once an admin turns it on (or makes a new one).
export const INVITE_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
// An unanswered invitation is reminded at these ages, then expires (liveworkspace/docs/accounts.md
// "Reminders and expiry").
export const REMINDER_AGES_MS = [1 * DAY_MS, 7 * DAY_MS, 21 * DAY_MS] as const;
export const INVITATION_TTL_MS = 28 * DAY_MS;
// Per daily sweep: invitations expired, and reminders sent per stage.
export const EXPIRE_BATCH = 500;
export const REMINDER_BATCH = 100;
// Failed reminder sends in a row before an invitation leaves the reminder queue for good.
export const MAX_REMINDER_ATTEMPTS = 3;
// Decline tokens kept per invitation: the invitation's own and one per reminder.
const MAX_DECLINE_HASHES = 4;

export type TeamRole = 'admin' | 'member';
export type MemberStatus = 'invited' | 'joined' | 'declined' | 'removed';

export interface Actor {
  id: string;
  // The account's verified address, lower-cased, or null when it isn't verified.
  email: string | null;
  // The account's name, for the Timeline's "by …" (an event with none says "a teammate").
  name?: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (status: number, error: string): Result<never> => ({ ok: false, status, error });

import { isSettingsApp, type SettingsApp } from './settings.ts';
import {
  teamScopes,
  timelineStatement,
  type TimelineEvent,
  type TimelineType,
} from './index-timeline.ts';

// One team event for the Timeline (index-timeline.ts), queued in the batch that makes its change. `guard`
// holds only when that change was made.
function teamEvent(
  db: D1Database,
  event: {
    id: string;
    type: TimelineType;
    teamId: string;
    teamName: string;
    actor: { id: string | null; name?: string | null } | null;
    at: number;
    scopes: string[];
    detail?: Record<string, string | null>;
  },
  guard?: { sql: string; args: unknown[] },
): D1PreparedStatement {
  const timeline: TimelineEvent = {
    id: event.id,
    type: event.type,
    actorId: event.actor?.id ?? null,
    actorName: event.actor?.name ?? null,
    title: event.teamName,
    detail: { teamId: event.teamId, ...event.detail },
    at: event.at,
    scopes: event.scopes,
  };
  return timelineStatement(db, timeline, guard);
}

// The member row still in `status`, changed at `now` by the batch before it.
const memberGuard = (memberId: string, status: MemberStatus, now: number) => ({
  sql: 'EXISTS (SELECT 1 FROM team_member WHERE id = ? AND status = ? AND updatedAt = ?)',
  args: [memberId, status, now],
});

// The people in a team, for an event they must see once it is gone.
async function joinedPeople(db: D1Database, teamId: string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT userId FROM team_member WHERE teamId = ? AND status = 'joined' AND userId IS NOT NULL`,
    )
    .bind(teamId)
    .all<{ userId: string }>();
  return results.map((r) => r.userId);
}

// The app an invitation's sender signed up through (migrations/0009_signup_app.sql), one primary-key
// read beside the member row: its emails are counted under it (email.ts). Null for liveworkspace.app,
// or an account with no series.
const INVITER_APP = '(SELECT l.signup_app FROM email_lifecycle l WHERE l.user_id = m.invitedBy)';
const appOrNull = (value: unknown): SettingsApp | null => (isSettingsApp(value) ? value : null);

// The rev the statement after it writes: bump first, then read it back, in one batch.
const BUMP = 'UPDATE team_seq SET value = value + 1 WHERE id = 1';
const REV = '(SELECT value FROM team_seq WHERE id = 1)';

// An organisation line, or null for none. Anything but a string is treated as none.
export function cleanOrganisation(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().slice(0, ORGANISATION_MAX_LENGTH) || null;
}

export function cleanTeamName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().slice(0, TEAM_NAME_MAX_LENGTH);
  return name || null;
}

// A plausible address, lower-cased; the invitation email is what proves it.
export function cleanEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// One of the first few members a team's card shows, admins first, then longest-standing.
export interface MemberPreview {
  id: string;
  name: string | null;
  email: string;
  role: TeamRole;
}

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
         SELECT c.teamId, c.id, c.email, c.role, u.name,
                ROW_NUMBER() OVER (
                  PARTITION BY c.teamId
                  ORDER BY CASE c.role WHEN 'admin' THEN 0 ELSE 1 END, c.createdAt, c.id
                ) AS rank
         FROM team_member c JOIN mine ON mine.id = c.teamId LEFT JOIN "user" u ON u.id = c.userId
         WHERE c.status = 'joined'
       )
       SELECT mine.id, mine.name, mine.organisation, mine.role,
              COALESCE(counts.memberCount, 0) AS memberCount,
              COALESCE(counts.invitedCount, 0) AS invitedCount,
              r.id AS memberId, r.name AS memberName, r.email AS memberEmail, r.role AS memberRole
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
// alone when its copy of the account's teams is out of date (liveworkspace/docs/accounts.md).
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

// Invitations waiting for this address.
export async function listMyInvitations(
  db: D1Database,
  email: string | null,
): Promise<Invitation[]> {
  if (!email) return [];
  const { results } = await db
    .prepare(
      `SELECT m.id, m.teamId, t.name AS teamName, t.organisation, m.role, u.name AS invitedByName,
              m.createdAt,
              (SELECT COUNT(*) FROM team_member c WHERE c.teamId = t.id AND c.status = 'joined') AS memberCount
       FROM team_member m JOIN team t ON t.id = m.teamId
       LEFT JOIN "user" u ON u.id = m.invitedBy
       WHERE m.email = ? AND m.status = 'invited' AND t.deletedAt IS NULL
       ORDER BY m.createdAt DESC`,
    )
    .bind(email)
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

async function joinedTeamCount(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL`,
    )
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function createTeam(
  db: D1Database,
  actor: Actor,
  rawName: unknown,
  now = Date.now(),
  rawOrganisation: unknown = null,
): Promise<Result<MyTeam>> {
  const name = cleanTeamName(rawName);
  if (!name) return fail(400, 'name_required');
  const organisation = cleanOrganisation(rawOrganisation);
  if ((await joinedTeamCount(db, actor.id)) >= MAX_TEAMS_PER_ACCOUNT) {
    return fail(409, 'team_limit_reached');
  }
  const id = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  // An account without a verified address still needs a value here; it never matches an invite.
  const memberEmail = actor.email ?? `${actor.id}@account.invalid`;
  await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `INSERT INTO team (id, name, organisation, createdAt, updatedAt, rev) VALUES (?, ?, ?, ?, ?, ${REV})`,
      )
      .bind(id, name, organisation, now, now),
    db.prepare(BUMP),
    db
      .prepare(
        `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev)
         VALUES (?, ?, ?, ?, 'admin', 'joined', NULL, ?, ?, ${REV})`,
      )
      .bind(memberId, id, actor.id, memberEmail, now, now),
  ]);
  return ok({
    id,
    name,
    organisation,
    role: 'admin',
    memberCount: 1,
    invitedCount: 0,
    members: [{ id: memberId, name: null, email: memberEmail, role: 'admin' }],
  });
}

// An admin changes the team's name, its organisation line, or both. A field left out stays as it is.
export async function updateTeam(
  db: D1Database,
  actor: Actor,
  teamId: string,
  changes: { name?: unknown; organisation?: unknown },
  now = Date.now(),
): Promise<Result<{ id: string; name: string; organisation: string | null }>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  const name = changes.name === undefined ? me.teamName : cleanTeamName(changes.name);
  if (!name) return fail(400, 'name_required');
  const organisation =
    changes.organisation === undefined ? me.organisation : cleanOrganisation(changes.organisation);
  await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team SET name = ?, organisation = ?, updatedAt = ?, rev = ${REV} WHERE id = ?`,
      )
      .bind(name, organisation, now, teamId),
    ...(name !== me.teamName
      ? [
          teamEvent(db, {
            id: `team_renamed:${teamId}:${now}`,
            type: 'team_renamed',
            teamId,
            teamName: name,
            actor,
            at: now,
            scopes: teamScopes(teamId, []),
            detail: { from: me.teamName },
          }),
        ]
      : []),
  ]);
  return ok({ id: teamId, name, organisation });
}

export async function renameTeam(
  db: D1Database,
  actor: Actor,
  teamId: string,
  rawName: unknown,
  now = Date.now(),
): Promise<Result<{ id: string; name: string }>> {
  const result = await updateTeam(db, actor, teamId, { name: rawName ?? '' }, now);
  return result.ok ? ok({ id: result.value.id, name: result.value.name }) : result;
}

// The team and every open row in it go; the apps' copies follow from the change feed. Its members (no
// longer in it, so each by name) see it go on their Timelines.
async function deleteTeamStatements(
  db: D1Database,
  actor: Actor,
  teamId: string,
  teamName: string,
  now: number,
): Promise<D1PreparedStatement[]> {
  return [
    teamEvent(db, {
      id: `team_deleted:${teamId}`,
      type: 'team_deleted',
      teamId,
      teamName,
      actor,
      at: now,
      scopes: teamScopes(null, await joinedPeople(db, teamId)),
    }),
    ...deleteTeamRows(db, teamId, now),
  ];
}

// A team closing with the account that ran it alone: nobody is left to tell.
function deleteTeamRows(db: D1Database, teamId: string, now: number): D1PreparedStatement[] {
  return [
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team SET deletedAt = ?, updatedAt = ?, rev = ${REV},
           inviteLinkNonce = NULL, inviteLinkHash = NULL, inviteLinkExpiresAt = NULL
         WHERE id = ?`,
      )
      .bind(now, now, teamId),
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = 'removed', updatedAt = ?, rev = ${REV}
         WHERE teamId = ? AND status IN ('invited', 'joined')`,
      )
      .bind(now, teamId),
  ];
}

export async function deleteTeam(
  db: D1Database,
  actor: Actor,
  teamId: string,
  now = Date.now(),
): Promise<Result<{ id: string }>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  await db.batch(await deleteTeamStatements(db, actor, teamId, me.teamName, now));
  return ok({ id: teamId });
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
}

// Joined members, then open invitations, then the ones turned down; admins first in each.
export async function listMembers(db: D1Database, teamId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.userId, m.email, u.name, m.role, m.status, m.expiredAt, m.createdAt
       FROM team_member m LEFT JOIN "user" u ON u.id = m.userId
       WHERE m.teamId = ? AND m.status IN ('invited', 'joined', 'declined')
       ORDER BY CASE m.status WHEN 'joined' THEN 0 WHEN 'invited' THEN 1 ELSE 2 END,
                CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, m.email`,
    )
    .bind(teamId)
    .all<Omit<Member, 'expired'> & { expiredAt: number | null }>();
  return results.map(({ expiredAt, ...member }) => ({ ...member, expired: expiredAt !== null }));
}

export async function inviteMember(
  db: D1Database,
  actor: Actor,
  teamId: string,
  rawEmail: unknown,
  rawRole: unknown,
  now = Date.now(),
): Promise<Result<{ member: Member; teamName: string; declineToken: string }>> {
  const email = cleanEmail(rawEmail);
  if (!email) return fail(400, 'email_invalid');
  const role: TeamRole = rawRole === 'admin' ? 'admin' : 'member';
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  const counts = await db
    .prepare(
      `SELECT COUNT(*) AS open, SUM(CASE WHEN email = ? THEN 1 ELSE 0 END) AS same
       FROM team_member WHERE teamId = ? AND status IN ('invited', 'joined')`,
    )
    .bind(email, teamId)
    .first<{ open: number; same: number | null }>();
  if ((counts?.same ?? 0) > 0) return fail(409, 'already_invited');
  if ((counts?.open ?? 0) >= MAX_MEMBERS_PER_TEAM) return fail(409, 'member_limit_reached');
  const id = crypto.randomUUID();
  const decline = await newDeclineToken(id);
  // The person invited sees it too, when the address is already a verified account's.
  const invitee = await db
    .prepare('SELECT id FROM "user" WHERE email = ? AND emailVerified = 1')
    .bind(email)
    .first<{ id: string }>();
  try {
    await db.batch([
      // An address that turned an earlier invitation down is invited afresh: the old answer leaves
      // the list as the new invitation takes its place.
      db.prepare(BUMP),
      db
        .prepare(
          `UPDATE team_member SET status = 'removed', updatedAt = ?, rev = ${REV}
           WHERE teamId = ? AND email = ? AND status = 'declined'`,
        )
        .bind(now, teamId, email),
      db.prepare(BUMP),
      db
        .prepare(
          `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev,
                                    declineTokenHashes, clockStartedAt)
           VALUES (?, ?, NULL, ?, ?, 'invited', ?, ?, ?, ${REV}, ?, ?)`,
        )
        .bind(id, teamId, email, role, actor.id, now, now, decline.hash, now),
      teamEvent(db, {
        id: `team_invite_sent:${id}`,
        type: 'team_invite_sent',
        teamId,
        teamName: me.teamName,
        actor,
        at: now,
        scopes: teamScopes(teamId, [invitee?.id]),
        detail: { memberName: email, personId: invitee?.id ?? null, role },
      }),
    ]);
  } catch {
    // Two invitations to one address at once: the unique index lets one through.
    return fail(409, 'already_invited');
  }
  return ok({
    member: {
      id,
      userId: null,
      email,
      name: null,
      role,
      status: 'invited',
      expired: false,
      createdAt: now,
    },
    teamName: me.teamName,
    declineToken: decline.token,
  });
}

async function adminCount(db: D1Database, teamId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM team_member WHERE teamId = ? AND status = 'joined' AND role = 'admin'`,
    )
    .bind(teamId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

async function openMember(db: D1Database, teamId: string, memberId: string) {
  return db
    .prepare(
      `SELECT m.id, m.userId, m.role, m.status, COALESCE(u.name, m.email) AS memberName
       FROM team_member m LEFT JOIN "user" u ON u.id = m.userId
       WHERE m.id = ? AND m.teamId = ? AND m.status IN ('invited', 'joined')`,
    )
    .bind(memberId, teamId)
    .first<{
      id: string;
      userId: string | null;
      role: TeamRole;
      status: 'invited' | 'joined';
      memberName: string;
    }>();
}

// An invitation turned down (or expired), which an admin may clear from the list.
async function declinedMember(db: D1Database, teamId: string, memberId: string) {
  return db
    .prepare(
      `SELECT id, userId, role, status, email AS memberName FROM team_member
       WHERE id = ? AND teamId = ? AND status = 'declined'`,
    )
    .bind(memberId, teamId)
    .first<{
      id: string;
      userId: string | null;
      role: TeamRole;
      status: 'declined';
      memberName: string;
    }>();
}

export async function setMemberRole(
  db: D1Database,
  actor: Actor,
  teamId: string,
  memberId: string,
  rawRole: unknown,
  now = Date.now(),
): Promise<Result<{ id: string; role: TeamRole }>> {
  if (rawRole !== 'admin' && rawRole !== 'member') return fail(400, 'role_invalid');
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  const target = await openMember(db, teamId, memberId);
  if (!target) return fail(404, 'not_found');
  if (target.role === rawRole) return ok({ id: memberId, role: rawRole });
  // A team always keeps someone who can run it.
  if (
    target.status === 'joined' &&
    target.role === 'admin' &&
    rawRole === 'member' &&
    (await adminCount(db, teamId)) <= 1
  ) {
    return fail(409, 'last_admin');
  }
  await db.batch([
    db.prepare(BUMP),
    db
      .prepare(`UPDATE team_member SET role = ?, updatedAt = ?, rev = ${REV} WHERE id = ?`)
      .bind(rawRole, now, memberId),
    teamEvent(db, {
      id: `team_role_changed:${memberId}:${now}`,
      type: 'team_role_changed',
      teamId,
      teamName: me.teamName,
      actor,
      at: now,
      scopes: teamScopes(teamId, [target.userId]),
      detail: { personId: target.userId, memberName: target.memberName, role: rawRole },
    }),
  ]);
  return ok({ id: memberId, role: rawRole });
}

// An admin removes a member or withdraws an invitation; anyone may remove themselves (leave). The
// last admin can't leave while others remain; the last member leaving deletes the team.
export async function removeMember(
  db: D1Database,
  actor: Actor,
  teamId: string,
  memberId: string,
  now = Date.now(),
): Promise<Result<{ id: string; teamDeleted: boolean }>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  const self = me.memberId === memberId;
  if (!self && me.role !== 'admin') return fail(403, 'admin_only');
  const target =
    (await openMember(db, teamId, memberId)) ?? (await declinedMember(db, teamId, memberId));
  if (!target) return fail(404, 'not_found');
  if (target.status === 'joined' && target.role === 'admin') {
    const joined = await db
      .prepare(`SELECT COUNT(*) AS n FROM team_member WHERE teamId = ? AND status = 'joined'`)
      .bind(teamId)
      .first<{ n: number }>();
    if ((joined?.n ?? 0) <= 1) {
      await db.batch(await deleteTeamStatements(db, actor, teamId, me.teamName, now));
      return ok({ id: memberId, teamDeleted: true });
    }
    if ((await adminCount(db, teamId)) <= 1) return fail(409, 'last_admin');
  }
  await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = 'removed', updatedAt = ?, rev = ${REV} WHERE id = ?`,
      )
      .bind(now, memberId),
    // A member removed, or leaving; an invitation withdrawn or a refusal cleared is no news.
    ...(target.status === 'joined'
      ? [
          teamEvent(
            db,
            {
              id: `team_member_removed:${memberId}`,
              type: 'team_member_removed',
              teamId,
              teamName: me.teamName,
              actor,
              at: now,
              scopes: teamScopes(teamId, [target.userId]),
              detail: {
                personId: target.userId,
                memberName: target.memberName,
                left: self ? '1' : null,
              },
            },
            memberGuard(memberId, 'removed', now),
          ),
        ]
      : []),
  ]);
  return ok({ id: memberId, teamDeleted: false });
}

// The invited person's yes or no. Only an account whose verified address is the one invited may
// answer.
export async function answerInvitation(
  db: D1Database,
  actor: Actor,
  memberId: string,
  accept: boolean,
  now = Date.now(),
): Promise<
  Result<{
    id: string;
    teamId: string;
    teamName: string;
    status: 'joined' | 'declined';
    inviterApp: SettingsApp | null;
  }>
> {
  if (!actor.email) return fail(403, 'email_unverified');
  const row = await db
    .prepare(
      `SELECT m.id, m.teamId, t.name AS teamName, ${INVITER_APP} AS inviterApp
       FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.id = ? AND m.email = ? AND m.status = 'invited' AND t.deletedAt IS NULL`,
    )
    .bind(memberId, actor.email)
    .first<{ id: string; teamId: string; teamName: string; inviterApp: string | null }>();
  if (!row) return fail(404, 'not_found');
  const inviterApp = appOrNull(row.inviterApp);
  if (accept) {
    if ((await joinedTeamCount(db, actor.id)) >= MAX_TEAMS_PER_ACCOUNT) {
      return fail(409, 'team_limit_reached');
    }
    // Already in the team under another address: this invitation has nothing to add.
    if (await getMembership(db, row.teamId, actor.id)) {
      await db.batch([
        db.prepare(BUMP),
        db
          .prepare(
            `UPDATE team_member SET status = 'removed', updatedAt = ?, rev = ${REV} WHERE id = ?`,
          )
          .bind(now, memberId),
      ]);
      return ok({
        id: memberId,
        teamId: row.teamId,
        teamName: row.teamName,
        status: 'joined',
        inviterApp,
      });
    }
  }
  const status = accept ? 'joined' : 'declined';
  await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = ?, userId = ?, updatedAt = ?, rev = ${REV}
         WHERE id = ? AND status = 'invited'`,
      )
      .bind(status, accept ? actor.id : null, now, memberId),
    teamEvent(
      db,
      {
        id: `team_${status}:${memberId}`,
        type: accept ? 'team_joined' : 'team_declined',
        teamId: row.teamId,
        teamName: row.teamName,
        actor,
        at: now,
        scopes: teamScopes(row.teamId, [actor.id]),
        detail: { personId: actor.id, memberName: actor.name || actor.email },
      },
      memberGuard(memberId, status, now),
    ),
  ]);
  return ok({ id: memberId, teamId: row.teamId, teamName: row.teamName, status, inviterApp });
}

// Before an account is deleted: it leaves every team. A team it ran alone goes with it; one where it
// was the only admin passes to the longest-standing member.
// Answers the teams that closed with the account (those it ran alone).
export async function leaveAllTeams(
  db: D1Database,
  userId: string,
  now = Date.now(),
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.teamId, m.role,
              (SELECT COUNT(*) FROM team_member c WHERE c.teamId = m.teamId AND c.status = 'joined') AS joined,
              (SELECT COUNT(*) FROM team_member c WHERE c.teamId = m.teamId AND c.status = 'joined' AND c.role = 'admin') AS admins
       FROM team_member m WHERE m.userId = ? AND m.status = 'joined'`,
    )
    .bind(userId)
    .all<{ id: string; teamId: string; role: TeamRole; joined: number; admins: number }>();
  const statements: D1PreparedStatement[] = [];
  const closed: string[] = [];
  for (const row of results) {
    if (row.joined <= 1) {
      statements.push(...deleteTeamRows(db, row.teamId, now));
      closed.push(row.teamId);
      continue;
    }
    if (row.role === 'admin' && row.admins <= 1) {
      statements.push(
        db.prepare(BUMP),
        db
          .prepare(
            `UPDATE team_member SET role = 'admin', updatedAt = ?, rev = ${REV}
             WHERE id = (SELECT id FROM team_member WHERE teamId = ? AND status = 'joined' AND id != ?
                         ORDER BY createdAt, id LIMIT 1)`,
          )
          .bind(now, row.teamId, row.id),
      );
    }
    statements.push(
      db.prepare(BUMP),
      db
        .prepare(
          `UPDATE team_member SET status = 'removed', updatedAt = ?, rev = ${REV} WHERE id = ?`,
        )
        .bind(now, row.id),
    );
  }
  if (statements.length) await db.batch(statements);
  return closed;
}

// The change feed the apps keep their copies in step with: every team and member row written after
// the cursor, oldest first. A cursor is "rev:id" for each table, so rows that share a rev (one
// statement touching several) are never skipped at a page boundary.
export interface TeamChange {
  id: string;
  name: string;
  organisation: string | null;
  deleted: boolean;
  createdAt: number;
  updatedAt: number;
}
export interface MemberChange {
  id: string;
  teamId: string;
  userId: string | null;
  email: string;
  role: TeamRole;
  status: MemberStatus;
  createdAt: number;
  updatedAt: number;
}
export interface TeamChanges {
  teams: TeamChange[];
  members: MemberChange[];
  cursor: string;
  // More rows wait after this page.
  more: boolean;
}

interface Position {
  rev: number;
  id: string;
}

const START: Position = { rev: 0, id: '' };

function parsePosition(value: string | undefined): Position {
  const match = value?.match(/^(\d+):(.*)$/);
  return match ? { rev: Number(match[1]), id: match[2] ?? '' } : START;
}

export function parseCursor(cursor: string | null): { teams: Position; members: Position } {
  const [teams, members] = (cursor ?? '').split(',');
  return { teams: parsePosition(teams), members: parsePosition(members) };
}

const formatCursor = (teams: Position, members: Position) =>
  `${teams.rev}:${teams.id},${members.rev}:${members.id}`;

export const CHANGES_PAGE_SIZE = 500;

export async function teamChanges(
  db: D1Database,
  cursor: string | null,
  limit = CHANGES_PAGE_SIZE,
): Promise<TeamChanges> {
  const after = parseCursor(cursor);
  const [teamRows, memberRows] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT id, name, organisation, deletedAt, createdAt, updatedAt, rev FROM team
         WHERE rev > ? OR (rev = ? AND id > ?) ORDER BY rev, id LIMIT ?`,
      )
      .bind(after.teams.rev, after.teams.rev, after.teams.id, limit),
    db
      .prepare(
        `SELECT id, teamId, userId, email, role, status, createdAt, updatedAt, rev FROM team_member
         WHERE rev > ? OR (rev = ? AND id > ?) ORDER BY rev, id LIMIT ?`,
      )
      .bind(after.members.rev, after.members.rev, after.members.id, limit),
  ]);
  const teams = (teamRows?.results ?? []) as unknown as (TeamChange & {
    deletedAt: number | null;
    rev: number;
  })[];
  const members = (memberRows?.results ?? []) as unknown as (MemberChange & { rev: number })[];
  const lastTeam = teams.at(-1);
  const lastMember = members.at(-1);
  return {
    teams: teams.map(({ id, name, organisation, deletedAt, createdAt, updatedAt }) => ({
      id,
      name,
      organisation,
      deleted: deletedAt !== null,
      createdAt,
      updatedAt,
    })),
    members: members.map(({ rev: _rev, ...member }) => member),
    cursor: formatCursor(
      lastTeam ? { rev: lastTeam.rev, id: lastTeam.id } : after.teams,
      lastMember ? { rev: lastMember.rev, id: lastMember.id } : after.members,
    ),
    more: teams.length === limit || members.length === limit,
  };
}

// --- Tokens ---

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const randomSecret = () => base64url(crypto.getRandomValues(new Uint8Array(32)));

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return base64url(new Uint8Array(bytes));
}

// Compares two strings without stopping at the first difference, so the time taken says nothing
// about how much of a guess was right.
function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// --- Declining from the email ---

// Each invitation email (and each reminder) carries its own decline token, "<member id>.<secret>".
// Only the secret's hash is kept, on the row; the token can decline that one invitation and read what
// became of it, nothing else.
async function newDeclineToken(memberId: string): Promise<{ token: string; hash: string }> {
  const secret = randomSecret();
  return { token: `${memberId}.${secret}`, hash: await sha256(secret) };
}

export type DeclineStatus = 'invited' | 'declined' | 'expired' | 'joined';

interface DeclineRow {
  id: string;
  teamId: string;
  teamName: string;
  email: string;
  status: MemberStatus;
  expiredAt: number | null;
  declineTokenHashes: string;
  inviterApp: string | null;
}

// The invitation a decline token names, or null for any token that doesn't match one (unknown,
// malformed, or an invitation an admin removed or replaced), all alike.
async function declineRow(db: D1Database, token: unknown): Promise<DeclineRow | null> {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1 || token.length > 200) return null;
  const memberId = token.slice(0, dot);
  const row = await db
    .prepare(
      `SELECT m.id, m.teamId, t.name AS teamName, m.email, m.status, m.expiredAt, m.declineTokenHashes,
              ${INVITER_APP} AS inviterApp
       FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.id = ? AND t.deletedAt IS NULL AND m.status != 'removed'`,
    )
    .bind(memberId)
    .first<DeclineRow>();
  if (!row?.declineTokenHashes) return null;
  const presented = await sha256(token.slice(dot + 1));
  let match = false;
  for (const hash of row.declineTokenHashes.split(' '))
    match = sameString(hash, presented) || match;
  return match ? row : null;
}

const declineStatus = (row: DeclineRow): DeclineStatus =>
  row.status === 'declined'
    ? row.expiredAt === null
      ? 'declined'
      : 'expired'
    : (row.status as DeclineStatus);

export async function readDeclineToken(
  db: D1Database,
  token: unknown,
): Promise<{ teamName: string; status: DeclineStatus } | null> {
  const row = await declineRow(db, token);
  return row ? { teamName: row.teamName, status: declineStatus(row) } : null;
}

// Declines the invitation a token names. Saying no twice changes nothing; an expired invitation
// stays expired; a membership can't be undone this way. `declined` is true only for the request that
// turned it down, so only that one tells the admins.
export async function declineByToken(
  db: D1Database,
  token: unknown,
  now = Date.now(),
): Promise<
  Result<{
    teamId: string;
    teamName: string;
    email: string;
    status: 'declined' | 'expired';
    declined: boolean;
    inviterApp: SettingsApp | null;
  }>
> {
  const row = await declineRow(db, token);
  if (!row) return fail(404, 'invite_not_found');
  const status = declineStatus(row);
  if (status === 'joined') return fail(409, 'already_joined');
  const base = {
    teamId: row.teamId,
    teamName: row.teamName,
    email: row.email,
    inviterApp: appOrNull(row.inviterApp),
  };
  if (status !== 'invited') return ok({ ...base, status, declined: false });
  const [, changed] = await db.batch<unknown>([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = 'declined', updatedAt = ?, rev = ${REV}
         WHERE id = ? AND status = 'invited'`,
      )
      .bind(now, row.id),
    // From the email's link, signed in or not: named by the address invited.
    teamEvent(
      db,
      {
        id: `team_declined:${row.id}`,
        type: 'team_declined',
        teamId: row.teamId,
        teamName: row.teamName,
        actor: { id: null, name: row.email },
        at: now,
        scopes: teamScopes(row.teamId, []),
        detail: { memberName: row.email },
      },
      memberGuard(row.id, 'declined', now),
    ),
  ]);
  const declined = ((changed as { meta?: { changes?: number } })?.meta?.changes ?? 0) > 0;
  return ok({ ...base, status: 'declined', declined });
}

// --- The join link ---

// The token in a team's join link: an HMAC of its nonce under the Worker's secret. Recomputable, so an
// admin can copy the link again, but not from the table alone, which keeps only its hash.
export async function inviteLinkToken(secret: string, teamId: string, nonce: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`team-join-link:${teamId}:${nonce}`),
  );
  return base64url(new Uint8Array(mac));
}

export const joinLinkUrl = (baseUrl: string, token: string) =>
  `${baseUrl.replace(/\/+$/, '')}/join?token=${encodeURIComponent(token)}`;

export interface InviteLink {
  url: string;
  expiresAt: number;
}

// The team's join link while it is on and unexpired, else null.
export async function currentInviteLink(
  db: D1Database,
  teamId: string,
  secret: string,
  baseUrl: string,
  now = Date.now(),
): Promise<InviteLink | null> {
  const row = await db
    .prepare(
      `SELECT inviteLinkNonce, inviteLinkExpiresAt FROM team WHERE id = ? AND deletedAt IS NULL`,
    )
    .bind(teamId)
    .first<{ inviteLinkNonce: string | null; inviteLinkExpiresAt: number | null }>();
  if (!row?.inviteLinkNonce || !row.inviteLinkExpiresAt || row.inviteLinkExpiresAt <= now)
    return null;
  const token = await inviteLinkToken(secret, teamId, row.inviteLinkNonce);
  return { url: joinLinkUrl(baseUrl, token), expiresAt: row.inviteLinkExpiresAt };
}

// An admin turns the link on, or makes a new one, which ends the old one; either way it works for a
// week from now.
export async function makeInviteLink(
  db: D1Database,
  actor: Actor,
  teamId: string,
  secret: string,
  baseUrl: string,
  now = Date.now(),
): Promise<Result<InviteLink>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  const nonce = randomSecret();
  const token = await inviteLinkToken(secret, teamId, nonce);
  const expiresAt = now + INVITE_LINK_TTL_MS;
  await db
    .prepare(
      `UPDATE team SET inviteLinkNonce = ?, inviteLinkHash = ?, inviteLinkExpiresAt = ? WHERE id = ?`,
    )
    .bind(nonce, await sha256(token), expiresAt, teamId)
    .run();
  return ok({ url: joinLinkUrl(baseUrl, token), expiresAt });
}

export async function clearInviteLink(
  db: D1Database,
  actor: Actor,
  teamId: string,
): Promise<Result<{ id: string }>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  await db
    .prepare(
      `UPDATE team SET inviteLinkNonce = NULL, inviteLinkHash = NULL, inviteLinkExpiresAt = NULL WHERE id = ?`,
    )
    .bind(teamId)
    .run();
  return ok({ id: teamId });
}

async function linkedTeam(db: D1Database, token: unknown, now: number) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  return db
    .prepare(
      `SELECT t.id, t.name, t.organisation,
              (SELECT COUNT(*) FROM team_member c WHERE c.teamId = t.id AND c.status = 'joined') AS memberCount
       FROM team t WHERE t.inviteLinkHash = ? AND t.inviteLinkExpiresAt > ? AND t.deletedAt IS NULL`,
    )
    .bind(await sha256(token), now)
    .first<{ id: string; name: string; organisation: string | null; memberCount: number }>();
}

export interface JoinPreview {
  teamId: string;
  teamName: string;
  organisation: string | null;
  memberCount: number;
  // True only when the caller is signed in and already a joined member.
  alreadyMember: boolean;
}

// What a join link opens onto, before anyone signs in: the token is the credential, so naming the team
// to whoever holds it gives nothing away.
export async function previewInviteLink(
  db: D1Database,
  token: unknown,
  userId: string | null,
  now = Date.now(),
): Promise<JoinPreview | null> {
  const team = await linkedTeam(db, token, now);
  if (!team) return null;
  const alreadyMember = userId ? Boolean(await getMembership(db, team.id, userId)) : false;
  return {
    teamId: team.id,
    teamName: team.name,
    organisation: team.organisation,
    memberCount: team.memberCount,
    alreadyMember,
  };
}

// Joins the team a link names, as a member. Already in it: nothing changes. An invitation waiting
// for the caller's address is accepted in place rather than doubled.
export async function joinByInviteLink(
  db: D1Database,
  actor: Actor,
  token: unknown,
  now = Date.now(),
): Promise<
  Result<{ teamId: string; teamName: string; alreadyMember: boolean; acceptedInvite: boolean }>
> {
  const team = await linkedTeam(db, token, now);
  if (!team) return fail(404, 'invite_not_found');
  const result = { teamId: team.id, teamName: team.name };
  const joinedEvent = (memberId: string, guard?: { sql: string; args: unknown[] }) =>
    teamEvent(
      db,
      {
        id: `team_joined:${memberId}`,
        type: 'team_joined',
        teamId: team.id,
        teamName: team.name,
        actor,
        at: now,
        scopes: teamScopes(team.id, [actor.id]),
        detail: { personId: actor.id, memberName: actor.name || actor.email, via: 'link' },
      },
      guard,
    );
  if (await getMembership(db, team.id, actor.id)) {
    return ok({ ...result, alreadyMember: true, acceptedInvite: false });
  }
  if ((await joinedTeamCount(db, actor.id)) >= MAX_TEAMS_PER_ACCOUNT) {
    return fail(409, 'team_limit_reached');
  }
  const pending = actor.email
    ? await db
        .prepare(`SELECT id FROM team_member WHERE teamId = ? AND email = ? AND status = 'invited'`)
        .bind(team.id, actor.email)
        .first<{ id: string }>()
    : null;
  if (pending) {
    await db.batch([
      db.prepare(BUMP),
      db
        .prepare(
          `UPDATE team_member SET status = 'joined', userId = ?, updatedAt = ?, rev = ${REV}
           WHERE id = ? AND status = 'invited'`,
        )
        .bind(actor.id, now, pending.id),
      joinedEvent(pending.id, memberGuard(pending.id, 'joined', now)),
    ]);
    return ok({ ...result, alreadyMember: false, acceptedInvite: true });
  }
  const open = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM team_member WHERE teamId = ? AND status IN ('invited', 'joined')`,
    )
    .bind(team.id)
    .first<{ n: number }>();
  if ((open?.n ?? 0) >= MAX_MEMBERS_PER_TEAM) return fail(409, 'member_limit_reached');
  const memberId = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare(BUMP),
      db
        .prepare(
          `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev)
           VALUES (?, ?, ?, ?, 'member', 'joined', NULL, ?, ?, ${REV})`,
        )
        .bind(memberId, team.id, actor.id, actor.email ?? `${actor.id}@account.invalid`, now, now),
      joinedEvent(memberId),
    ]);
  } catch {
    // Two joins at once by one person: the unique index lets one through, and they are in.
    return ok({ ...result, alreadyMember: true, acceptedInvite: false });
  }
  return ok({ ...result, alreadyMember: false, acceptedInvite: false });
}

// --- Reminders and expiry ---

export interface ReminderEmail {
  to: string;
  teamName: string;
  inviterName: string | null;
  // The app the inviter signed up through, which the reminder is counted under; null isn't counted.
  inviterApp: SettingsApp | null;
  // 1, 2 or 3.
  stage: number;
  declineToken: string;
}

// The daily sweep (liveworkspace/docs/accounts.md "Reminders and expiry"). First, invitations nobody
// answered in 28 days expire, whether or not email is set up. Then each one still waiting hears the
// latest reminder it is due (1, 7 and 21 days after its clock started), one email per invitation per
// run; a reminder it skipped is stamped 0. A failed send is tried again tomorrow, three times at most.
export async function sweepInvitations(
  db: D1Database,
  send: ((email: ReminderEmail) => Promise<void>) | null,
  now = Date.now(),
): Promise<{ expired: number; reminded: number; failed: number }> {
  const [, expiry] = await db.batch<unknown>([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = 'declined', expiredAt = ?, updatedAt = ?, rev = ${REV}
         WHERE id IN (SELECT id FROM team_member
                      WHERE status = 'invited' AND clockStartedAt <= ?
                      ORDER BY clockStartedAt, id LIMIT ?)`,
      )
      .bind(now, now, now - INVITATION_TTL_MS, EXPIRE_BATCH),
  ]);
  const expired = (expiry as { meta?: { changes?: number } })?.meta?.changes ?? 0;
  let reminded = 0;
  let failed = 0;
  if (!send) return { expired, reminded, failed };

  // Latest stage first, so an invitation that fell behind gets only the reminder it is due now.
  for (let stage = REMINDER_AGES_MS.length; stage >= 1; stage--) {
    const from = REMINDER_AGES_MS[stage - 1]!;
    const until = (REMINDER_AGES_MS as readonly number[])[stage] ?? INVITATION_TTL_MS;
    const column = `reminder${stage}SentAt`;
    const { results } = await db
      .prepare(
        `SELECT m.id, m.email, m.declineTokenHashes, t.name AS teamName, u.name AS inviterName,
                ${INVITER_APP} AS inviterApp
         FROM team_member m JOIN team t ON t.id = m.teamId LEFT JOIN "user" u ON u.id = m.invitedBy
         WHERE m.status = 'invited' AND t.deletedAt IS NULL
           AND m.clockStartedAt <= ? AND m.clockStartedAt > ?
           AND m.${column} IS NULL AND m.reminderAttempts < ?
         ORDER BY m.clockStartedAt, m.id LIMIT ?`,
      )
      .bind(now - from, now - until, MAX_REMINDER_ATTEMPTS, REMINDER_BATCH)
      .all<{
        id: string;
        email: string;
        declineTokenHashes: string;
        teamName: string;
        inviterName: string | null;
        inviterApp: string | null;
      }>();
    for (const row of results) {
      const decline = await newDeclineToken(row.id);
      try {
        await send({
          to: row.email,
          teamName: row.teamName,
          inviterName: row.inviterName,
          inviterApp: appOrNull(row.inviterApp),
          stage,
          declineToken: decline.token,
        });
      } catch {
        failed++;
        await db
          .prepare(`UPDATE team_member SET reminderAttempts = reminderAttempts + 1 WHERE id = ?`)
          .bind(row.id)
          .run();
        continue;
      }
      reminded++;
      const hashes = [...row.declineTokenHashes.split(' ').filter(Boolean), decline.hash].slice(
        -MAX_DECLINE_HASHES,
      );
      const skipped = Array.from({ length: stage - 1 }, (_, i) => `reminder${i + 1}SentAt`)
        .map((c) => `${c} = COALESCE(${c}, 0)`)
        .join(', ');
      await db
        .prepare(
          `UPDATE team_member SET ${column} = ?, reminderAttempts = 0, declineTokenHashes = ?
           ${skipped ? `, ${skipped}` : ''} WHERE id = ?`,
        )
        .bind(now, hashes.join(' '), row.id)
        .run();
    }
  }
  return { expired, reminded, failed };
}

// --- Telling the admins ---

// Who to tell when someone answers an invitation: the team's joined admins, each at their account's
// address, except anyone who turned the notice off (the `notifyInviteResponse` setting, "all" scope).
export async function inviteResponseRecipients(
  db: D1Database,
  teamId: string,
): Promise<{ email: string; name: string }[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.email, u.name FROM team_member m JOIN "user" u ON u.id = m.userId
       WHERE m.teamId = ? AND m.status = 'joined' AND m.role = 'admin' LIMIT 50`,
    )
    .bind(teamId)
    .all<{ id: string; email: string; name: string }>();
  if (!results.length) return [];
  let optedOut = new Set<string>();
  try {
    const { results: off } = await db
      .prepare(
        `SELECT owner_id FROM settings WHERE scope = 'all'
           AND json_extract(prefs, '$.notifyInviteResponse') = 0
           AND owner_id IN (${results.map(() => '?').join(', ')})`,
      )
      .bind(...results.map((r) => r.id))
      .all<{ owner_id: string }>();
    optedOut = new Set(off.map((r) => r.owner_id));
  } catch {
    // No settings table yet: nobody has turned the notice off.
  }
  return results.filter((r) => !optedOut.has(r.id)).map(({ email, name }) => ({ email, name }));
}
