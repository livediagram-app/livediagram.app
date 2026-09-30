// @vitest-environment jsdom

// When the provider starts the mirror (docs/specs/022-drive-mirror/drive-mirror.md,
// "Connecting"): as soon as the signed-in user is known, and, back from a
// finished connection, at once in whichever tab runs the mirror.

import { useEffect } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveMirrorStatus } from '@/lib/drive/engine';
import type { DriveTabMessage } from '@/lib/drive/tab-election';

const auth = vi.hoisted(() => ({
  value: { isSignedIn: false, authLoaded: false, clerkUserId: null as string | null },
}));
const engines = vi.hoisted(
  () =>
    [] as {
      start: ReturnType<typeof vi.fn>;
      requestCheck: ReturnType<typeof vi.fn>;
      onVisible: ReturnType<typeof vi.fn>;
      publish: (s: unknown) => void;
    }[],
);
const posted = vi.hoisted(() => [] as unknown[]);
const election = vi.hoisted(() => ({
  elect: true,
  deliver: null as ((m: unknown) => void) | null,
  takenOver: 0,
}));

const route = vi.hoisted(() => ({ path: '/explorer/recent' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
vi.mock('@/hooks/persistence/useClerkApiBootstrap', () => ({
  useClerkApiBootstrap: () => auth.value,
}));
vi.mock('@/components/providers/deferred-auth', () => ({
  useDeferredAuth: () => ({ user: null }),
}));
vi.mock('@/hooks/ui/useConfirm', () => ({ useConfirm: () => async () => true }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));
vi.mock('@/lib/api-client', () => ({
  apiGetCapabilities: async () => ({ driveMode: 'broker' }),
  apiDisconnectDrive: vi.fn(),
  apiDriveState: vi.fn(),
  apiPutDriveConnection: vi.fn(),
}));
vi.mock('@/lib/drive/config', () => ({
  driveUiMode: (m: string | undefined) => m ?? 'off',
  googleClientId: 'client',
  googlePickerApiKey: '',
}));
vi.mock('@/lib/drive/browser-engine', () => ({
  createBrowserTokens: () => ({ mode: 'broker', source: { get: vi.fn(), clear: vi.fn() } }),
  createBrowserEngine: (input: { onStatus: (s: unknown) => void }) => {
    const engine = {
      start: vi.fn(async () => {}),
      stop: vi.fn(),
      syncNow: vi.fn(async () => {}),
      requestCheck: vi.fn(async () => {}),
      onVisible: vi.fn(async () => {}),
      current: null,
      publish: input.onStatus,
    };
    engines.push(engine);
    return engine;
  },
}));
vi.mock('@/lib/drive/tab-election', () => ({
  electDriveTab: (onElected: () => void) => {
    if (election.elect) onElected();
    return {
      resign: () => {},
      takeOver: () => {
        election.takenOver += 1;
        onElected();
      },
    };
  },
  openDriveTabChannel: (onMessage: (m: unknown) => void) => {
    election.deliver = onMessage;
    return { post: (m: unknown) => posted.push(m), close: () => {} };
  },
  onDriveFlushRequest: () => () => {},
}));

const { DriveMirrorProvider, resetConnectOutcomeForTests } = await import('./DriveMirrorProvider');
const { useDriveMirror, DRIVE_STATUS_INITIAL } = await import('./drive-mirror-context');
const { markConnectConnected, markConnectCancelled } = await import('@/lib/drive/consent');
const {
  DRIVE_CHECK_ANSWER_MS,
  DRIVE_POLL_INTERVAL_MS,
  DRIVE_STALE_AFTER_MS,
  DRIVE_STALE_WATCH_MS,
} = await import('@/lib/drive/cadence');

const seen = { connecting: false, checking: false, requestCheck: () => {} };
function Probe() {
  const { connecting, checking, requestCheck } = useDriveMirror();
  useEffect(() => {
    seen.connecting = connecting;
    seen.checking = checking;
    seen.requestCheck = requestCheck;
  });
  return null;
}
const tree = () => (
  <DriveMirrorProvider>
    <Probe />
  </DriveMirrorProvider>
);
const flush = () => act(async () => void (await Promise.resolve()));
const status = (over: Partial<DriveMirrorStatus>): DriveMirrorStatus => ({
  ...DRIVE_STATUS_INITIAL,
  ...over,
});

beforeEach(() => {
  auth.value = { isSignedIn: false, authLoaded: false, clerkUserId: null };
  engines.length = 0;
  posted.length = 0;
  election.elect = true;
  election.takenOver = 0;
  route.path = '/explorer/recent';
  resetConnectOutcomeForTests();
  window.history.replaceState(null, '', '/explorer/recent');
  sessionStorage.clear();
});
afterEach(cleanup);

describe('DriveMirrorProvider', () => {
  it('leaves the outcome of a trip to Google for the page it returns to, never taking it on /drive pages', async () => {
    // /drive/connected renders the provider too; its child page marks the
    // outcome in the same commit as the provider mounts.
    route.path = '/drive/connected';
    window.history.replaceState(null, '', '/drive/connected');
    auth.value = { isSignedIn: true, authLoaded: true, clerkUserId: 'user_1' };
    function MarksOnMount() {
      useEffect(() => markConnectCancelled(sessionStorage), []);
      return null;
    }
    render(
      <DriveMirrorProvider>
        <MarksOnMount />
      </DriveMirrorProvider>,
    );
    await flush();
    expect(sessionStorage.getItem('livediagram:v2:drive-connect-outcome')).toBe('cancelled');
  });

  it('starts the mirror once the signed-in user becomes known after mount', async () => {
    const view = render(tree());
    await flush();
    expect(engines).toHaveLength(0);
    auth.value = { isSignedIn: true, authLoaded: true, clerkUserId: 'user_1' };
    view.rerender(tree());
    await flush();
    await flush();
    expect(engines).toHaveLength(1);
    expect(engines[0]!.start).toHaveBeenCalledOnce();
  });

  it('back from a finished connection, asks the tab that runs the mirror to sync at once', async () => {
    election.elect = false;
    markConnectConnected(sessionStorage);
    auth.value = { isSignedIn: true, authLoaded: true, clerkUserId: 'user_1' };
    render(tree());
    await flush();
    await flush();
    expect(posted).toContainEqual({ type: 'sync-now' });
    expect(sessionStorage.length).toBe(0);
  });

  it('never says Not connected while the new connection is being set up', async () => {
    election.elect = false;
    markConnectConnected(sessionStorage);
    auth.value = { isSignedIn: true, authLoaded: true, clerkUserId: 'user_1' };
    render(tree());
    await flush();
    await flush();
    // The elected tab still reports what it saw before the connection.
    act(() =>
      election.deliver!({
        type: 'status',
        status: status({ state: 'disconnected' }),
      } satisfies DriveTabMessage),
    );
    expect(seen.connecting).toBe(true);
    // Its pass starts: the truth from now on.
    act(() =>
      election.deliver!({
        type: 'status',
        status: status({ state: 'syncing' }),
      } satisfies DriveTabMessage),
    );
    expect(seen.connecting).toBe(false);
    act(() =>
      election.deliver!({
        type: 'status',
        status: status({ state: 'disconnected' }),
      } satisfies DriveTabMessage),
    );
    expect(seen.connecting).toBe(false);
  });

  describe('a visible tab is never left unsynced', () => {
    beforeEach(() => vi.useFakeTimers({ now: 10 * 60 * 60_000 }));
    afterEach(() => vi.useRealTimers());
    const signedIn = async () => {
      auth.value = { isSignedIn: true, authLoaded: true, clerkUserId: 'user_1' };
      render(tree());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    };
    const checks = () => posted.filter((m) => (m as { type: string }).type === 'check');

    it('asks the tab that syncs for a check when this one is focused', async () => {
      election.elect = false;
      await signedIn();
      act(() => void window.dispatchEvent(new Event('focus')));
      expect(checks()).toEqual([{ type: 'check', kind: 'focus' }]);
    });

    it('keeps the 2-minute rhythm while visible, even after hours asleep', async () => {
      election.elect = false;
      await signedIn();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRIVE_POLL_INTERVAL_MS);
      });
      expect(checks()).toContainEqual({ type: 'check', kind: 'poll' });
      // An answer each time, so it never takes over.
      act(() => election.deliver!({ type: 'status', status: status({ state: 'idle' }) }));
      // Asleep for hours: timers fire late, then the return brings a check.
      vi.setSystemTime(Date.now() + 3 * 60 * 60_000);
      act(() => void document.dispatchEvent(new Event('visibilitychange')));
      expect(checks().at(-1)).toEqual({ type: 'check', kind: 'focus' });
    });

    it('takes the sync over when the tab that syncs does not answer', async () => {
      election.elect = false;
      await signedIn();
      act(() => void window.dispatchEvent(new Event('focus')));
      expect(engines).toHaveLength(0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRIVE_CHECK_ANSWER_MS);
      });
      expect(election.takenOver).toBe(1);
      expect(engines).toHaveLength(1);
    });

    it('asks again, not takes over, when the clock jumped past the wait (sleep)', async () => {
      election.elect = false;
      await signedIn();
      act(() => void window.dispatchEvent(new Event('focus')));
      // Asleep: the timer fires long after its time; the answer is not late.
      vi.setSystemTime(Date.now() + 40_000);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRIVE_CHECK_ANSWER_MS);
      });
      expect(election.takenOver).toBe(0);
      expect(checks()).toEqual([
        { type: 'check', kind: 'focus' },
        { type: 'check', kind: 'focus' },
      ]);
      // Still unanswered on time: now it takes over.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRIVE_CHECK_ANSWER_MS);
      });
      expect(election.takenOver).toBe(1);
    });

    it('checks once a running pass ends when Cloud Sync comes into view during it', async () => {
      election.elect = false;
      await signedIn();
      act(() =>
        election.deliver!({
          type: 'status',
          status: status({ state: 'syncing', lastSyncedAt: Date.now() - 60_000 }),
        }),
      );
      act(() => seen.requestCheck());
      expect(checks()).toEqual([]);
      act(() =>
        election.deliver!({
          type: 'status',
          status: status({ state: 'idle', lastSyncedAt: Date.now() - 60_000 }),
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(checks()).toEqual([{ type: 'check', kind: 'view' }]);
    });

    it('does not take over when the tab that syncs answers', async () => {
      election.elect = false;
      await signedIn();
      act(() => void window.dispatchEvent(new Event('focus')));
      act(() => election.deliver!({ type: 'status', status: status({ state: 'idle' }) }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRIVE_CHECK_ANSWER_MS);
      });
      expect(election.takenOver).toBe(0);
    });

    it('in the tab that syncs, answers a check with its status', async () => {
      await signedIn();
      await act(async () => {
        election.deliver!({ type: 'check', kind: 'focus' });
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(engines[0]!.requestCheck).toHaveBeenCalledWith('focus');
      expect(posted).toContainEqual({ type: 'status', status: null });
    });

    it('logs drive: stale and asks for a check when the last sync is too old', async () => {
      election.elect = false;
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await signedIn();
      act(() =>
        election.deliver!({
          type: 'status',
          status: status({ state: 'idle', lastSyncedAt: Date.now() - DRIVE_STALE_AFTER_MS - 1 }),
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(DRIVE_STALE_WATCH_MS);
      });
      expect(warn).toHaveBeenCalledWith(
        'drive: stale',
        expect.objectContaining({ elected: false }),
      );
      expect(checks().at(-1)).toEqual({ type: 'check', kind: 'focus' });
      warn.mockRestore();
    });

    it('checks when Cloud Sync comes into view, and says Checking until the result', async () => {
      election.elect = false;
      await signedIn();
      act(() =>
        election.deliver!({
          type: 'status',
          status: status({ state: 'idle', lastSyncedAt: Date.now() - 60_000 }),
        }),
      );
      act(() => seen.requestCheck());
      expect(checks().at(-1)).toEqual({ type: 'check', kind: 'view' });
      expect(seen.checking).toBe(true);
      act(() =>
        election.deliver!({
          type: 'status',
          status: status({ state: 'idle', lastSyncedAt: Date.now() }),
        }),
      );
      expect(seen.checking).toBe(false);
      // Moments later: no second check.
      const before = checks().length;
      act(() => seen.requestCheck());
      expect(checks()).toHaveLength(before);
    });
  });
});
