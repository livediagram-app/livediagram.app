import { describe, expect, it } from 'vitest';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';
import { connectInvitesByEmail } from './team-invites';
import { removeTeamMemberKeepingAdmin } from './teams';

// One membership row per person per team (docs/specs/013-workspace/teams.md "Members"): the lazy
// invite claim skips teams the user already belongs to, the database refuses a second row, removal
// takes every row the user holds, and migration 0083 folds existing duplicates into one.

type Row = { id: string; team: string; user: string | null; email?: string | null };
type Extra = { role?: string; status?: string; created?: number };

function seed(db: ReturnType<typeof sqliteD1>, rows: (Row & Extra)[]) {
  db.sql.exec("INSERT INTO teams (id, name, created_at, updated_at) VALUES ('t', 'T', 0, 0)");
  db.sql.exec("INSERT INTO teams (id, name, created_at, updated_at) VALUES ('t2', 'T2', 0, 0)");
  const add = db.sql.prepare(
    `INSERT INTO team_members (id, team_id, user_id, email, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
  );
  for (const r of rows) {
    add.run(
      r.id,
      r.team,
      r.user,
      r.email ?? null,
      r.role ?? 'member',
      r.status ?? (r.user ? 'joined' : 'invited'),
      r.created ?? 0,
    );
  }
}

const rowsFor = (db: ReturnType<typeof sqliteD1>, user: string) =>
  db.sql
    .prepare('SELECT id, team_id, role, status FROM team_members WHERE user_id = ? ORDER BY id')
    .all(user)
    .map((r) => ({ ...r }));

describe('the invite claim', () => {
  it('skips a team the user already joined, and claims the rest', async () => {
    const db = sqliteD1();
    seed(db, [
      { id: 'joined', team: 't', user: 'u', email: null },
      { id: 'late-invite', team: 't', user: null, email: 'u@x.io' },
      { id: 'other-invite', team: 't2', user: null, email: 'u@x.io' },
    ]);
    await connectInvitesByEmail(db.env, 'u', 'u@x.io');
    expect(rowsFor(db, 'u').map((r) => r.id)).toEqual(['joined', 'other-invite']);
  });
});

describe('the unique (team_id, user_id) index', () => {
  it('refuses a second row for the same user, but not two pending invites', () => {
    const db = sqliteD1();
    seed(db, [
      { id: 'a', team: 't', user: 'u' },
      { id: 'p1', team: 't', user: null, email: 'p1@x.io' },
      { id: 'p2', team: 't', user: null, email: 'p2@x.io' },
    ]);
    expect(() =>
      db.sql.exec(
        `INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
         VALUES ('b', 't', 'u', 'member', 'joined', 0, 0)`,
      ),
    ).toThrow(/UNIQUE/);
  });
});

describe('removal', () => {
  it('takes every row the user holds in that team, and none elsewhere', async () => {
    const db = sqliteD1({}, { before: '0083' });
    seed(db, [
      { id: 'admin', team: 't', user: 'boss', role: 'admin' },
      { id: 'one', team: 't', user: 'u' },
      { id: 'two', team: 't', user: 'u', status: 'invited' },
      { id: 'elsewhere', team: 't2', user: 'u' },
    ]);
    expect(
      await removeTeamMemberKeepingAdmin(db.env, { id: 'one', teamId: 't', userId: 'u' }),
    ).toBe(true);
    expect(rowsFor(db, 'u').map((r) => r.id)).toEqual(['elsewhere']);
  });

  it('never counts a second row of the same person as another admin', async () => {
    const db = sqliteD1({}, { before: '0083' });
    seed(db, [
      { id: 'one', team: 't', user: 'u', role: 'admin' },
      { id: 'two', team: 't', user: 'u', role: 'admin' },
      { id: 'm', team: 't', user: 'm' },
    ]);
    expect(
      await removeTeamMemberKeepingAdmin(db.env, { id: 'one', teamId: 't', userId: 'u' }),
    ).toBe(false);
    expect(rowsFor(db, 'u')).toHaveLength(2);
  });
});

describe('migration 0083', () => {
  it('keeps the joined (then oldest) row of each duplicate set, with its admin role', () => {
    const db = sqliteD1({}, { before: '0083' });
    seed(db, [
      { id: 'invited-old', team: 't', user: 'u', status: 'invited', created: 1 },
      { id: 'joined-new', team: 't', user: 'u', status: 'joined', created: 5 },
      { id: 'joined-newer', team: 't', user: 'u', status: 'joined', role: 'admin', created: 9 },
      { id: 'single', team: 't2', user: 'u', created: 3 },
      { id: 'pending', team: 't', user: null, email: 'p@x.io' },
    ]);
    applyMigration(db.sql, '0083');
    expect(rowsFor(db, 'u')).toEqual([
      { id: 'joined-new', team_id: 't', role: 'admin', status: 'joined' },
      { id: 'single', team_id: 't2', role: 'member', status: 'joined' },
    ]);
    expect(db.sql.prepare("SELECT 1 FROM team_members WHERE id = 'pending'").get()).toBeDefined();
  });
});
