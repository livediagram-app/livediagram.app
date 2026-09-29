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
  () => [] as { start: ReturnType<typeof vi.fn>; publish: (s: unknown) => void }[],
);
const posted = vi.hoisted(() => [] as unknown[]);
const election = vi.hoisted(() => ({
  elect: true,
  deliver: null as ((m: unknown) => void) | null,
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/explorer/recent' }));
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
    return () => {};
  },
  openDriveTabChannel: (onMessage: (m: unknown) => void) => {
    election.deliver = onMessage;
    return { post: (m: unknown) => posted.push(m), close: () => {} };
  },
  onDriveFlushRequest: () => () => {},
}));

const { DriveMirrorProvider } = await import('./DriveMirrorProvider');
const { useDriveMirror, DRIVE_STATUS_INITIAL } = await import('./drive-mirror-context');
const { markConnectConnected } = await import('@/lib/drive/consent');

const seen = { connecting: false };
function Probe() {
  const { connecting } = useDriveMirror();
  useEffect(() => {
    seen.connecting = connecting;
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
  sessionStorage.clear();
});
afterEach(cleanup);

describe('DriveMirrorProvider', () => {
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
});
