import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamPerson } from '@liveworkspace/auth-client';
import { accountsServiceFor } from '../test-accounts-service';
import type { Env } from '../types';
import { handleTeams } from './teams';
import { makeTestRouteContext } from './test-route-context';

// The caller's teams (from its token: liveworkspace manages them), a team's library for API clients
// (index-adapters.ts), and a team's people (docs/specs/013-workspace/teams.md), for the assignee picker and
// @-mention list: only for someone in the team, by their token's claim or, for a team made or joined since the token
// was minted, by accounts (@liveworkspace/index-app createTeamAccess). Making a team is team-create.test.ts; the
// notify routes are team-notify-routes.test.ts.

const INDEX_ORIGIN = 'https://index.test';
const TEAM = { id: 'team_1', name: 'Crew', role: 'member' as const };

let env: Env;
// Each team's people as accounts holds them, and the teams each account is in now.
let people: Map<string, TeamPerson[]>;
let teamsOf: Map<string, { id: string; name: string; role: 'admin' | 'member' }[]>;
let accountsCalls: string[];
// What the index answers, by `METHOD /path`, and every call it heard.
let index: Record<string, () => Response>;
let indexCalls: { method: string; path: string; search: URLSearchParams }[];

const person = (userId: string | null, status: TeamPerson['status'] = 'joined'): TeamPerson => ({
  id: `m-${userId ?? 'inv'}`,
  userId,
  email: `${userId ?? 'inv'}@x.test`,
  name: userId ? userId.slice(5) : null,
  role: 'member',
  status,
});

