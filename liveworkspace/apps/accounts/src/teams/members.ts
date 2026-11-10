// A team's members (teams.ts): inviting, roles, removing, answering an invitation and leaving every team.

import type { SettingsApp } from '../settings.ts';
import { teamScopes } from '../index-timeline.ts';
import {
  type Actor,
  appOrNull,
  BUMP,
  cleanEmail,
  fail,
  INVITATION_TTL_MS,
  INVITER_APP,
  isUniqueClash,
  MAX_MEMBERS_PER_TEAM,
  MAX_TEAMS_PER_ACCOUNT,
  memberGuard,
  ok,
  type Result,
  REV,
  teamEvent,
  type TeamRole,
} from './shared.ts';
import {
  getMembership,
  JOINED_TEAMS,
  joinedTeamCount,
  type Member,
  OPEN_MEMBERS,
  UNEXPIRED,
} from './reads.ts';
import { newDeclineToken } from './tokens.ts';
import { deleteTeamRows, deleteTeamStatements } from './manage.ts';
import { ANONYMISED_PERSON } from '@liveworkspace/index-client';

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
  let written: D1Result[] = [];
  try {
    written = await db.batch([
      // An address that turned an earlier invitation down is invited afresh: the old answer leaves
      // the list as the new invitation takes its place. Both under the member cap, again inside the write.
      db.prepare(BUMP),
      db
        .prepare(
          `UPDATE team_member SET status = 'removed', updatedAt = ?, rev = ${REV}
           WHERE teamId = ? AND email = ? AND status = 'declined' AND ${OPEN_MEMBERS} < ?`,
        )
        .bind(now, teamId, email, teamId, MAX_MEMBERS_PER_TEAM),
      db.prepare(BUMP),
      db
        .prepare(
          `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev,
                                    declineTokenHashes, clockStartedAt)
           SELECT ?, ?, NULL, ?, ?, 'invited', ?, ?, ?, ${REV}, ?, ? WHERE ${OPEN_MEMBERS} < ?`,
        )
        .bind(
          id,
          teamId,
          email,
          role,
          actor.id,
          now,
          now,
          decline.hash,
          now,
          teamId,
          MAX_MEMBERS_PER_TEAM,
        ),
      teamEvent(
        db,
        {
          id: `team_invite_sent:${id}`,
          type: 'team_invite_sent',
          teamId,
          teamName: me.teamName,
          actor,
          at: now,
          scopes: teamScopes(teamId, [invitee?.id]),
          detail: { memberName: email, personId: invitee?.id ?? null, role },
        },
        { sql: 'EXISTS (SELECT 1 FROM team_member WHERE id = ?)', args: [id] },
      ),
    ]);
  } catch (err) {
    // Two invitations to one address at once: the unique index lets one through.
    if (isUniqueClash(err)) return fail(409, 'already_invited');
    throw err;
  }
  // Refused at the member cap, inside the write.
  if (!written[3]?.meta.changes) return fail(409, 'member_limit_reached');
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
      picture: null,
    },
    teamName: me.teamName,
    declineToken: decline.token,
  });
}

// Appended to a member row's UPDATE: it never takes the team's last joined admin, so two admins demoting or removing
// each other at once can't both pass the count read before it and leave the team with none. ?1 is the team id.
const KEEPS_AN_ADMIN = `AND NOT (role = 'admin' AND status = 'joined' AND
  (SELECT COUNT(*) FROM team_member WHERE teamId = ?1 AND status = 'joined' AND role = 'admin') <= 1)`;

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
  const [, updated] = await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET role = ?2, updatedAt = ?3, rev = ${REV} WHERE id = ?4
         ${rawRole === 'member' ? KEEPS_AN_ADMIN : ''}`,
      )
      .bind(teamId, rawRole, now, memberId),
    teamEvent(
      db,
      {
        id: `team_role_changed:${memberId}:${now}`,
        type: 'team_role_changed',
        teamId,
        teamName: me.teamName,
        actor,
        at: now,
        scopes: teamScopes(teamId, [target.userId]),
        detail: { personId: target.userId, memberName: target.memberName, role: rawRole },
      },
      {
        sql: 'EXISTS (SELECT 1 FROM team_member WHERE id = ? AND role = ? AND updatedAt = ?)',
        args: [memberId, rawRole, now],
      },
    ),
  ]);
  if ((updated?.meta?.changes ?? 0) === 0) return fail(409, 'last_admin');
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
): Promise<Result<{ id: string; teamDeleted: boolean; removed: 'self' | 'invite' | 'member' }>> {
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  const self = me.memberId === memberId;
  if (!self && me.role !== 'admin') return fail(403, 'admin_only');
  const target =
    (await openMember(db, teamId, memberId)) ?? (await declinedMember(db, teamId, memberId));
  if (!target) return fail(404, 'not_found');
  // Who went: the person themselves leaving, an invitation withdrawn, or a member removed.
  const removed = self ? 'self' : target.status === 'joined' ? 'member' : 'invite';
  if (target.status === 'joined' && target.role === 'admin') {
    const joined = await db
      .prepare(`SELECT COUNT(*) AS n FROM team_member WHERE teamId = ? AND status = 'joined'`)
      .bind(teamId)
      .first<{ n: number }>();
    if ((joined?.n ?? 0) <= 1) {
      await db.batch(await deleteTeamStatements(db, actor, teamId, me.teamName, now));
      return ok({ id: memberId, teamDeleted: true, removed });
    }
    if ((await adminCount(db, teamId)) <= 1) return fail(409, 'last_admin');
  }
  const [, updated] = await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET status = 'removed', updatedAt = ?2, rev = ${REV} WHERE id = ?3
         ${KEEPS_AN_ADMIN}`,
      )
      .bind(teamId, now, memberId),
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
  if ((updated?.meta?.changes ?? 0) === 0) return fail(409, 'last_admin');
  return ok({ id: memberId, teamDeleted: false, removed });
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
    // Whether this request answered it: false for a repeat (a double click, a second tab) and for an invitation to
    // a team the account is already in, so the admins hear of an answer once and only of a real one.
    answered: boolean;
  }>
