// The index's calls to accounts go over the ACCOUNTS binding and are bounded (liveworkspace/docs/specs/003-accounts/
// accounts.md "When the accounts site doesn't answer", Work Tracker 958): a binding that stalls answers within the
// deadline, as accounts being out of reach, and the public route is used only without a binding.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIMEOUT_MS, accountsAdminTeams, accountsPeopleNames } from './accounts-access';
import type { Person } from './auth';
import type { Env } from './env';
import { FRESH_TEAMS_TIMEOUT_MS, clearFreshTeamsForTests, inTeamNow } from './fresh-teams';

// A binding that never answers on its own, only to its signal (the stall of 2026-11-15).
function stalledBinding() {
  const urls: string[] = [];
  const binding = {
    fetch: (url: string, init?: RequestInit) => {
      urls.push(url);
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    },
  };
  return { binding, urls };
}

// A binding as the tests make one: only `fetch`, which is all the index calls.
const envWith = (
  ACCOUNTS: { fetch: (url: string, init?: RequestInit) => Promise<Response> } | undefined,
) =>
  ({
    MERGE_KEY: 'merge-key',
    ACCOUNTS_URL: 'https://www.liveworkspace.app',
    ACCOUNTS: ACCOUNTS as unknown as Env['ACCOUNTS'],
  }) as Env;

// Settles `pending` by the deadline in fake time, and checks it hadn't a moment before.
async function byDeadline<T>(pending: Promise<T>, ms: number): Promise<T> {
  let settled = false;
  void pending.then(() => (settled = true));
  await vi.advanceTimersByTimeAsync(ms - 1);
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(settled).toBe(true);
  return pending;
}

const publicRoute = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.useFakeTimers();
  publicRoute.mockReset();
  vi.stubGlobal('fetch', publicRoute);
  clearFreshTeamsForTests();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the index asking accounts', () => {
  it("answers 'can't say' within the deadline when the binding stalls: who runs a team, and names", async () => {
    const { binding, urls } = stalledBinding();
    const env = envWith(binding);
    expect(await byDeadline(accountsAdminTeams(env)('user_a'), TIMEOUT_MS)).toBeNull();
    expect(await byDeadline(accountsPeopleNames(env)(['user_a', 'user_b']), TIMEOUT_MS)).toBeNull();
    expect(urls).toEqual([
      'https://www.liveworkspace.app/api/account/index/teams',
      'https://www.liveworkspace.app/api/account/index/people',
    ]);
    // A timeout is not a broken binding: the public route is never tried after it.
    expect(publicRoute).not.toHaveBeenCalled();
  });

  it("lets the token's claim stand within the deadline when a fresh-teams question stalls", async () => {
    const { binding, urls } = stalledBinding();
    const person: Person = { id: 'user_a', kind: 'account', teams: ['team1'] };
    expect(
      await byDeadline(inTeamNow(envWith(binding), person, 'team2'), FRESH_TEAMS_TIMEOUT_MS),
    ).toBe(false);
    expect(person.teams).toEqual(['team1']);
    expect(urls).toEqual(['https://www.liveworkspace.app/api/account/index/teams']);
    expect(publicRoute).not.toHaveBeenCalled();
  });

  it('answers over the binding when it answers, and over the public route without one', async () => {
    const answering = {
      fetch: vi.fn(async () =>
        Response.json({ teams: [{ id: 'team2', name: 'Two', role: 'admin' }] }),
      ),
    };
    expect(await accountsAdminTeams(envWith(answering))('user_a')).toEqual(new Set(['team2']));
    expect(answering.fetch).toHaveBeenCalledTimes(1);
    expect(publicRoute).not.toHaveBeenCalled();

    publicRoute.mockResolvedValue(Response.json({ people: [{ id: 'user_a', name: 'Ada' }] }));
    expect(await accountsPeopleNames(envWith(undefined))(['user_a'])).toEqual(
      new Map([['user_a', 'Ada']]),
    );
    expect(publicRoute).toHaveBeenCalledTimes(1);
  });
});
