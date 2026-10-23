import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../types';
import { handleTeams } from './teams';
import { makeTestRouteContext } from './test-route-context';

// GET /api/teams/invites (docs/specs/013-workspace/teams.md "Invitations"): the invitations waiting on
// liveworkspace.app, read through pendingInvitationsFor. Each test asks for its own account, since the
// answer is remembered per account for 30 seconds.

const ACCOUNTS = {
  ACCOUNTS_URL: 'https://accounts.test',
  ACCOUNTS_CLIENT_ID: 'livediagram',
  ACCOUNTS_CLIENT_SECRET: 'secret',
} as Partial<Env> as Env;

const waiting = {
  id: 'member_1',
  teamId: 'team_1',
  teamName: 'Design',
  organisation: 'Acme',
  memberCount: 3,
  role: 'member',
  invitedByName: 'Ada',
  createdAt: 1000,
};

let calls: { url: string; body: unknown }[];
let answer: () => Response;

beforeEach(() => {
  calls = [];
  answer = () => Response.json({ invitations: [waiting] });
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(init.body as string) });
    return answer();
  });
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ask = (user: string, opts: { session?: boolean; env?: Env } = {}) =>
  handleTeams(
    makeTestRouteContext('GET', '/api/teams/invites', {
      owner: user,
      accountUserId: opts.session === false ? null : user,
      verifiedUserId: user,
      env: opts.env ?? ACCOUNTS,
    }),
  );

describe('GET /api/teams/invites', () => {
  it('lists the invitations waiting on liveworkspace.app, as the Invites view reads them', async () => {
    const res = await ask('user_a');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      invites: [
        {
          memberId: 'member_1',
          team: {
            id: 'team_1',
            name: 'Design',
            organisation: 'Acme',
            createdAt: 1000,
            updatedAt: 1000,
          },
          memberCount: 3,
          invitedAt: 1000,
          role: 'member',
          invitedByName: 'Ada',
        },
      ],
    });
    expect(calls).toEqual([
      { url: 'https://accounts.test/api/account/internal/invitations', body: { userId: 'user_a' } },
    ]);
  });

  it('asks liveworkspace once for an Explorer load, however many surfaces ask', async () => {
    await Promise.all([ask('user_b'), ask('user_b')]);
    await ask('user_b');
    expect(calls).toHaveLength(1);
  });

  it('answers an API token’s owner too', async () => {
    const res = await ask('user_c', { session: false });
    const body: { invites: unknown[] } = await res.json();
    expect(body.invites).toHaveLength(1);
  });

  it('is empty, not an error, without accounts or with liveworkspace out of reach', async () => {
    expect(await (await ask('user_d', { env: {} as Env })).json()).toEqual({ invites: [] });
    expect(calls).toHaveLength(0);
    answer = () => new Response(null, { status: 503 });
    const res = await ask('user_e');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ invites: [] });
  });

  it('takes no other method', async () => {
    const res = await handleTeams(
      makeTestRouteContext('POST', '/api/teams/invites', {
        owner: 'user_f',
        accountUserId: 'user_f',
        env: ACCOUNTS,
        body: {},
      }),
    );
    expect(res.status).toBe(404);
  });
});
