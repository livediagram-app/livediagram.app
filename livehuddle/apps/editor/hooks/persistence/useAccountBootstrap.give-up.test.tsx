// @vitest-environment jsdom

// The 5 s give-up: a session that hasn't answered settles as a guest, but never for a browser whose sign-in hint says
// signed in (`sessionExpected`, set by the AuthProvider): settling it as a guest started the guest hand-off to an
// accounts site that wasn't answering (Work Tracker 1082).

import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  state: {
    authLoaded: false,
    isSignedIn: false,
    userId: null as string | null,
    user: null,
    getToken: async () => null,
    signOut: async () => {},
    deleteAccount: null,
    sessionExpected: false,
  },
}));
vi.mock('@liveworkspace/workbench/components/providers/deferred-auth', () => ({
  DEFERRED_AUTH_PENDING: { authLoaded: false },
  useDeferredAuth: () => auth.state,
}));

const { useAccountBootstrap } = await import('./useAccountBootstrap');

function track() {
  const seen: boolean[] = [];
  function Probe() {
    seen.push(useAccountBootstrap().authLoaded);
    return null;
  }
  render(<Probe />);
  return () => seen.at(-1);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAccountBootstrap give-up', () => {
  it('settles a session that has not answered as a guest after 5 s', async () => {
    auth.state = { ...auth.state, sessionExpected: false };
    const last = track();
    expect(last()).toBe(false);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(last()).toBe(true);
  });

  it('never gives up on a session the hint expects', async () => {
    auth.state = { ...auth.state, sessionExpected: true };
    const last = track();
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(last()).toBe(false);
  });
});
