// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunitySession } from '../lib/session';
import { withCommunitySite } from '../test/site';

// The two pieces around the pages: CommunityGate (livediagram/docs/specs/025-community/community.md "Turning the Community
// off") and the session My Shares asks for ("My Shares").

const h = vi.hoisted(() => ({
  enabled: true,
  replace: vi.fn(),
}));

vi.mock('@liveworkspace/community-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/community-ui')>()),
  useCommunityEnabled: () => h.enabled,
}));

import { AccountSession } from './auth/AccountSession';
import { CommunityGate } from './CommunityGate';

const wrapper = withCommunitySite();

const fetchMock = vi.fn<typeof fetch>();

function tokenAnswer(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

function setHint(value: '1' | '0' | null) {
  document.cookie =
    value === null
      ? 'ld_signed_in=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      : `ld_signed_in=${value}; path=/`;
}

beforeEach(() => {
  h.enabled = true;
  h.replace.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, replace: h.replace },
  });
});

afterEach(() => {
  cleanup();
  setHint(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CommunityGate', () => {
  it('shows the app while the Community is on', () => {
    render(<CommunityGate>The gallery</CommunityGate>, { wrapper });
    expect(screen.getByText('The gallery')).toBeTruthy();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('shows nothing and goes home while it is switched off', () => {
    h.enabled = false;
    render(<CommunityGate>The gallery</CommunityGate>, { wrapper });
    expect(screen.queryByText('The gallery')).toBeNull();
    expect(h.replace).toHaveBeenCalledWith('/');
  });
});

describe('AccountSession', () => {
  async function reported(): Promise<CommunitySession> {
    const onSession = vi.fn<(s: CommunitySession) => void>();
    render(<AccountSession onSession={onSession} />, { wrapper });
    await waitFor(() => expect(onSession).toHaveBeenCalled());
    return onSession.mock.calls.at(-1)![0];
  }

  it('reports who is signed in, with their token', async () => {
    setHint('1');
    fetchMock.mockResolvedValue(
      tokenAnswer({
        signedIn: true,
        accessToken: 'token-1',
        expiresAt: Date.now() + 15 * 60_000,
        user: { id: 'user_1' },
      }),
    );
    const session = await reported();
    expect(session).toMatchObject({ loaded: true, signedIn: true, userId: 'user_1' });
    expect(await session.getToken()).toBe('token-1');
    // Still fresh, so the token is reused rather than asked for again.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('asks again for a token that is nearly spent', async () => {
    setHint('1');
    fetchMock
      .mockResolvedValueOnce(
        tokenAnswer({ signedIn: true, accessToken: 'old', expiresAt: Date.now(), user: { id: 'u' } }),
      )
      .mockResolvedValueOnce(
        tokenAnswer({
          signedIn: true,
          accessToken: 'new',
          expiresAt: Date.now() + 15 * 60_000,
          user: { id: 'u' },
        }),
      );
    const session = await reported();
    expect(await session.getToken()).toBe('new');
  });

  it('is signed out, without asking, for a browser with no hint', async () => {
    const session = await reported();
    expect(session).toMatchObject({ loaded: true, signedIn: false, userId: null });
    expect(await session.getToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is signed out when the api has no session, or cannot be reached', async () => {
    setHint('1');
    fetchMock.mockResolvedValueOnce(tokenAnswer({ signedIn: false }));
    expect((await reported()).signedIn).toBe(false);
    cleanup();
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect((await reported()).signedIn).toBe(false);
  });
});
