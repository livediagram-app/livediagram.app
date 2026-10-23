import { describe, expect, it, vi } from 'vitest';
import { accountsTeamReader, createTeamAccess, MISS_RECHECK_MS } from './teams';

const CREDENTIALS = { accountsUrl: 'https://accounts.test', clientId: 'app', clientSecret: 's' };
const T1 = { id: 't1', name: 'One', role: 'member' as const };
const T2 = { id: 't2', name: 'Two', role: 'admin' as const };

function accounts(teams: () => unknown[]) {
  const calls: string[] = [];
  const fetcher = (async (url: string) => {
    calls.push(new URL(url).pathname);
    return Response.json({ teams: teams() });
  }) as unknown as typeof fetch;
  return { fetcher, calls };
}

describe('team access', () => {
  it('trusts a claim that holds the team, asking nothing', async () => {
    const a = accounts(() => []);
    const access = createTeamAccess();
    const R = accountsTeamReader(CREDENTIALS, a.fetcher);
    expect(await access.inTeam(R, 'user_a', [T1], 't1')).toBe(true);
    expect(a.calls).toEqual([]);
  });

  it('finds a team made a moment ago that the claim does not hold yet, at once', async () => {
    const a = accounts(() => [T1, T2]);
    const access = createTeamAccess();
    const R = accountsTeamReader(CREDENTIALS, a.fetcher);
    expect(await access.inTeam(R, 'user_a', [T1], 't2')).toBe(true);
    expect(a.calls).toEqual(['/api/account/internal/teams/of']);
    // Remembered: the next request in the burst asks nothing.
    expect(await access.inTeam(R, 'user_a', [T1], 't2')).toBe(true);
    expect(a.calls).toHaveLength(1);
  });

  it('asks again for a miss only after a moment, and never for a guest', async () => {
    let teams: unknown[] = [T1];
    const a = accounts(() => teams);
    const access = createTeamAccess();
    const R = accountsTeamReader(CREDENTIALS, a.fetcher);
    const now = Date.now();
    expect((await access.teamsOf(R, 'user_a', [T1], 't2', now)).map((t) => t.id)).toEqual(['t1']);
    expect(await access.teamsOf(R, 'user_a', [T1], 't2', now + 1)).toHaveLength(1);
    expect(a.calls).toHaveLength(1);
    teams = [T1, T2];
    expect(await access.teamsOf(R, 'user_a', [T1], 't2', now + MISS_RECHECK_MS)).toHaveLength(2);
    expect(await access.teamsOf(R, 'guest_x', null, 't2')).toEqual([]);
    expect(a.calls).toHaveLength(2);
  });

  it('keeps the claim when accounts is down', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetcher = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    const access = createTeamAccess();
    const R = accountsTeamReader(CREDENTIALS, fetcher);
    expect(await access.teamsOf(R, 'user_a', [T1], 't2')).toEqual([T1]);
    expect(await access.teamsOf(R, 'user_a', null)).toEqual([]);
  });
});
