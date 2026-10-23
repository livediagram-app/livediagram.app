// The newest projects of the teams a person has joined, beside their personal library
// (docs/specs/019-marketing/returning-visitor.md), against the real migrations.

import type { Tab } from '@liveplanner/project';
import type { ProjectListResponse } from '@liveplanner/api-schema';
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { handleProjects } from '../routes/projects';
import { makeTestRouteContext } from '../routes/test-route-context';
import { seedTabs } from './tabs';
import { TEAM_RECENT_SQL, listRecentTeamProjects } from './team-recent';

const ME = 'user_me';
const rect = { id: 'r', kind: 'shape', shape: 'rectangle', x: 0, y: 0, width: 1, height: 1 };
const tab = (id: string, elements: unknown[]): Tab =>
  ({ id, name: id, elements }) as unknown as Tab;

function setUp() {
  const db = sqliteD1();
  const team = (id: string, name: string) =>
    db.sql
      .prepare('INSERT INTO teams (id, name, created_at, updated_at) VALUES (?, ?, 0, 0)')
      .run(id, name);
  const member = (teamId: string, userId: string, status: 'joined' | 'invited') =>
    db.sql
      .prepare(
        `INSERT INTO team_members (id, team_id, user_id, role, status, created_at, updated_at)
         VALUES (?, ?, ?, 'member', ?, 0, 0)`,
      )
      .run(`${teamId}:${userId}`, teamId, userId, status);
  const doc = async (
    id: string,
    savedAt: number,
    opts: { teamId?: string; owner?: string; trashed?: boolean; empty?: boolean } = {},
  ) => {
    db.sql
      .prepare(
        `INSERT INTO projects (id, owner_id, name, shareable, team_id, saved_at, created_at, trashed_at)
         VALUES (?, ?, ?, 0, ?, ?, 0, ?)`,
      )
      .run(
        id,
        opts.owner ?? 'someone',
        `Doc ${id}`,
        opts.teamId ?? null,
        savedAt,
        opts.trashed ? 1 : null,
      );
    await seedTabs(db.env, id, [tab(`t-${id}`, opts.empty ? [] : [rect])]);
    // Seeding counts as a save; set the one each test means, on the plan too (its push carries it to D1).
    db.sql.prepare('UPDATE plan SET saved_at = ? WHERE id = ?').run(savedAt, id);
    db.sql.prepare('UPDATE projects SET saved_at = ? WHERE id = ?').run(savedAt, id);
  };
  return { ...db, team, member, doc };
}

