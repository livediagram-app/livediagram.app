import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { automaticPresenceColour } from '@liveworkspace/settings/presence';
import type { ItemsImportPeople } from '@liveplanner/api-schema';
import { TRACKER_EMAIL_MAX, TRACKER_MATCH_EMAILS_MAX, itemPersonId } from '@liveplanner/items';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { makeTestRouteContext } from './test-route-context';
import { handleProjects } from './projects';

// docs/specs/026-plan/tracker-import.md "Agents": an agent's import matches the file's people to the plan's team by
// email on the server, only for a joined member of that team; nobody else learns who is in it, and no email is ever
// answered.

const team = vi.hoisted(() => ({ people: null as TeamPerson[] | null, asked: [] as string[] }));
vi.mock('../person/notify', async (load) => ({
  ...(await load<typeof import('../person/notify')>()),
  teamPeople: async (_env: unknown, teamId: string) => {
    team.asked.push(teamId);
    return team.people;
  },
}));

const person = (over: Partial<TeamPerson>): TeamPerson => ({
  id: `m-${over.userId ?? over.email}`,
  userId: null,
  email: '',
  name: null,
  role: 'member',
  status: 'joined',
  ...over,
});

let sql: SqliteD1;

type Caller = { owner: string; teams?: string[]; code?: string; token?: boolean };
const MEMBER: Caller = { owner: 'user_ana', teams: ['team1'], token: true };
// In the team by the token's claim (so it may edit), but accounts no longer list them joined: they left.
const LEFT: Caller = { owner: 'user_left', teams: ['team1'], token: true };
// Outside the team, editing through the plan's Editor share link.
const LINK_EDITOR: Caller = { owner: 'user_eve', code: 'EDIT', token: true };

async function match(who: Caller, body: unknown, plan = 'd1') {
  // A tab's link names its tab, as its caller does.
  const query = who.code === 'TAB1' ? '?tabId=t1' : '';
  const ctx = makeTestRouteContext('POST', `/api/projects/${plan}/items/import/people${query}`, {
    env: sql.env,
    owner: who.owner,
    teams: (who.teams ?? []).map((id) => ({ id, name: id, role: 'member' as const })),
    ...(who.code ? { headers: { 'X-Share-Code': who.code } } : {}),
    ...(who.token ? { token: { id: 'tok_1' } } : {}),
    body,
  });
  const res = await handleProjects(ctx);
  const text = await res.text();
  return { status: res.status, text, body: (text ? JSON.parse(text) : null) as ItemsImportPeople };
}

const EMAILS = ['Ana@Example.com', 'ben@example.com', 'stranger@example.com', 'inv@example.com'];

beforeEach(() => {
  sql = sqliteD1();
  team.asked = [];
  team.people = [
    person({ userId: 'user_ana', email: 'ana@example.com', name: 'Ana Lopez' }),
    person({ userId: 'user_ben', email: 'Ben@Example.com', name: null }),
    person({ userId: 'user_left', email: 'left@example.com', status: 'invited' }),
    person({ email: 'inv@example.com', status: 'invited' }),
  ];
  sql.sql.exec(`
    INSERT INTO test_plans (id, owner_id, name, team_id, shareable, saved_at, created_at)
      VALUES ('d1', 'user_ana', 'Plan', 'team1', 1, 1, 1);
    INSERT INTO test_plans (id, owner_id, name, team_id, shareable, saved_at, created_at)
      VALUES ('mine', 'user_ana', 'Mine', NULL, 1, 1, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('EDIT', 'd1', 'edit', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('VIEW', 'd1', 'view', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, level, tab_id, created_at)
      VALUES ('PART', 'd1', 'view', 'participate', NULL, 1);
    INSERT INTO test_share_links (code, project_id, role, tab_id, created_at) VALUES ('TAB1', 'd1', 'edit', 't1', 1);
    INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 'Board', '{"elements":[]}', 1);
    INSERT INTO plan_tabs (plan_id, tab_id, order_index, added_at) VALUES ('d1', 't1', 0, 1);
  `);
});

describe('POST /items/import/people', () => {
  it('answers a team member the joined members each email belongs to, and never an email', async () => {
    const res = await match(MEMBER, { emails: EMAILS });
    expect(res.status).toBe(200);
    expect(res.body.people).toEqual([
      {
        id: await itemPersonId('user_ana'),
        name: 'Ana Lopez',
        color: automaticPresenceColour('Ana Lopez').value,
      },
      // No name: the address's local part, as the editor names them.
      {
        id: await itemPersonId('user_ben'),
        name: 'Ben',
        color: automaticPresenceColour('Ben').value,
      },
      null,
      // An invitation is no one's yet.
      null,
    ]);
    expect(res.text).not.toContain('@');
    expect(team.asked).toEqual(['team1']);
  });

  it('answers a share link’s Editor no match for every email, so it can’t learn who is in the team', async () => {
    const res = await match(LINK_EDITOR, { emails: EMAILS });
    expect(res.status).toBe(200);
    expect(res.body.people).toEqual([null, null, null, null]);
    expect(res.text).not.toContain('@');
  });

  it('answers someone who left the team (their token still claiming it) no match', async () => {
    const res = await match(LEFT, { emails: EMAILS });
    expect(res.status).toBe(200);
    expect(res.body.people).toEqual([null, null, null, null]);
  });

  it('answers no match on a plan in no team, or a team accounts can’t read', async () => {
    expect((await match(MEMBER, { emails: EMAILS }, 'mine')).body.people).toEqual([
      null,
      null,
      null,
      null,
    ]);
    team.people = null;
    expect((await match(MEMBER, { emails: EMAILS })).body.people).toEqual([null, null, null, null]);
  });

  it('is an Editor’s on the whole plan: a Viewer, a Participant and a tab’s Editor are refused', async () => {
    for (const code of ['VIEW', 'PART', 'TAB1'])
      expect(
        (await match({ owner: 'user_eve', code, token: true }, { emails: EMAILS })).status,
      ).toBe(403);
    expect(team.asked).toEqual([]);
  });

  it('refuses a body that is not 1 to 1,000 short strings', async () => {
    const tooMany = Array.from({ length: TRACKER_MATCH_EMAILS_MAX + 1 }, (_, i) => `p${i}@x.io`);
    for (const emails of [
      undefined,
      [],
      'ana@example.com',
      [1],
      tooMany,
      [`${'a'.repeat(TRACKER_EMAIL_MAX)}@x.io`],
    ])
      expect((await match(MEMBER, { emails })).status).toBe(400);
    expect((await match(MEMBER, null)).status).toBe(400);
    expect(team.asked).toEqual([]);
  });

  it('takes only POST', async () => {
    const ctx = makeTestRouteContext('GET', '/api/projects/d1/items/import/people', {
      env: sql.env,
      owner: MEMBER.owner,
    });
    expect((await handleProjects(ctx)).status).toBe(405);
  });
});
