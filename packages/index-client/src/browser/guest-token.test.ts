import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guestTokenFor } from '../testing';
import {
  createGuestTokens,
  GUEST_TOKEN_REFRESH_BEFORE_MS,
  guestTokenNeedsRefresh,
  parseGuestToken,
} from './guest-token';
import { fakeWindow } from './fake-window';

// A guest is liveworkspace's (liveworkspace/docs/one-explorer-contracts.md "Guests"): the editor sends the browser
// to the accounts site through its api's /api/auth/guest, keeps the token the /auth/guest page brings back, and asks
// again when fewer than 30 days are left.

const KEY = 'app:v2:guest-token';
let w: ReturnType<typeof fakeWindow>;
const onNewGuest = vi.fn();
const tokens = () =>
  createGuestTokens({
    storageKey: KEY,
    sessionPrefix: 'app',
    apiBase: '/api',
    fallbackPath: '/home',
    onNewGuest,
  });

beforeEach(() => {
  w = fakeWindow();
});
afterEach(() => {
  vi.unstubAllGlobals();
  onNewGuest.mockReset();
});

describe('parseGuestToken', () => {
  it("reads a guest token's id and expiry", () => {
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

it('asks again with fewer than 30 days left', () => {
  const now = Date.now();
  expect(guestTokenNeedsRefresh(null, now)).toBe(true);
  const fresh = {
    token: 't',
    id: 'guest_a',
    expiresAt: now + GUEST_TOKEN_REFRESH_BEFORE_MS + 1000,
  };
  expect(guestTokenNeedsRefresh(fresh, now)).toBe(false);
  expect(guestTokenNeedsRefresh({ ...fresh, expiresAt: now + 1000 }, now)).toBe(true);
});

describe('the handoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // In place of the page, so Back from where it comes back never lands on the page that asked.
  it('leaves on the next task, never inside the call that starts it, replacing the page', () => {
    void tokens().startGuestHandoff();
    expect(w.replace).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(w.replace).toHaveBeenCalledOnce();
    expect(w.assign).not.toHaveBeenCalled();
  });

  it("leaves for the api's guest door with a state, and keeps the token that comes back for it", () => {
    const t = tokens();
    void t.startGuestHandoff();
    vi.runAllTimers();
    const url = new URL(w.replace.mock.calls[0]![0] as string, 'http://localhost');
    expect(url.pathname).toBe('/api/auth/guest');
    const state = url.searchParams.get('state')!;
    expect(state).toMatch(/^[A-Za-z0-9_-]{8,}$/);
    const token = guestTokenFor('guest_new');
    expect(t.completeGuestHandoff(`#guest_token=${token}&state=${state}`)).toEqual({
      returnTo: '/design/d1?x=1',
      ok: true,
    });
    expect(w.win.localStorage.getItem(KEY)).toBe(token);
    expect(t.readGuestToken()?.id).toBe('guest_new');
    expect(onNewGuest).toHaveBeenCalledOnce();
  });

  it("keeps nothing for a stranger's state, and starts no other handoff for a while", () => {
    const t = tokens();
    void t.startGuestHandoff();
    vi.runAllTimers();
    expect(t.completeGuestHandoff(`#guest_token=${guestTokenFor('guest_x')}&state=wrong`).ok).toBe(
      false,
    );
    expect(w.win.localStorage.getItem(KEY)).toBeNull();
    w.replace.mockReset();
    void t.startGuestHandoff();
    vi.runAllTimers();
    expect(w.replace).not.toHaveBeenCalled();
  });

  it('only ever goes back to a path on this site', () => {
    w.win.sessionStorage.setItem(
      'app:guest-handoff',
      JSON.stringify({ state: 'abcdefgh', returnTo: '//evil.example/x' }),
    );
    const done = tokens().completeGuestHandoff(
      `#guest_token=${guestTokenFor('guest_a')}&state=abcdefgh`,
    );
    expect(done.returnTo).toBe('/home');
  });

  it('answers the kept token without leaving while it has time left, and forgets it when cleared', async () => {
    const t = tokens();
    w.win.localStorage.setItem(KEY, guestTokenFor('guest_kept'));
    expect((await t.ensureGuestToken())?.id).toBe('guest_kept');
    expect(w.replace).not.toHaveBeenCalled();
    t.clearGuestToken();
    expect(t.readGuestToken()).toBeNull();
  });
});
