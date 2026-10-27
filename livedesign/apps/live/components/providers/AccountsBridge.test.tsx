// @vitest-environment jsdom

// The signed-in session as the page sees it (docs/specs/014-identity/auth-and-guest-access.md
// "Signing in"): no request at all without the signed-in hint, else one POST /api/auth/token on
// load, the access token held in memory and reused until
// a minute before it expires, concurrent asks sharing one refresh (each refresh rotates the
// refresh token), and signing out dropping the cookie before the full load.

import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeferredAuthState } from '@liveworkspace/workbench/components/providers/deferred-auth';

vi.mock('@/lib/recent-designs-snapshot', () => ({ forgetRecentDesigns: vi.fn(async () => {}) }));

const { AccountsBridge, namesOf, resetAccountsSessionForTests } = await import('./AccountsBridge');
const { notePictureSettingSaved, ownPicture, resetOwnPicture, tokenPredatesPictureSetting } =
  await import('@/lib/own-picture');
const { announceProfileSaved } = await import('@liveworkspace/settings-ui/profile-events');

const USER = { id: 'user_abc', email: 'ada@example.com', name: 'Ada Lovelace' };
const fetchMock = vi.fn<typeof fetch>();

function signedIn(token: string, expiresInMs = 3_600_000) {
  return new Response(
    JSON.stringify({
      signedIn: true,
      accessToken: token,
      expiresAt: Date.now() + expiresInMs,
      user: USER,
    }),
    { status: 200 },
  );
}

