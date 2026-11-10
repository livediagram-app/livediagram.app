import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guestTokenFor } from '../testing';
import {
  createGuestTokens,
  GUEST_TOKEN_REFRESH_BEFORE_MS,
  guestTokenNeedsRefresh,
  parseGuestToken,
} from './guest-token';
import { fakeWindow } from './fake-window';

// A guest is liveworkspace's (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Guests"): the editor sends the browser
// to the accounts site through its api's /api/auth/guest, keeps the token the /auth/guest page brings back, and asks
// again when fewer than 15 days are left.

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

it('asks again with fewer than 15 days left', () => {
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

  // The accounts Worker mints 45 days (GUEST_TOKEN_TTL_SECONDS): a fresh one is kept for 30, then renewed through
  // the same handoff, and the lw_guest cookie names the same guest, so renewing is never a new guest.
  it('renews a token near its end for the same guest, and never a fresh one', async () => {
    const DAY = 24 * 3600;
    const t = tokens();
    w.win.localStorage.setItem(KEY, guestTokenFor('guest_kept', 45 * DAY));
    expect((await t.ensureGuestToken())?.id).toBe('guest_kept');
    expect(w.replace).not.toHaveBeenCalled();

    w.win.localStorage.setItem(KEY, guestTokenFor('guest_kept', 14 * DAY));
    void t.ensureGuestToken();
    vi.runAllTimers();
    const url = new URL(w.replace.mock.calls[0]![0] as string, 'http://localhost');
    const state = url.searchParams.get('state')!;
    const renewed = guestTokenFor('guest_kept', 45 * DAY);
    expect(t.completeGuestHandoff(`#guest_token=${renewed}&state=${state}`).ok).toBe(true);
    expect(w.win.localStorage.getItem(KEY)).toBe(renewed);
    expect(onNewGuest).not.toHaveBeenCalled();
    expect(guestTokenNeedsRefresh(t.readGuestToken())).toBe(false);
  });

  // A Community post's preview frames the app's /embed: a handoff there took the frame to /auth/guest, which refuses
  // to be framed, so a signed-out visitor saw the browser's "refused to connect" page instead of the post.
  it('never leaves from inside a frame, and carries on with no token as a link visitor', async () => {
    Object.assign(w.win, { self: w.win, top: {} });
    const t = tokens();
    expect(await t.ensureGuestToken()).toBeNull();
    vi.runAllTimers();
    expect(w.replace).not.toHaveBeenCalled();
    expect(w.win.sessionStorage.getItem('app:guest-handoff')).toBeNull();
    // A frame on another origin, whose top cannot be read, is one too.
    Object.defineProperty(w.win, 'top', {
      get: () => {
        throw new DOMException('Blocked', 'SecurityError');
      },
    });
    expect(await tokens().ensureGuestToken()).toBeNull();
    vi.runAllTimers();
    expect(w.replace).not.toHaveBeenCalled();
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
