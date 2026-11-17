// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFERRED_AUTH_DEFAULT,
  DeferredAuthContext,
  type DeferredAuthState,
} from '../../components/providers/deferred-auth';
import { createUseAccountBootstrap, type BootstrapResult } from './useAccountBootstrap';

// The 5 s give-up (useAccountBootstrap.ts): a session that hasn't answered settles as a guest, so a stalled proxy
// can't hold the canvas, but never for a browser whose sign-in hint says signed in (`sessionExpected`): settling that
// one as a guest started the guest hand-off to an accounts site that wasn't answering (Work Tracker 1082).

const useAccountBootstrap = createUseAccountBootstrap({
  useWorkbenchSession: () => null,
  registerTokenProvider: () => () => {},
  clearGuestToken: () => {},
  inboxSnapshot: { setAccount: () => {} },
});

function track(auth: DeferredAuthState) {
  const seen: BootstrapResult[] = [];
  function Probe() {
    seen.push(useAccountBootstrap());
    return null;
  }
  const view = render(
    <DeferredAuthContext.Provider value={auth}>
      <Probe />
    </DeferredAuthContext.Provider>,
  );
  const rerender = (next: DeferredAuthState) =>
    view.rerender(
      <DeferredAuthContext.Provider value={next}>
        <Probe />
      </DeferredAuthContext.Provider>,
    );
  return { last: () => seen.at(-1)!, rerender };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useAccountBootstrap give-up', () => {
  it('settles a session that has not answered as a guest after 5 s', async () => {
    const probe = track(DEFERRED_AUTH_DEFAULT);
    expect(probe.last().authLoaded).toBe(false);
    await act(async () => vi.advanceTimersByTime(5000));
    expect(probe.last()).toMatchObject({ authLoaded: true, sessionAnswered: false });
  });

  it('never gives up on a session the hint expects, and settles when it answers', async () => {
    const expected = { ...DEFERRED_AUTH_DEFAULT, sessionExpected: true, accountUnreachable: true };
    const probe = track(expected);
    await act(async () => vi.advanceTimersByTime(60_000));
    expect(probe.last().authLoaded).toBe(false);
    act(() =>
      probe.rerender({
        ...DEFERRED_AUTH_DEFAULT,
        authLoaded: true,
        isSignedIn: true,
        userId: 'user_a',
      }),
    );
    expect(probe.last()).toMatchObject({
      authLoaded: true,
      sessionAnswered: true,
      accountUserId: 'user_a',
    });
  });
});
