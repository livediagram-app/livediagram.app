import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { handleTeams } from './teams';
import { makeTestRouteContext } from './test-route-context';

// A team's people (docs/specs/013-workspace/teams.md), for the assignee picker and @-mention list: only for someone in
// the team, by their token's claim or, for a team made or joined since the token was minted, by accounts
// (@liveworkspace/index-app createTeamAccess). Never for an API token.

let db: SqliteD1;
let accounts: FakeAccounts;

const person = (userId: string | null, status: TeamPerson['status'] = 'joined'): TeamPerson => ({
  id: `m-${userId ?? 'inv'}`,
  userId,
  email: `${userId ?? 'inv'}@x.test`,
  name: userId ? userId.slice(5) : null,
  role: 'member',
  status,
});

beforeEach(() => {
  db = sqliteD1(ACCOUNTS_ON);
  accounts = stubAccounts();
  accounts.teams.set('team_1', [person('user_ada'), person('user_bob'), person(null, 'invited')]);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const members = (opts: { user?: string; claim?: boolean; token?: boolean; team?: string } = {}) =>
  handleTeams(
    makeTestRouteContext('GET', `/api/teams/${opts.team ?? 'team_1'}/members`, {
      env: db.env,
      owner: opts.user ?? 'user_ada',
      accountUserId: opts.user ?? 'user_ada',
      teams: opts.claim === false ? [] : [{ id: 'team_1', name: 'Team', role: 'member' }],
      ...(opts.token ? { token: { id: 'tok_1' } } : {}),
    }),
  );

describe('GET /api/teams/:id/members', () => {
  it('lists the joined and invited people for someone whose token names the team', async () => {
    const res = await members();
    expect(res.status).toBe(200);
    const { members: people } = (await res.json()) as {
      members: { userId: string | null; status: string }[];
    };
    expect(people.map((p) => [p.userId, p.status])).toEqual([
      ['user_ada', 'joined'],
      ['user_bob', 'joined'],
      [null, 'invited'],
    ]);
  });

  it('answers a team joined since the token was minted, asking accounts', async () => {
    const res = await members({ user: 'user_bob', claim: false });
    expect(res.status).toBe(200);
    expect(accounts.calls.map((c) => c.path)).toContain('/teams/of');
  });

  it('answers a team the caller is not in, or an API token, as missing', async () => {
    expect((await members({ user: 'user_cy', claim: false })).status).toBe(404);
    expect((await members({ token: true })).status).toBe(404);
    expect((await members({ team: 'team_2', claim: false })).status).toBe(404);
  });
});
