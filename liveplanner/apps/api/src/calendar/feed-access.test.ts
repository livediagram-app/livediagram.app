// Who may still read a feed's plan, asked fresh on every fetch (docs/specs/026-plan/calendar-feed.md "Who may have
// one"): an account that owns the plan or is in its team now; never a guest, never through a share link alone; a
// plan in the Trash serves none; accounts or the index that cannot say is `unavailable`, never `ok`.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = vi.hoisted(() => ({
  grant: vi.fn(),
  callers: [] as unknown[],
  missing: false,
}));
vi.mock('../index-service', async (original) => ({
  ...(await original<typeof import('../index-service')>()),
  indexFor: (_env: unknown, caller: unknown) => {
    index.callers.push(caller);
    return index.missing ? null : { grant: index.grant };
  },
}));

import { IndexError } from '@liveworkspace/index-client';
import { ACCOUNTS_ON, stubAccounts, type FakeAccounts } from '../test-accounts';
import type { Env } from '../types';
import { calendarFeedAccess } from './feed-access';

const env = { ...ACCOUNTS_ON } as Env;
const grant = (extra = {}) => ({ grant: 'g', level: 'edit', tabId: null, expiresAt: 0, ...extra });

let accounts: FakeAccounts;
beforeEach(() => {
  accounts = stubAccounts();
  index.grant.mockReset();
  index.callers = [];
  index.missing = false;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('calendarFeedAccess', () => {
  it("asks the index as the person, with the teams accounts lists for them now, and serves the plan's owner", async () => {
    accounts.teams.set('team_1', [
      { id: 'm1', userId: 'user_ada', email: 'a@x', name: 'Ada', role: 'member', status: 'joined' },
    ]);
    accounts.teams.set('team_2', [
      { id: 'm2', userId: 'user_ada', email: 'a@x', name: null, role: 'member', status: 'invited' },
    ]);
    index.grant.mockResolvedValue(grant());
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('ok');
    expect(index.callers).toEqual([{ kind: 'delegate', personId: 'user_ada', teams: ['team_1'] }]);
    expect(index.grant).toHaveBeenCalledWith('P', null);
  });

  it('asks again on every fetch: a member removed since is refused', async () => {
    index.grant.mockResolvedValueOnce(grant());
    index.grant.mockRejectedValueOnce(new IndexError(404, 'not_found'));
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('ok');
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('refused');
    expect(index.grant).toHaveBeenCalledTimes(2);
    expect(accounts.calls.filter((c) => c.path === '/teams/of')).toHaveLength(2);
  });

  it('refuses a guest or a link visitor without asking anyone', async () => {
    expect(await calendarFeedAccess(env, 'P', 'guest_0000')).toBe('refused');
    expect(await calendarFeedAccess(env, 'P', 'link:abc')).toBe('refused');
    expect(index.callers).toEqual([]);
  });

  it('refuses a plan in the Trash, and a grant confined to one tab', async () => {
    index.grant.mockResolvedValueOnce(grant({ trashed: true }));
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('refused');
    index.grant.mockResolvedValueOnce(grant({ tabId: 't1' }));
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('refused');
  });

  it("is unavailable when accounts or the index can't say, never ok", async () => {
    accounts.failWith = 500;
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('unavailable');
    accounts.failWith = null;
    index.grant.mockRejectedValueOnce(new IndexError(503, 'unavailable'));
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('unavailable');
    index.grant.mockRejectedValueOnce(new TypeError('network'));
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('unavailable');
    index.missing = true;
    expect(await calendarFeedAccess(env, 'P', 'user_ada')).toBe('unavailable');
    expect(await calendarFeedAccess({} as Env, 'P', 'user_ada')).toBe('unavailable');
  });
});
