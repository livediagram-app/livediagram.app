import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetInvitationsCache,
  INVITATIONS_CACHE_MAX,
  INVITATIONS_TTL_MS,
  pendingInvitationsFor,
  type PendingInvitation,
} from './invitations';

const credentials = {
  accountsUrl: 'https://accounts.test/',
  clientId: 'livediagram',
  clientSecret: 'secret',
};

const invitation: PendingInvitation = {
  id: 'member_1',
  teamId: 'team_1',
  teamName: 'Design',
  organisation: null,
  memberCount: 2,
  role: 'member',
  invitedByName: 'Ada',
  createdAt: 1,
};

function fetcherAnswering(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

beforeEach(() => __resetInvitationsCache());

describe('pendingInvitationsFor', () => {
  it('asks liveworkspace with the client credentials, for the account', async () => {
    const fetcher = fetcherAnswering(200, { invitations: [invitation] });
    expect(await pendingInvitationsFor(credentials, 'user_bea', { fetcher })).toEqual([invitation]);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://accounts.test/api/account/internal/invitations');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('authorization')).toBe(
      `Basic ${btoa('livediagram:secret')}`,
    );
    expect(JSON.parse(String(init?.body))).toEqual({ userId: 'user_bea' });
  });

  it('remembers an answer briefly, and shares one request between callers at once', async () => {
    const fetcher = fetcherAnswering(200, { invitations: [invitation] });
    await Promise.all([
      pendingInvitationsFor(credentials, 'user_bea', { fetcher, now: 0 }),
      pendingInvitationsFor(credentials, 'user_bea', { fetcher, now: 0 }),
    ]);
    await pendingInvitationsFor(credentials, 'user_bea', { fetcher, now: INVITATIONS_TTL_MS - 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await pendingInvitationsFor(credentials, 'user_bea', { fetcher, now: INVITATIONS_TTL_MS });
    expect(fetcher).toHaveBeenCalledTimes(2);
    await pendingInvitationsFor(credentials, 'user_cy', { fetcher, now: 0 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('throws on a refusal and does not remember it', async () => {
    const failing = fetcherAnswering(503, {});
    await expect(pendingInvitationsFor(credentials, 'user_bea', { fetcher: failing })).rejects.toThrow(
      'invitations failed: 503',
    );
    const fetcher = fetcherAnswering(200, { invitations: [] });
    expect(await pendingInvitationsFor(credentials, 'user_bea', { fetcher })).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reads a malformed answer as none', async () => {
    const fetcher = fetcherAnswering(200, { invitations: 'nope' });
    expect(await pendingInvitationsFor(credentials, 'user_bea', { fetcher })).toEqual([]);
  });

  it('keeps at most INVITATIONS_CACHE_MAX accounts, forgetting the oldest', async () => {
    const fetcher = fetcherAnswering(200, { invitations: [] });
    for (let i = 0; i <= INVITATIONS_CACHE_MAX; i++) {
      await pendingInvitationsFor(credentials, `user_${i}`, { fetcher, now: 0 });
    }
    expect(fetcher).toHaveBeenCalledTimes(INVITATIONS_CACHE_MAX + 1);
    // The newest is still remembered; the first was forgotten.
    await pendingInvitationsFor(credentials, `user_${INVITATIONS_CACHE_MAX}`, { fetcher, now: 0 });
    expect(fetcher).toHaveBeenCalledTimes(INVITATIONS_CACHE_MAX + 1);
    await pendingInvitationsFor(credentials, 'user_0', { fetcher, now: 0 });
    expect(fetcher).toHaveBeenCalledTimes(INVITATIONS_CACHE_MAX + 2);
  });
});