describe('listRecentTeamProjects', () => {
  it('lists the joined teams’ projects, newest first, with their team', async () => {
    const { env, team, member, doc } = setUp();
    team('t1', 'Design');
    team('t2', 'Ops');
    member('t1', ME, 'joined');
    member('t2', ME, 'joined');
    await doc('a', 1, { teamId: 't1' });
    await doc('b', 3, { teamId: 't2' });
    await doc('c', 2, { teamId: 't1', owner: ME });
    const list = await listRecentTeamProjects(env, ME, 12);
    expect(list.map((d) => [d.id, d.teamName, d.teamId])).toEqual([
      ['b', 'Ops', 't2'],
      ['c', 'Design', 't1'],
      ['a', 'Design', 't1'],
    ]);
    expect(list.every((d) => !d.empty)).toBe(true);
  });

  it('leaves out an invited team, another team, the Trash, empty projects and personal ones', async () => {
    const { env, team, member, doc } = setUp();
    team('joined', 'Joined');
    team('invited', 'Invited');
    team('other', 'Other');
    member('joined', ME, 'joined');
    member('invited', ME, 'invited');
    member('other', 'user_else', 'joined');
    await doc('kept', 1, { teamId: 'joined' });
    await doc('invite-only', 2, { teamId: 'invited' });
    await doc('not-mine', 3, { teamId: 'other' });
    await doc('trashed', 4, { teamId: 'joined', trashed: true });
    await doc('blank', 5, { teamId: 'joined', empty: true });
    await doc('personal', 6, { owner: ME });
    expect((await listRecentTeamProjects(env, ME, 12)).map((d) => d.id)).toEqual(['kept']);
  });

  it('stops at the limit, keeping the newest', async () => {
    const { env, team, member, doc } = setUp();
    team('t1', 'Design');
    member('t1', ME, 'joined');
    for (let i = 0; i < 5; i++) await doc(`d${i}`, i, { teamId: 't1' });
    expect((await listRecentTeamProjects(env, ME, 2)).map((d) => d.id)).toEqual(['d4', 'd3']);
  });

  it('starts from the person’s memberships, never a walk of every project', () => {
    const { sql } = sqliteD1();
    const plan = sql
      .prepare(`EXPLAIN QUERY PLAN ${TEAM_RECENT_SQL}`)
      .all(ME, 12)
      .map((row) => String(row['detail']));
    expect(plan.some((d) => /team_members_user_idx|team_members_team_user/.test(d))).toBe(true);
    expect(plan.some((d) => /^SEARCH d USING INDEX projects_team_idx/.test(d))).toBe(true);
    expect(plan.filter((d) => /^SCAN (d|projects)\b/.test(d))).toEqual([]);
  });

  it('stays fast for a large team library', async () => {
    const { env, sql, team, member } = setUp();
    team('big', 'Big');
    member('big', ME, 'joined');
    const insertDoc = sql.prepare(
      `INSERT INTO projects (id, owner_id, name, shareable, team_id, saved_at, created_at)
       VALUES (?, 'someone', ?, 0, 'big', ?, 0)`,
    );
    const insertTab = sql.prepare(
      `INSERT INTO tabs (id, name, data, updated_at, element_count) VALUES (?, 't', '{}', 0, 1)`,
    );
    const link = sql.prepare(
      `INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES (?, ?, 0, 0)`,
    );
    for (let i = 0; i < 5000; i++) {
      insertDoc.run(`d${i}`, `Doc ${i}`, i);
      insertTab.run(`t${i}`);
      link.run(`d${i}`, `t${i}`);
    }
    // The plans' pushes land first (test-sqlite-d1.ts): the read alone is timed.
    await env.DB.prepare('SELECT 1').first();
    const t = performance.now();
    const list = await listRecentTeamProjects(env, ME, 12);
    const ms = performance.now() - t;
    expect(list[0]?.id).toBe('d4999');
    expect(list).toHaveLength(12);
    expect(ms).toBeLessThan(500);
  });
});

describe('GET /api/projects?include=team-recent', () => {
  async function list(
    env: ReturnType<typeof sqliteD1>['env'],
    path: string,
    who: { owner: string; verifiedUserId: string | null },
  ): Promise<ProjectListResponse> {
    const res = await handleProjects(makeTestRouteContext('GET', path, { env, ...who }));
    expect(res.status).toBe(200);
    return (await res.json()) as ProjectListResponse;
  }

  it('adds the team projects beside the personal library, only when asked', async () => {
    const { env, team, member, doc } = setUp();
    team('t1', 'Design');
    member('t1', ME, 'joined');
    await doc('mine', 1, { owner: ME });
    await doc('team', 2, { teamId: 't1' });
    const me = { owner: ME, verifiedUserId: ME };

    const asked = await list(env, '/api/projects?include=team-recent', me);
    expect(asked.projects.map((d) => d.id)).toEqual(['mine']);
    expect(asked.teamRecent?.map((d) => [d.id, d.teamName])).toEqual([['team', 'Design']]);

    const plain = await list(env, '/api/projects', me);
    expect(plain).not.toHaveProperty('teamRecent');
  });

  it('reads membership from the verified account, never the guest header', async () => {
    const { env, team, member, doc } = setUp();
    team('t1', 'Design');
    member('t1', ME, 'joined');
    await doc('team', 2, { teamId: 't1' });
    // A guest whose X-Owner-Id names a member's account id: no team projects.
    const spoofed = await list(env, '/api/projects?include=team-recent', {
      owner: ME,
      verifiedUserId: null,
    });
    expect(spoofed.teamRecent).toEqual([]);
  });
});
