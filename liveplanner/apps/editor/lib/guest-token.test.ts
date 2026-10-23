// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  completeGuestHandoff,
  ensureGuestToken,
  GUEST_TOKEN_REFRESH_BEFORE_MS,
  guestTokenNeedsRefresh,
  parseGuestToken,
  readGuestToken,
  startGuestHandoff,
} from './guest-token';
import { GUEST_TOKEN_STORAGE_KEY } from './guest-token-key';
import { guestTokenFor } from './testing/guest-token';

// A guest is liveworkspace's (liveworkspace/docs/one-explorer-contracts.md "Guests"): the editor sends the browser
// to the accounts site through its api's /api/auth/guest, keeps the token the /auth/guest page brings back, and asks
// again when fewer than 30 days are left.

const assign = vi.fn();

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, pathname: '/project/p1', search: '?x=1', hash: '', assign },
  });
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  assign.mockReset();
});

describe('parseGuestToken', () => {
  it('reads a guest token’s id and expiry', () => {
    const parsed = parseGuestToken(guestTokenFor('guest_abc', 100));
    expect(parsed?.id).toBe('guest_abc');
    expect(parsed!.expiresAt).toBeGreaterThan(Date.now());
  });

  it('refuses anything that is not a guest token', () => {
    expect(parseGuestToken('not-a-jwt')).toBeNull();
    const account = `x.${btoa(JSON.stringify({ sub: 'user_1', kind: 'access', exp: 9e9 }))}.s`;
    expect(parseGuestToken(account)).toBeNull();
  });
});

describe('refresh window', () => {
  it('asks again with fewer than 30 days left', () => {
    const now = Date.now();
    expect(guestTokenNeedsRefresh(null, now)).toBe(true);
    const fresh = { token: 't', id: 'guest_a', expiresAt: now + GUEST_TOKEN_REFRESH_BEFORE_MS + 1000 };
    expect(guestTokenNeedsRefresh(fresh, now)).toBe(false);
    expect(guestTokenNeedsRefresh({ ...fresh, expiresAt: now + 1000 }, now)).toBe(true);
  });
});

describe('the handoff', () => {
  it('leaves for the api’s guest door with a state, and keeps the token that comes back for it', () => {
    void startGuestHandoff();
    expect(assign).toHaveBeenCalledOnce();
    const url = new URL(assign.mock.calls[0]![0] as string, 'http://localhost');
    expect(url.pathname).toMatch(/\/auth\/guest$/);
    const state = url.searchParams.get('state')!;
    expect(state).toMatch(/^[A-Za-z0-9_-]{8,}$/);

    const token = guestTokenFor('guest_new');
    const done = completeGuestHandoff(`#guest_token=${token}&state=${state}`);
    expect(done).toEqual({ returnTo: '/project/p1?x=1', ok: true });
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBe(token);
    expect(readGuestToken()?.id).toBe('guest_new');
  });

  it('keeps nothing for a stranger’s state, and starts no other handoff for a while', () => {
    void startGuestHandoff();
    const done = completeGuestHandoff(`#guest_token=${guestTokenFor('guest_x')}&state=wrongstate1`);
    expect(done.ok).toBe(false);
    expect(localStorage.getItem(GUEST_TOKEN_STORAGE_KEY)).toBeNull();
    assign.mockReset();
    void startGuestHandoff();
    expect(assign).not.toHaveBeenCalled();
  });

  it('only ever goes back to a path on this site', () => {
    sessionStorage.setItem(
      'liveplanner:guest-handoff',
      JSON.stringify({ state: 'abcdefgh', returnTo: '//evil.example/x' }),
    );
    const done = completeGuestHandoff(`#guest_token=${guestTokenFor('guest_a')}&state=abcdefgh`);
    expect(done.returnTo).toBe('/explorer');
  });

  it('answers the kept token without leaving while it has time left', async () => {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, guestTokenFor('guest_kept'));
    expect((await ensureGuestToken())?.id).toBe('guest_kept');
    expect(assign).not.toHaveBeenCalled();
  });
});
