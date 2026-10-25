// @vitest-environment jsdom
// The consent page's sign-in step (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before sign-in
// answers"): a browser whose hint says it is signed in never sees "Sign in to connect" while its session is slow to
// answer, past the page's 5 s give-up; it sees the approve card once the session lands.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Bootstrap = {
  isSignedIn: boolean | undefined;
  authLoaded: boolean;
  sessionAnswered: boolean;
  accountUserId: string | null;
  accountDisplayName: string | null;
};
const SETTLING: Bootstrap = {
  isSignedIn: false,
  authLoaded: false,
  sessionAnswered: false,
  accountUserId: null,
  accountDisplayName: null,
};
let bootstrap: Bootstrap = SETTLING;

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('session=s1'),
}));
vi.mock('@/hooks/persistence/useAccountBootstrap', () => ({
  useAccountBootstrap: () => bootstrap,
}));
vi.mock('@/lib/mcp-consent-session', () => ({
  fetchConsentSession: async () => ({
    clientName: 'Claude',
    redirectHost: 'claude.ai',
    clientId: 'c1',
  }),
}));
vi.mock('@/lib/telemetry', () => ({ track: () => {} }));

import OauthConsentPage from './page';

const HINT = 'ldoc_signed_in';
const setHint = (on: boolean) => {
  document.cookie = on
    ? `${HINT}=1; path=/`
    : `${HINT}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
};

beforeEach(() => {
  bootstrap = SETTLING;
});
afterEach(() => {
  cleanup();
  setHint(false);
});

describe('/oauth/consent sign-in step', () => {
  it('shows no Sign in step to a signed-in browser whose session answers after the give-up', async () => {
    setHint(true);
    const page = render(<OauthConsentPage />);
    // The page's 5 s give-up: settled, with no one in it, the session still out.
    bootstrap = { ...SETTLING, authLoaded: true };
    page.rerender(<OauthConsentPage />);
    expect(screen.queryByText(/Sign in to connect/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.getByText('Loading…')).toBeTruthy();
    // The session lands.
    bootstrap = {
      isSignedIn: true,
      authLoaded: true,
      sessionAnswered: true,
      accountUserId: 'user_1',
      accountDisplayName: 'Ada',
    };
    await act(async () => page.rerender(<OauthConsentPage />));
    expect(await screen.findByRole('heading', { name: 'Connect Claude' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
    expect(screen.queryByText(/Sign in to connect/)).toBeNull();
  });

  it('asks a browser with no session hint to sign in once settled', async () => {
    bootstrap = { ...SETTLING, authLoaded: true, sessionAnswered: true };
    render(<OauthConsentPage />);
    expect(await screen.findByRole('heading', { name: /Sign in to connect/ })).toBeTruthy();
  });

  it('asks a hinted browser to sign in once its session says there is no one', async () => {
    setHint(true);
    bootstrap = { ...SETTLING, authLoaded: true, sessionAnswered: true };
    render(<OauthConsentPage />);
    expect(await screen.findByRole('heading', { name: /Sign in to connect/ })).toBeTruthy();
  });
});
