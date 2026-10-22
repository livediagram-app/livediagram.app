import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { acceptTeamMember } from './team-invites';

// docs/specs/013-workspace/teams.md: the accept flip is guarded in the write, so of two concurrent accepts of
// one invite exactly one reports the flip (and only that one notifies the admins).
describe('acceptTeamMember', () => {
  it('flips an invited row once, then reports nothing to flip', async () => {
    const db = sqliteD1();
    db.sql
      .prepare('INSERT INTO teams (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
      .run('t', 'T');
    db.sql
      .prepare(
        `INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
         VALUES ('m', 't', 'u', 'member', 'invited', 0, 0)`,
      )
      .run();
    const [a, b] = await Promise.all([
      acceptTeamMember(db.env, 'm'),
      acceptTeamMember(db.env, 'm'),
    ]);
    expect([a, b].sort()).toEqual([false, true]);
    const row = db.sql.prepare(`SELECT status FROM team_members WHERE id = 'm'`).get() as {
      status: string;
    };
    expect(row.status).toBe('joined');
  });
});
