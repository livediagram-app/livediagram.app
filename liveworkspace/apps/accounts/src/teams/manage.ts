// Making, renaming and deleting a team (teams.ts).

import {
  type Actor,
  BUMP,
  cleanOrganisation,
  cleanTeamName,
  fail,
  MAX_TEAMS_PER_ACCOUNT,
  ok,
  type Result,
  REV,
  teamEvent,
} from './shared.ts';
import { getMembership, JOINED_TEAMS, joinedTeamCount, type MyTeam } from './reads.ts';

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
  // The cap again inside the insert, so creates racing past the count above can't together pass it; the admin row
  // follows only a team that was made.
  const [, made] = await db.batch([
    db.prepare(BUMP),
    db
      .prepare(
        `INSERT INTO team (id, name, organisation, createdAt, updatedAt, rev)
         SELECT ?, ?, ?, ?, ?, ${REV} WHERE ${JOINED_TEAMS} < ?`,
      )
      .bind(id, name, organisation, now, now, actor.id, MAX_TEAMS_PER_ACCOUNT),
    db.prepare(BUMP),
    db
      .prepare(
        `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev)
         SELECT ?, ?, ?, ?, 'admin', 'joined', NULL, ?, ?, ${REV} WHERE EXISTS (SELECT 1 FROM team WHERE id = ?)`,
      )
      .bind(memberId, id, actor.id, memberEmail, now, now, id),
  ]);
  if (!made?.meta.changes) return fail(409, 'team_limit_reached');
  return ok({
    id,
    name,
    organisation,
    role: 'admin',
    memberCount: 1,
    invitedCount: 0,
    members: [{ id: memberId, name: null, email: memberEmail, role: 'admin', picture: null }],
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
            detail: { from: me.teamName },
          }),
        ]
      : []),
  ]);
  return ok({ id: teamId, name, organisation });
}

// The team and every open row in it go; the apps' copies follow from the change feed. Also a team closing with the
// account that ran it alone.
export function deleteTeamRows(db: D1Database, teamId: string, now: number): D1PreparedStatement[] {
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
  // Nothing goes to the audit log: the team is gone, so nobody can read it.
  await db.batch(deleteTeamRows(db, teamId, now));
  return ok({ id: teamId });
}
