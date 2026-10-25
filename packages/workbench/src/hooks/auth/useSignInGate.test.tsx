// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SESSION_WAIT_MS,
  signInGateOf,
  useSignInGate,
  type SignInGateInput,
} from './useSignInGate';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const base: SignInGateInput = {
  authLoaded: false,
  sessionAnswered: false,
  signedIn: false,
  signedInHint: false,
  waitedOut: false,
};

// docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before sign-in answers", in each product.
describe('signInGateOf', () => {
  it('waits while nothing has settled', () => {
    expect(signInGateOf(base)).toBe('waiting');
  });

  it('lets a known account through', () => {
    expect(signInGateOf({ ...base, authLoaded: true, sessionAnswered: true, signedIn: true })).toBe(
      'signed-in',
    );
  });

  it('asks a browser with no hint to sign in once settled, give-up or not', () => {
    expect(signInGateOf({ ...base, authLoaded: true })).toBe('sign-in');
    expect(signInGateOf({ ...base, authLoaded: true, sessionAnswered: true })).toBe('sign-in');
  });

  it('keeps waiting past the 5 s give-up while the hint says a session is coming', () => {
    expect(signInGateOf({ ...base, authLoaded: true, signedInHint: true })).toBe('waiting');
  });

  it('asks a hinted browser to sign in once the session itself says there is no one', () => {
    expect(
      signInGateOf({ ...base, authLoaded: true, sessionAnswered: true, signedInHint: true }),
    ).toBe('sign-in');
  });

  it('gives up on a hinted session that never answers', () => {
    expect(signInGateOf({ ...base, authLoaded: true, signedInHint: true, waitedOut: true })).toBe(
      'sign-in',
    );
  });
});

type Props = Omit<SignInGateInput, 'waitedOut'>;
const unsettled: Props = {
  authLoaded: false,
  sessionAnswered: false,
  signedIn: false,
  signedInHint: false,
};

describe('useSignInGate', () => {
  it('shows no Sign in step to a signed-in browser whose session answers after the give-up', () => {
    const hook = renderHook((p: Props) => useSignInGate(p), {
      initialProps: { ...unsettled, signedInHint: true },
    });
    expect(hook.result.current).toBe('waiting');
    // The page's 5 s give-up: settled, with no one in it, the session still out.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    hook.rerender({ ...unsettled, authLoaded: true, signedInHint: true });
    expect(hook.result.current).toBe('waiting');
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    hook.rerender({ authLoaded: true, sessionAnswered: true, signedIn: true, signedInHint: true });
    expect(hook.result.current).toBe('signed-in');
  });

  it('offers Sign in after the wait when a hinted session never answers', () => {
    const hook = renderHook((p: Props) => useSignInGate(p), {
      initialProps: { ...unsettled, authLoaded: true, signedInHint: true },
    });
    act(() => {
      vi.advanceTimersByTime(SESSION_WAIT_MS - 1);
    });
    expect(hook.result.current).toBe('waiting');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(hook.result.current).toBe('sign-in');
  });
});