beforeEach(() => {
  resetAccountsSessionForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  // The api's hint that this browser has a session (lib/signed-in-hint.ts).
  document.cookie = 'ldes_signed_in=1';
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.cookie = 'ldes_signed_in=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

async function mount(): Promise<DeferredAuthState> {
  const onState = vi.fn<(s: DeferredAuthState) => void>();
  render(<AccountsBridge onState={onState} />);
  await waitFor(() => expect(onState).toHaveBeenCalled());
  return onState.mock.lastCall![0];
}

describe('AccountsBridge and Show My Google Picture', () => {
  const PICTURE = 'https://lh3.googleusercontent.com/a/me';
  const session = (token: string, tokenAgeMs: number, pictureHidden: boolean) =>
    new Response(
      JSON.stringify({
        signedIn: true,
        accessToken: token,
        expiresAt: Date.now() + 3_600_000,
        tokenAgeMs,
        user: { ...USER, picture: PICTURE, pictureHidden },
      }),
      { status: 200 },
    );
  afterEach(() => {
    localStorage.clear();
    resetOwnPicture();
  });

  // docs/specs/014-identity/profile-and-email-notifications.md "Avatars": another tab hid the picture 5 s ago, and
  // this tab's refresh replays a response minted 20 s ago, before the save.
  it('refreshes again when the token predates the last save, so a hidden picture stays hidden', async () => {
    notePictureSettingSaved(Date.now() - 5_000);
    fetchMock
      .mockResolvedValueOnce(session('replayed', 20_000, false))
      .mockResolvedValueOnce(session('fresh', 0, true));
    const state = await mount();
    expect(await state.getToken()).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(ownPicture().shown).toBe(false);
  });

  it('asks once when the token is newer than the save', async () => {
    notePictureSettingSaved(Date.now() - 30_000);
    fetchMock.mockResolvedValueOnce(session('fresh', 1_000, true));
    const state = await mount();
    expect(await state.getToken()).toBe('fresh');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('notes a Show My Google Picture save made anywhere on the page', async () => {
    fetchMock.mockResolvedValueOnce(session('fresh', 0, true));
    await mount();
    announceProfileSaved({
      patch: { showPicture: false },
      name: null,
      color: null,
      showPicture: false,
    });
    expect(tokenPredatesPictureSetting(5_000)).toBe(true);
  });
});

describe('AccountsBridge', () => {
  it('settles a browser without the hint as a guest, asking the api nothing', async () => {
    document.cookie = 'ldes_signed_in=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    expect(await mount()).toMatchObject({ authLoaded: true, isSignedIn: false, userId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('settles as a guest when the api says signed out', async () => {
    fetchMock.mockResolvedValue(new Response('{"signedIn":false}', { status: 401 }));
    const state = await mount();
    expect(state).toMatchObject({ authLoaded: true, isSignedIn: false, userId: null, user: null });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/token',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('settles as a guest when the api cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await mount()).toMatchObject({ authLoaded: true, isSignedIn: false });
  });

  it('publishes the signed-in account', async () => {
    fetchMock.mockResolvedValue(signedIn('access-1'));
    const state = await mount();
    expect(state).toMatchObject({
      authLoaded: true,
      isSignedIn: true,
      userId: 'user_abc',
      user: {
        id: 'user_abc',
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        fullName: 'Ada Lovelace',
      },
    });
  });

  it('reuses the held token, and refreshes once for concurrent asks near expiry', async () => {
    fetchMock.mockResolvedValueOnce(signedIn('access-1'));
    const state = await mount();
    expect(await state.getToken()).toBe('access-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(signedIn('access-2', 30_000)); // inside the margin
    expect(await state.getToken({ skipCache: true })).toBe('access-2');
    fetchMock.mockResolvedValueOnce(signedIn('access-3'));
    const [a, b] = await Promise.all([state.getToken(), state.getToken()]);
    expect([a, b]).toEqual(['access-3', 'access-3']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('signs out by dropping the cookie, then a full load', async () => {
    fetchMock.mockResolvedValueOnce(signedIn('access-1'));
    const state = await mount();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    fetchMock.mockResolvedValueOnce(new Response('{"signedIn":false}'));
    await state.signOut({ redirectUrl: '/explorer' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/sign-out?return=%2Fexplorer',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(assign).toHaveBeenCalledWith('/explorer');
    // The held token went with the session.
    fetchMock.mockResolvedValueOnce(new Response('{"signedIn":false}', { status: 401 }));
    expect(await state.getToken()).toBeNull();
  });

  // liveworkspace/docs/specs/003-accounts/accounts.md "Signing out".
  it("takes the accounts site's hop when the api answers one, so every app is signed out", async () => {
    fetchMock.mockResolvedValueOnce(signedIn('access-1'));
    const state = await mount();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const hop = 'https://www.liveworkspace.app/api/auth/end-session?ticket=t';
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ signedIn: false, next: hop })));
    await state.signOut();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/sign-out?return=%2F',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(assign).toHaveBeenCalledWith(hop);
  });

  it('ends the session after the account is deleted, without leaving the page', async () => {
    fetchMock.mockResolvedValueOnce(signedIn('access-1'));
    const state = await mount();
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    fetchMock.mockResolvedValueOnce(new Response('{"signedIn":false,"next":null}'));
    await state.deleteAccount?.();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/auth/sign-out?return=%2F',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('namesOf', () => {
  const base = { id: 'u', email: 'grace.hopper@example.com' };
  it("splits the account's name at its first space", () => {
    expect(namesOf({ ...base, name: 'Grace Brewster Hopper' })).toEqual({
      firstName: 'Grace',
      lastName: 'Brewster Hopper',
      fullName: 'Grace Brewster Hopper',
    });
    expect(namesOf({ ...base, name: ' Grace ' })).toEqual({
      firstName: 'Grace',
      lastName: null,
      fullName: 'Grace',
    });
  });

  it("falls back to the email's local part for an account with no name", () => {
    expect(namesOf({ ...base, name: null })).toEqual({
      firstName: 'grace.hopper',
      lastName: null,
      fullName: 'grace.hopper',
    });
    expect(namesOf({ ...base, email: null, name: '' })).toEqual({
      firstName: null,
      lastName: null,
      fullName: null,
    });
  });
});
