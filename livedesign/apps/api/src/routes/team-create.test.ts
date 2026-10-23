import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMembership, getTeam } from '../db/teams';
import { fakeAccounts, type FakeAccounts } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { handleTeams } from './teams';
import { makeTestRouteContext } from './test-route-context';

let db: SqliteD1;
let accounts: FakeAccounts;

beforeEach(() => {
  accounts = fakeAccounts();
  db = sqliteD1(accounts.env);
  vi.stubGlobal('fetch', accounts.fetch);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const create = (
  body: unknown,
  opts: { user?: string | null; token?: string | null; env?: Env } = {},
) => {
  const user = opts.user === undefined ? 'user_a' : opts.user;
  const token = opts.token === undefined ? `token-for-${user}` : opts.token;
  return handleTeams(
    makeTestRouteContext('POST', '/api/teams', {
      owner: user,
      accountUserId: user,
      env: opts.env ?? db.env,
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
  );
};

describe('POST /api/teams (docs/specs/013-workspace/teams.md "Making a team")', () => {
  it('makes the team on liveworkspace with the caller as admin, and files it here at once', async () => {
    const res = await create({ name: '  Design  ', organisation: 'Acme' });
    expect(res.status).toBe(201);
    const { team } = (await res.json()) as { team: { id: string; name: string } };
    expect(team).toMatchObject({ id: 'team_1', name: 'Design', organisation: 'Acme' });
    expect(accounts.teams).toEqual([
      { id: 'team_1', name: 'Design', organisation: 'Acme', admin: 'user_a' },
    ]);
    expect(accounts.callsTo('teams')[0]?.body).toMatchObject({ accessToken: 'token-for-user_a' });
    expect(await getTeam(db.env, 'team_1')).toMatchObject({ name: 'Design', organisation: 'Acme' });
    expect(await getMembership(db.env, 'team_1', 'user_a')).toMatchObject({
      role: 'admin',
      status: 'joined',
    });
  });

  it('cuts a long name as liveworkspace does, and refuses an empty one', async () => {
    const res = await create({ name: 'x'.repeat(200), organisation: '  ' });
    const made = (await res.json()) as { team: { name: string; organisation: string | null } };
    expect(made.team.name).toHaveLength(80);
    expect(made.team.organisation).toBeNull();
    expect((await create({ name: '   ' })).status).toBe(400);
    expect((await create({})).status).toBe(400);
    expect((await create(undefined)).status).toBe(400);
  });

  it('needs a signed-in session with its access token', async () => {
    expect((await create({ name: 'A' }, { user: null })).status).toBe(401);
    expect((await create({ name: 'A' }, { token: null })).status).toBe(401);
  });

  it('answers 503 without sign-in configured, or with liveworkspace out of reach', async () => {
    expect((await create({ name: 'A' }, { env: { DB: db.env.DB } as Env })).status).toBe(503);
    accounts.failing.set('teams', 500);
    expect((await create({ name: 'A' })).status).toBe(503);
  });

  it('passes liveworkspace’s refusal on, and files nothing', async () => {
    accounts.failing.set('teams', 409);
    const res = await create({ name: 'A' });
    expect(res.status).toBe(409);
    expect(await getTeam(db.env, 'team_1')).toBeNull();
  });
});
