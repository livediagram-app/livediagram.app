// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunitySession } from './lib/session';
import { withCommunitySite } from './test/site';

// The two pieces around the pages: CommunityGate (livediagram/docs/specs/025-community/community.md "Turning the Community
// off") and the app's session My Shares asks for ("My Shares").

const h = vi.hoisted(() => ({
  enabled: true,
  replace: vi.fn(),
}));

vi.mock('@liveworkspace/community-ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@liveworkspace/community-ui')>()),
  useCommunityEnabled: () => h.enabled,
}));

import type { AppAccount } from '@/lib/explorer/app-session';
import { AccountSession } from './auth/AccountSession';
import { CommunityGate } from './CommunityGate';

const wrapper = withCommunitySite();

beforeEach(() => {
  h.enabled = true;
  h.replace.mockReset();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, replace: h.replace },
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('CommunityGate', () => {
  it('shows the page while the Community is on', () => {
    render(<CommunityGate>The gallery</CommunityGate>, { wrapper });
    expect(screen.getByText('The gallery')).toBeTruthy();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it("shows nothing and goes to the app's home while it is switched off", () => {
    h.enabled = false;
    render(<CommunityGate>The gallery</CommunityGate>, { wrapper });
    expect(screen.queryByText('The gallery')).toBeNull();
    expect(h.replace).toHaveBeenCalledWith('/');
  });
});

const account = (token: string, sub = 'user_1'): AppAccount => ({
  token,
  expiresAt: Date.now() + 15 * 60_000,
  sub,
  name: 'Ada',
  fullName: null,
  colour: null,
  picture: null,
  email: null,
});

describe('AccountSession', () => {
  async function reported(ask: () => Promise<AppAccount | null>): Promise<CommunitySession> {
    const onSession = vi.fn<(s: CommunitySession) => void>();
    render(<AccountSession onSession={onSession} ask={ask} />, { wrapper });
    await waitFor(() => expect(onSession).toHaveBeenCalled());
    return onSession.mock.calls.at(-1)![0];
  }

  it("reports who is signed in to the app, with the app session's token", async () => {
    const ask = vi.fn(async () => account('token-1'));
    const session = await reported(ask);
    expect(session).toMatchObject({ loaded: true, signedIn: true, userId: 'user_1' });
    expect(await session.getToken()).toBe('token-1');
  });

  it("asks the app's session afresh for each token, which renews one that is nearly spent", async () => {
    const ask = vi
      .fn<() => Promise<AppAccount | null>>()
      .mockResolvedValueOnce(account('old'))
      .mockResolvedValueOnce(account('new'));
    const session = await reported(ask);
    expect(await session.getToken()).toBe('new');
    expect(ask).toHaveBeenCalledTimes(2);
  });

  it('is signed out when the app has no session', async () => {
    const session = await reported(async () => null);
    expect(session).toMatchObject({ loaded: true, signedIn: false, userId: null });
    expect(await session.getToken()).toBeNull();
  });
});
