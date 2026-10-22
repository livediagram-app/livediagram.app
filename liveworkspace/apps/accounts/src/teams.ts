// Teams (liveworkspace/docs/accounts.md "Teams"): made and run on liveworkspace.app, the same team in
// every app. A member row doubles as the invitation: 'invited' until the person with that verified
// address accepts ('joined') or declines ('declined'); leaving or being removed makes it 'removed'.
// Rows are never deleted, and every write takes the next rev from team_seq in the same batch, so the
// apps can follow every change through teamChanges().

// Longer names are cut to this, like account names.
export const TEAM_NAME_MAX_LENGTH = 80;
// Teams one account can be in: the access token carries them all (teamsClaim), so this bounds it.
export const MAX_TEAMS_PER_ACCOUNT = 50;
// Members and open invitations in one team.
export const MAX_MEMBERS_PER_TEAM = 200;

export type TeamRole = 'admin' | 'member';
export type MemberStatus = 'invited' | 'joined' | 'declined' | 'removed';

export interface Actor {
  id: string;
  // The account's verified address, lower-cased, or null when it isn't verified.
  email: string | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (status: number, error: string): Result<never> => ({ ok: false, status, error });

// The rev the statement after it writes: bump first, then read it back, in one batch.
const BUMP = 'UPDATE team_seq SET value = value + 1 WHERE id = 1';
const REV = '(SELECT value FROM team_seq WHERE id = 1)';

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

export interface MyTeam {
  id: string;
  name: string;
  role: TeamRole;
  memberCount: number;
}

// The teams an account has joined, by name.
export async function listMyTeams(db: D1Database, userId: string): Promise<MyTeam[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id, t.name, m.role,
              (SELECT COUNT(*) FROM team_member c WHERE c.teamId = t.id AND c.status = 'joined') AS memberCount
       FROM team t JOIN team_member m ON m.teamId = t.id
       WHERE m.userId = ? AND m.status = 'joined' AND t.deletedAt IS NULL
       ORDER BY t.name COLLATE NOCASE, t.id`,
    )
    .bind(userId)
    .all<MyTeam>();
  return results;
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
      `SELECT m.id, m.teamId, t.name AS teamName, m.role, u.name AS invitedByName, m.createdAt
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
}

export async function getMembership(
  db: D1Database,
  teamId: string,
  userId: string,
): Promise<Membership | null> {
  return db
    .prepare(
      `SELECT m.id AS memberId, m.role, t.name AS teamName FROM team_member m JOIN team t ON t.id = m.teamId
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
): Promise<Result<MyTeam>> {
  const name = cleanTeamName(rawName);
  if (!name) return fail(400, 'name_required');
  if ((await joinedTeamCount(db, actor.id)) >= MAX_TEAMS_PER_ACCOUNT) {
    return fail(409, 'team_limit_reached');
  }
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare(BUMP),
    db
      .prepare(`INSERT INTO team (id, name, createdAt, updatedAt, rev) VALUES (?, ?, ?, ?, ${REV})`)
      .bind(id, name, now, now),
    db.prepare(BUMP),
    db
      .prepare(
        `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev)
         VALUES (?, ?, ?, ?, 'admin', 'joined', NULL, ?, ?, ${REV})`,
      )
      // An account without a verified address still needs a value here; it never matches an invite.
      .bind(
        crypto.randomUUID(),
        id,
        actor.id,
        actor.email ?? `${actor.id}@account.invalid`,
        now,
        now,
      ),
  ]);
  return ok({ id, name, role: 'admin', memberCount: 1 });
}

export async function renameTeam(
  db: D1Database,
  actor: Actor,
  teamId: string,
  rawName: unknown,
  now = Date.now(),
): Promise<Result<{ id: string; name: string }>> {
  const name = cleanTeamName(rawName);
  if (!name) return fail(400, 'name_required');
  const me = await getMembership(db, teamId, actor.id);
  if (!me) return fail(404, 'not_found');
  if (me.role !== 'admin') return fail(403, 'admin_only');
  await db.batch([
    db.prepare(BUMP),
    db
      .prepare(`UPDATE team SET name = ?, updatedAt = ?, rev = ${REV} WHERE id = ?`)
      .bind(name, now, teamId),
  ]);
  return ok({ id: teamId, name });
}

// The team and every open row in it go; the apps' copies follow from the change feed.
function deleteTeamStatements(db: D1Database, teamId: string, now: number): D1PreparedStatement[] {
  return [
    db.prepare(BUMP),
    db
      .prepare(`UPDATE team SET deletedAt = ?, updatedAt = ?, rev = ${REV} WHERE id = ?`)
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
  await db.batch(deleteTeamStatements(db, teamId, now));
  return ok({ id: teamId });
}

export interface Member {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
  role: TeamRole;
  status: 'invited' | 'joined';
  createdAt: number;
}

// Joined members and open invitations, admins first.
export async function listMembers(db: D1Database, teamId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(
      `SELECT m.id, m.userId, m.email, u.name, m.role, m.status, m.createdAt
       FROM team_member m LEFT JOIN "user" u ON u.id = m.userId
       WHERE m.teamId = ? AND m.status IN ('invited', 'joined')
       ORDER BY CASE m.status WHEN 'joined' THEN 0 ELSE 1 END,
                CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, m.email`,
    )
    .bind(teamId)
    .all<Member>();
  return results;
}

export async function inviteMember(
  db: D1Database,
  actor: Actor,
  teamId: string,
  rawEmail: unknown,
  rawRole: unknown,
  now = Date.now(),
): Promise<Result<{ member: Member; teamName: string }>> {
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
  try {
    await db.batch([
      db.prepare(BUMP),
      db
        .prepare(
          `INSERT INTO team_member (id, teamId, userId, email, role, status, invitedBy, createdAt, updatedAt, rev)
           VALUES (?, ?, NULL, ?, ?, 'invited', ?, ?, ?, ${REV})`,
        )
        .bind(id, teamId, email, role, actor.id, now, now),
    ]);
  } catch {
    // Two invitations to one address at once: the unique index lets one through.
    return fail(409, 'already_invited');
  }
  return ok({
    member: { id, userId: null, email, name: null, role, status: 'invited', createdAt: now },
    teamName: me.teamName,
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
      `SELECT id, userId, role, status FROM team_member
       WHERE id = ? AND teamId = ? AND status IN ('invited', 'joined')`,
    )
    .bind(memberId, teamId)
    .first<{ id: string; userId: string | null; role: TeamRole; status: 'invited' | 'joined' }>();
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
  const target = await openMember(db, teamId, memberId);
  if (!target) return fail(404, 'not_found');
  if (target.status === 'joined' && target.role === 'admin') {
    const joined = await db
      .prepare(`SELECT COUNT(*) AS n FROM team_member WHERE teamId = ? AND status = 'joined'`)
      .bind(teamId)
      .first<{ n: number }>();
    if ((joined?.n ?? 0) <= 1) {
      await db.batch(deleteTeamStatements(db, teamId, now));
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
): Promise<Result<{ id: string; teamId: string; status: 'joined' | 'declined' }>> {
  if (!actor.email) return fail(403, 'email_unverified');
  const row = await db
    .prepare(
      `SELECT m.id, m.teamId FROM team_member m JOIN team t ON t.id = m.teamId
       WHERE m.id = ? AND m.email = ? AND m.status = 'invited' AND t.deletedAt IS NULL`,
    )
    .bind(memberId, actor.email)
    .first<{ id: string; teamId: string }>();
  if (!row) return fail(404, 'not_found');
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
      return ok({ id: memberId, teamId: row.teamId, status: 'joined' });
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
  ]);
  return ok({ id: memberId, teamId: row.teamId, status });
}

// Before an account is deleted: it leaves every team. A team it ran alone goes with it; one where it
// was the only admin passes to the longest-standing member.
export async function leaveAllTeams(
  db: D1Database,
  userId: string,
  now = Date.now(),
): Promise<void> {
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
  for (const row of results) {
    if (row.joined <= 1) {
      statements.push(...deleteTeamStatements(db, row.teamId, now));
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
}

// The change feed the apps keep their copies in step with: every team and member row written after
// the cursor, oldest first. A cursor is "rev:id" for each table, so rows that share a rev (one
// statement touching several) are never skipped at a page boundary.
export interface TeamChange {
  id: string;
  name: string;
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
        `SELECT id, name, deletedAt, createdAt, updatedAt, rev FROM team
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
    teams: teams.map(({ id, name, deletedAt, createdAt, updatedAt }) => ({
      id,
      name,
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
