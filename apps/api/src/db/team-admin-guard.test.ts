import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { removeTeamMemberKeepingAdmin, updateTeamMemberRoleKeepingAdmin } from './teams';

// docs/specs/013-workspace/teams.md "last admin": the guard holds inside the write, so two admins acting at
// once can never leave a team with no joined admin.
function team(admins: number) {
  const db = sqliteD1();
  db.sql
    .prepare('INSERT INTO teams (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
    .run('t', 'T');
  const add = db.sql.prepare(
    `INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
     VALUES (?, 't', ?, ?, 'joined', 0, 0)`,
  );
  for (let i = 0; i < admins; i++) add.run(`a${i}`, `u${i}`, 'admin');
  add.run('m', 'um', 'member');
  return db;
}
const admins = (db: ReturnType<typeof team>) =>
  (
    db.sql
      .prepare(`SELECT COUNT(*) AS n FROM team_members WHERE role = 'admin' AND status = 'joined'`)
      .get() as { n: number }
  ).n;

describe('the last-admin guard in the write', () => {
  it('lets one of two admins be demoted, then refuses the other', async () => {
    const db = team(2);
    expect(await updateTeamMemberRoleKeepingAdmin(db.env, 'a0', 'member')).toBe(true);
    expect(await updateTeamMemberRoleKeepingAdmin(db.env, 'a1', 'member')).toBe(false);
    expect(admins(db)).toBe(1);
    // Promoting is never refused.
    expect(await updateTeamMemberRoleKeepingAdmin(db.env, 'm', 'admin')).toBe(true);
  });

  it('lets one of two admins go, then refuses the last, and always lets a member go', async () => {
    const db = team(2);
    expect(await removeTeamMemberKeepingAdmin(db.env, 'a0')).toBe(true);
    expect(await removeTeamMemberKeepingAdmin(db.env, 'a1')).toBe(false);
    expect(admins(db)).toBe(1);
    expect(await removeTeamMemberKeepingAdmin(db.env, 'm')).toBe(true);
  });
});