> {
  if (!actor.email) return fail(403, 'email_unverified');
  const row = await db
    .prepare(
      `SELECT m.id, m.teamId, t.name AS teamName, ${INVITER_APP} AS inviterApp
       FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.id = ? AND m.email = ? AND m.status = 'invited' AND t.deletedAt IS NULL AND ${UNEXPIRED}`,
    )
    .bind(memberId, actor.email, now - INVITATION_TTL_MS)
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
        answered: false,
      });
    }
  }
  const status: 'joined' | 'declined' = accept ? 'joined' : 'declined';
  const [, updated] = await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member AS m SET status = ?, userId = ?, updatedAt = ?, rev = ${REV}
         WHERE id = ? AND status = 'invited' AND ${UNEXPIRED} AND (? = 0 OR ${JOINED_TEAMS} < ?)`,
      )
      .bind(
        status,
        accept ? actor.id : null,
        now,
        memberId,
        now - INVITATION_TTL_MS,
        accept ? 1 : 0,
        actor.id,
        MAX_TEAMS_PER_ACCOUNT,
      ),
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
  const answer = { id: memberId, teamId: row.teamId, teamName: row.teamName, status, inviterApp };
  if ((updated?.meta?.changes ?? 0) > 0) return ok({ ...answer, answered: true });
  // Not `invited` any more since it was read: the same answer already given by this account stands; anything else
  // (withdrawn, expired, cleared) is gone.
  const after = await db
    .prepare('SELECT status, userId FROM team_member WHERE id = ?')
    .bind(memberId)
    .first<{ status: string; userId: string | null }>();
  return after?.status === status && (!accept || after.userId === actor.id)
    ? ok({ ...answer, answered: false })
    : fail(404, 'not_found');
}

// What a closed account's team rows say in place of its address (as the apps say it in place of its name).
export const DELETED_MEMBER_EMAIL = 'Deleted account';

// Before an account is deleted: it leaves every team. A team it ran alone goes with it; one where it
// was the only admin passes to the longest-standing member. Then its address comes off every team row
// it had (those it joined, was removed from or left, and invitations to it it turned down), each row
// moved on in the change feed so the apps' copies lose it too. An invitation still waiting is the
// inviter's, to an address rather than to the account, and stays. Every row it invited names
// ANONYMISED_PERSON as its inviter (invitedBy has no foreign key; the change feed doesn't carry it).
// Answers the teams that closed with the account (those it ran alone).
export async function leaveAllTeams(
  db: D1Database,
  userId: string,
  now = Date.now(),
  // Statements for the same batch, given the teams that close (the account deletion's purge record), so what
  // closed is written down with the closing itself: a retry after a later step failed finds those teams gone.
  alongside: (closed: string[]) => D1PreparedStatement[] = () => [],
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
  const user = await db
    .prepare('SELECT email FROM "user" WHERE id = ?')
    .bind(userId)
    .first<{ email: string }>();
  statements.push(
    db.prepare(BUMP),
    db
      .prepare(
        `UPDATE team_member SET email = ?, updatedAt = ?, rev = ${REV}
         WHERE (userId = ? OR (email = ? AND status IN ('declined', 'removed')))
           AND email != ?`,
      )
      .bind(
        DELETED_MEMBER_EMAIL,
        now,
        userId,
        user?.email.toLowerCase() ?? '',
        DELETED_MEMBER_EMAIL,
      ),
    db
      .prepare('UPDATE team_member SET invitedBy = ? WHERE invitedBy = ?')
      .bind(ANONYMISED_PERSON, userId),
  );
  await db.batch([...statements, ...alongside(closed)]);
  return closed;
}
