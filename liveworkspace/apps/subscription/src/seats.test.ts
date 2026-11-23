// A team's joined members, asked of accounts (subscription.md "Tiers and limits"): counted, remembered a while,
// and unknown rather than wrong when accounts can't say.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MEMBERS_CACHE_MAX, MEMBERS_FRESH_MS } from './config';
import { call } from './test-kit';
import { canCountMembers, forgetMembers, membersRemembered, teamMembers } from './seats';
import { testDb } from './test-sqlite-d1';

const NOW = Date.UTC(2026, 10, 20, 12);
const env = { ...testDb().env, ACCOUNTS_CLIENT_ID: 'client-1', ACCOUNTS_CLIENT_SECRET: 'secret-1' };

const people = (joined: number, invited = 0) =>
  Response.json({
    team: { id: 't', name: 'T' },
    members: [
      ...Array.from({ length: joined }, (_, i) => ({ id: `j${i}`, status: 'joined' })),
      ...Array.from({ length: invited }, (_, i) => ({ id: `i${i}`, status: 'invited' })),
    ],
  });

beforeEach(() => {
  forgetMembers();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("a team's members", () => {
  it('are its joined people, not its invitations', async () => {
    const fetcher = vi.fn(async () => people(4, 3));
    expect(await teamMembers(env, 'team_1', NOW, fetcher)).toBe(4);
    expect(fetcher).toHaveBeenCalledWith(
      'https://www.liveworkspace.app/api/account/internal/teams/members',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ teamId: 'team_1' }) }),
    );
  });

  it('are remembered for five minutes, then asked for again', async () => {
    const fetcher = vi.fn(async () => people(4));
    await teamMembers(env, 'team_1', NOW, fetcher);
    expect(membersRemembered(env, 'team_1', NOW + MEMBERS_FRESH_MS - 1)).toBe(4);
    expect(membersRemembered(env, 'team_1', NOW + MEMBERS_FRESH_MS)).toBeUndefined();
    await teamMembers(env, 'team_1', NOW + 1000, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await teamMembers(env, 'team_1', NOW + MEMBERS_FRESH_MS, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('are unknown without a client, for no such team, and when accounts cannot answer', async () => {
    const fetcher = vi.fn(async () => people(4));
    expect(canCountMembers(testDb().env)).toBe(false);
    expect(await teamMembers(testDb().env, 'team_1', NOW, fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      await teamMembers(env, 'team_1', NOW, async () => new Response(null, { status: 404 })),
    ).toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      await teamMembers(env, 'team_1', NOW, async () => new Response(null, { status: 500 })),
    ).toBeNull();
    expect(
      await teamMembers(env, 'team_1', NOW, async () => {
        throw new Error('network');
      }),
    ).toBeNull();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(membersRemembered(env, 'team_1', NOW)).toBeUndefined();
  });

  it('are remembered for no more teams than the isolate keeps: the oldest goes first', async () => {
    const fetcher = async () => people(4);
    for (let i = 0; i <= MEMBERS_CACHE_MAX; i++) await teamMembers(env, `team_${i}`, NOW, fetcher);
    expect(membersRemembered(env, 'team_0', NOW)).toBeUndefined();
    expect(membersRemembered(env, 'team_1', NOW)).toBe(4);
    expect(membersRemembered(env, `team_${MEMBERS_CACHE_MAX}`, NOW)).toBe(4);
  });
});

describe('a body', () => {
  it('that is not JSON, or is missing, is a bad request', async () => {
    const headers = { Authorization: 'Bearer ld-key', 'X-Subscription-App': 'livediagram.app' };
    const base = testDb().env;
    const broken = await call(base, '/internal/spend', {
      method: 'POST',
      headers,
      body: '{"owner":',
    });
    expect(broken.status).toBe(400);
    expect((await call(base, '/internal/spend', { method: 'POST', headers })).status).toBe(400);
  });
});
