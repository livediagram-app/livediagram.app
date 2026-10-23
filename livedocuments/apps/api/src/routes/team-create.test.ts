import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { handleTeams } from './teams';
import { makeTestRouteContext } from './test-route-context';

let db: SqliteD1;
let accounts: FakeAccounts;

beforeEach(() => {
  db = sqliteD1(ACCOUNTS_ON);
  accounts = stubAccounts();
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
  it('makes the team on liveworkspace with the caller as admin', async () => {
    const res = await create({ name: '  Writers  ', organisation: 'Acme' });
    expect(res.status).toBe(201);
    const { team } = (await res.json()) as { team: { id: string; name: string } };
    expect(team).toMatchObject({ id: 'team_1', name: 'Writers', organisation: 'Acme' });
    expect(accounts.madeTeams).toEqual([
      { id: 'team_1', name: 'Writers', organisation: 'Acme', admin: 'user_a' },
    ]);
  });

  it('cuts a long name as liveworkspace does, and refuses an empty one', async () => {
    const res = await create({ name: 'x'.repeat(200), organisation: '   ' });
    const made = (await res.json()) as { team: { name: string; organisation: string | null } };
    expect(made.team.name).toHaveLength(80);
    expect(made.team.organisation).toBeNull();
    expect((await create({ name: '   ' })).status).toBe(400);
    expect((await create({})).status).toBe(400);
    expect(accounts.madeTeams).toHaveLength(1);
  });

  it('needs a signed-in session with its access token', async () => {
    expect((await create({ name: 'A' }, { user: null })).status).toBe(401);
    expect((await create({ name: 'A' }, { token: null })).status).toBe(401);
    expect(accounts.calls).toHaveLength(0);
  });

  it('answers 503 without sign-in configured, or with liveworkspace out of reach', async () => {
    expect((await create({ name: 'A' }, { env: {} as Env })).status).toBe(503);
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network');
    });
    expect((await create({ name: 'A' })).status).toBe(503);
  });

  it('passes liveworkspace’s refusal on', async () => {
    accounts.failWith = 409;
    const res = await create({ name: 'A' });
    expect(res.status).toBe(409);
    expect(accounts.madeTeams).toEqual([]);
  });
});
