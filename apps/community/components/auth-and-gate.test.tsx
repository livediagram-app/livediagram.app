// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunitySession } from '@/lib/session';

// The two pieces around the app: CommunityGate (docs/specs/025-community/community.md "Turning the Community
// off") and the Clerk session My Shares loads ("My Shares").

const h = vi.hoisted(() => ({
  enabled: true,
  auth: { isLoaded: true, isSignedIn: true as boolean | undefined, getToken: vi.fn() },
  replace: vi.fn(),
}));

vi.mock('@livediagram/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@livediagram/ui')>()),
  useCommunityEnabled: () => h.enabled,
}));
vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => h.auth,
}));
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  clerkPublishableKey: 'pk_test_x',
}));

import ClerkSession from './auth/ClerkSession';
import { CommunityGate } from './CommunityGate';

beforeEach(() => {
  h.enabled = true;
  h.auth = { isLoaded: true, isSignedIn: true, getToken: vi.fn() };
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
  it('shows the app while the Community is on', () => {
    render(<CommunityGate>The gallery</CommunityGate>);
    expect(screen.getByText('The gallery')).toBeTruthy();
    expect(h.replace).not.toHaveBeenCalled();
  });

  it('shows nothing and goes home while it is switched off', () => {
    h.enabled = false;
    render(<CommunityGate>The gallery</CommunityGate>);
    expect(screen.queryByText('The gallery')).toBeNull();
    expect(h.replace).toHaveBeenCalledWith('/');
  });
});

describe('ClerkSession', () => {
  it('reports who is signed in, with their token', async () => {
    h.auth.getToken.mockResolvedValue('token-1');
    const onSession = vi.fn<(s: CommunitySession) => void>();
    render(<ClerkSession onSession={onSession} />);
    await waitFor(() => expect(onSession).toHaveBeenCalled());
    const session = onSession.mock.calls.at(-1)![0];
    expect(session).toMatchObject({ loaded: true, signedIn: true });
    expect(await session.getToken()).toBe('token-1');
  });

  it("retries once when Clerk's token is briefly null on a live session", async () => {
    h.auth.getToken.mockResolvedValueOnce(null).mockResolvedValueOnce('token-2');
    const onSession = vi.fn<(s: CommunitySession) => void>();
    render(<ClerkSession onSession={onSession} />);
    await waitFor(() => expect(onSession).toHaveBeenCalled());
    expect(await onSession.mock.calls.at(-1)![0].getToken()).toBe('token-2');
    expect(h.auth.getToken).toHaveBeenCalledTimes(2);
  });

  it('gives no token, without retrying, when signed out', async () => {
    h.auth = { isLoaded: true, isSignedIn: false, getToken: vi.fn().mockResolvedValue(null) };
    const onSession = vi.fn<(s: CommunitySession) => void>();
    render(<ClerkSession onSession={onSession} />);
    await waitFor(() => expect(onSession).toHaveBeenCalled());
    const session = onSession.mock.calls.at(-1)![0];
    expect(session.signedIn).toBe(false);
    expect(await session.getToken()).toBeNull();
    expect(h.auth.getToken).toHaveBeenCalledTimes(1);
  });
});