beforeEach(() => {
  env = { INDEX_ORIGIN, INDEX_KEY: 'k' } as Env;
  accountsServiceFor(env);
  people = new Map([['team_1', [person('user_ada'), person('user_bob'), person(null, 'invited')]]]);
  teamsOf = new Map();
  accountsCalls = [];
  index = {};
  indexCalls = [];
  const accounts = globalThis.fetch;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const url = new URL(req.url);
    if (url.origin === INDEX_ORIGIN) {
      const path = url.pathname.replace('/api/index', '');
      indexCalls.push({ method: req.method, path, search: url.searchParams });
      const answer = index[`${req.method} ${path}`];
      return answer ? answer() : Response.json({ error: 'not_found' }, { status: 404 });
    }
    const route = url.pathname.replace('/api/account/internal', '');
    if (route === '/teams/members' || route === '/teams/of') {
      accountsCalls.push(route);
      const body = (await req.json()) as { teamId?: string; userId?: string };
      if (route === '/teams/of') return Response.json({ teams: teamsOf.get(body.userId!) ?? [] });
      const members = people.get(body.teamId!);
      return members
        ? Response.json({ team: { id: body.teamId, name: 'Crew' }, members })
        : Response.json({ error: 'not_found' }, { status: 404 });
    }
    return accounts(input, init);
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const call = (
  method: string,
  path: string,
  opts: { user?: string | null; claim?: boolean; token?: boolean } = {},
) => {
  const user = opts.user === undefined ? 'user_ada' : opts.user;
  return handleTeams(
    makeTestRouteContext(method, path, {
      env,
      owner: user,
      accountUserId: opts.token ? null : user,
      verifiedUserId: user,
      teams: opts.claim === false ? [] : [TEAM],
      ...(opts.token ? { token: { id: 'tok_1' } } : {}),
    }),
  );
};

describe('GET /api/teams', () => {
  it("lists the teams the caller's token names, with its role in each", async () => {
    const res = await call('GET', '/api/teams');
    expect(res.status).toBe(200);
    expect((await res.json<{ teams: unknown[] }>()).teams).toMatchObject([
      { id: 'team_1', name: 'Crew', myRole: 'member' },
    ]);
  });

  it('needs a caller', async () => {
    expect((await call('GET', '/api/teams', { user: null })).status).toBe(400);
  });
});

describe('GET /api/teams/:id/library', () => {
  const item = {
    id: 'D',
    app: 'livediagram',
    ownerId: 'user_bob',
    teamId: 'team_1',
    folderId: 'f1',
  };
  const folder = { id: 'f1', ownerId: 'user_bob', parentId: null, teamId: 'team_1', name: 'Q3' };

  it("reads a joined team's documents and folders from the index, for an API token too", async () => {
    index['GET /items'] = () =>
      Response.json({
        items: [{ ...item, title: 'Plan', createdAt: 1, updatedAt: 2, trashedAt: null }],
        nextCursor: null,
      });
    index['GET /folders'] = () =>
      Response.json({ folders: [{ ...folder, createdAt: 1, updatedAt: 1 }], nextCursor: null });

    const res = await call('GET', '/api/teams/team_1/library', { token: true });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      documents: { id: string; name: string; teamId: string; folderId: string }[];
      folders: { id: string; name: string }[];
    };
    expect(body.documents).toMatchObject([
      { id: 'D', name: 'Plan', teamId: 'team_1', folderId: 'f1' },
    ]);
    expect(body.folders).toMatchObject([{ id: 'f1', name: 'Q3' }]);
    expect(indexCalls.map((c) => [c.method, c.path, c.search.get('team')])).toEqual([
      ['GET', '/items', 'team_1'],
      ['GET', '/folders', 'team_1'],
    ]);
  });

  it('answers a team the caller is not in as missing, without asking the index', async () => {
    expect((await call('GET', '/api/teams/team_2/library', { token: true })).status).toBe(404);
    expect(indexCalls).toEqual([]);
  });

  it("passes the index's refusal on", async () => {
    index['GET /items'] = () => Response.json({ error: 'forbidden' }, { status: 403 });
    index['GET /folders'] = () => Response.json({ folders: [], nextCursor: null });
    const res = await call('GET', '/api/teams/team_1/library', { token: true });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
  });
});

describe('GET /api/teams/:id/members', () => {
  it('lists the joined and invited people for someone whose token names the team', async () => {
    const res = await call('GET', '/api/teams/team_1/members');
    expect(res.status).toBe(200);
    const { members } = (await res.json()) as {
      members: { userId: string | null; status: string; teamId: string }[];
    };
    expect(members.map((p) => [p.userId, p.status, p.teamId])).toEqual([
      ['user_ada', 'joined', 'team_1'],
      ['user_bob', 'joined', 'team_1'],
      [null, 'invited', 'team_1'],
    ]);
  });

  it('answers a team joined since the token was minted, asking accounts', async () => {
    teamsOf.set('user_bob', [TEAM]);
    const res = await call('GET', '/api/teams/team_1/members', { user: 'user_bob', claim: false });
    expect(res.status).toBe(200);
    expect(accountsCalls).toContain('/teams/of');
  });

  it('answers a team the caller is not in, or an API token, as missing', async () => {
    const cy = await call('GET', '/api/teams/team_1/members', { user: 'user_cy', claim: false });
    expect(cy.status).toBe(404);
    expect(await cy.json()).toEqual({ error: 'team_not_found' });
    expect((await call('GET', '/api/teams/team_1/members', { token: true })).status).toBe(404);
    expect(
      (await call('GET', '/api/teams/team_2/members', { user: 'user_dee', claim: false })).status,
    ).toBe(404);
  });
});

describe('the notify routes, for someone in the team', () => {
  it("answer a team the caller is not in as missing, without reading the team's people", async () => {
    for (const route of ['access-check', 'notify-action', 'notify-mention']) {
      const method = route === 'access-check' ? 'GET' : 'POST';
      const res = await call(method, `/api/teams/team_1/${route}`, {
        user: 'user_eve',
        claim: false,
      });
      expect(res.status).toBe(404);
    }
    expect(accountsCalls).not.toContain('/teams/members');
  });

  it('reach the handler for a joined member', async () => {
    const res = await call('GET', '/api/teams/team_1/access-check');
    expect(res.status).toBe(400);
    expect(accountsCalls).toContain('/teams/members');
  });
});

describe('anything else', () => {
  it('answers 404', async () => {
    expect((await call('PUT', '/api/teams/team_1')).status).toBe(404);
    expect((await call('GET', '/api/teams/team_1')).status).toBe(404);
    expect((await call('DELETE', '/api/teams/team_1/members')).status).toBe(404);
  });
});
