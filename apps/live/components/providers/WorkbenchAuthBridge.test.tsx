// @vitest-environment jsdom

// The editor in a workbench is signed in by its session alone (docs/specs/013-workspace/blueprints/
// workbench-embeds.md "The editor in a workbench", I9): the bridge publishes the person before any
// child fetches; above it, Clerk and the e2e bridge stand down and nothing reads as a settled guest,
// Clerk configured or not; and the bootstrap under the session runs no guest migration.

import { act, cleanup, render } from '@testing-library/react';
import { useEffect, useLayoutEffect, type ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkbenchSession } from './workbench-session-context';

const config = vi.hoisted(() => ({ clerk: true }));
vi.mock('@/lib/clerk-config', () => ({
  get clerkEnabled() {
    return config.clerk;
  },
  get clerkPublishableKey() {
    return config.clerk ? 'pk_test' : null;
  },
  get sessionsEnabled() {
    return config.clerk;
  },
  e2eAuthEnabled: false,
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/embed/workbench/' }));
const bridges = vi.hoisted(() => ({ mounted: 0 }));
vi.mock('next/dynamic', () => ({
  default: () =>
    function FakeClerkBridge() {
      useEffect(() => {
        bridges.mounted++;
      }, []);
      return null;
    },
}));
const { apiMigrateGuestData } = vi.hoisted(() => ({ apiMigrateGuestData: vi.fn() }));
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiMigrateGuestData,
}));

const SECRET = `lvw_${'a'.repeat(43)}`;
const RENEWED = `lvw_${'b'.repeat(43)}`;

function sessionOf(secret = SECRET): WorkbenchSession {
  return {
    secret,
    documentId: 'doc-1',
    tabId: null,
    origin: 'https://127.0.0.1:5175',
    level: 'edit',
    expiresAt: Date.now() + 60_000,
    person: { id: 'user_1', name: 'Webber', color: '#0ea5e9', pictureUrl: null },
    workbenchName: 'Spinner',
    port: { origin: 'https://127.0.0.1:5175', send: vi.fn(), subscribe: vi.fn(), close: vi.fn() },
    ended: null,
    end: vi.fn(),
  };
}

// A fresh module graph per configuration: the bootstrap picks its variant when it loads.
async function load() {
  vi.resetModules();
  const [{ ClerkProvider }, { WorkbenchAuthBridge }, auth, boot, core, migration] =
    await Promise.all([
      import('./ClerkProvider'),
      import('./WorkbenchAuthBridge'),
      import('./deferred-auth'),
      import('@/hooks/persistence/useClerkApiBootstrap'),
      import('@/lib/api/core'),
      import('@/lib/guest-migration'),
    ]);
  return { ClerkProvider, WorkbenchAuthBridge, auth, boot, core, migration };
}

// The first load transforms the module graph; every later one reuses it.
beforeAll(async () => {
  await load();
}, 60_000);

beforeEach(() => {
  bridges.mounted = 0;
  apiMigrateGuestData.mockReset();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('WorkbenchAuthBridge', () => {
  it('publishes the session’s person to the editor', async () => {
    const { WorkbenchAuthBridge, auth, core } = await load();
    let seen: ReturnType<typeof auth.useDeferredAuth> | null = null;
    function Probe() {
      seen = auth.useDeferredAuth();
      return null;
    }

    render(
      <WorkbenchAuthBridge session={sessionOf()}>
        <Probe />
      </WorkbenchAuthBridge>,
    );

    expect(seen).toMatchObject({
      authLoaded: true,
      isSignedIn: true,
      userId: 'user_1',
      user: { id: 'user_1', fullName: 'Webber', email: null },
      deleteAccount: null,
    });
    expect(await seen!.getToken()).toBe(SECRET);
    await expect(seen!.signOut()).resolves.toBeUndefined();
    core.setTokenProvider(null);
  });

  it('presents the session on a child’s very first request, and confines it', async () => {
    const { WorkbenchAuthBridge, core } = await load();
    let headers: Promise<HeadersInit> | null = null;
    function Child() {
      useLayoutEffect(() => {
        headers = core.apiHeaders('user_1');
      }, []);
      return null;
    }

    render(
      <WorkbenchAuthBridge session={sessionOf()}>
        <Child />
      </WorkbenchAuthBridge>,
    );

    expect(await headers!).toEqual({ Authorization: `Bearer ${SECRET}` });
    expect(core.getWorkbenchConfinement()).toEqual({ documentId: 'doc-1', ownerId: 'user_1' });
    core.setTokenProvider(null);
    core.setWorkbenchConfinement(null);
  });

  it('presents a renewed secret from then on, and lets go on unmount', async () => {
    const { WorkbenchAuthBridge, core } = await load();
    const tree = (secret: string) => (
      <WorkbenchAuthBridge session={sessionOf(secret)}>
        <span />
      </WorkbenchAuthBridge>
    );
    const { rerender, unmount } = render(tree(SECRET));

    rerender(tree(RENEWED));
    expect(await core.apiHeaders('user_1')).toEqual({ Authorization: `Bearer ${RENEWED}` });

    unmount();
    expect(await core.apiHeaders('guest-1')).toEqual({ 'X-Owner-Id': 'guest-1' });
    core.setWorkbenchConfinement(null);
  });
});

describe('the workbench page’s surroundings', () => {
  for (const clerk of [true, false]) {
    describe(clerk ? 'with Clerk configured' : 'without Clerk', () => {
      beforeEach(() => {
        config.clerk = clerk;
      });

      it('never read as a settled guest, however long they wait', async () => {
        vi.useFakeTimers();
        const { ClerkProvider, boot, auth } = await load();
        const seen: { loaded: boolean; signedIn: boolean | undefined; deferred: boolean }[] = [];
        function Above() {
          const r = boot.useClerkApiBootstrap();
          seen.push({
            loaded: r.authLoaded,
            signedIn: r.isSignedIn,
            deferred: auth.useDeferredAuth().authLoaded,
          });
          return null;
        }

        render(
          <ClerkProvider>
            <Above />
          </ClerkProvider>,
        );
        act(() => vi.advanceTimersByTime(10_000));

        expect(seen.every((s) => !s.loaded && !s.signedIn && !s.deferred)).toBe(true);
        expect(bridges.mounted).toBe(0);
      });

      it('let the editor beneath settle as the person, with no guest migration', async () => {
        localStorage.setItem('livediagram:v2:self-id', 'guest-1');
        const { ClerkProvider, WorkbenchAuthBridge, boot, core } = await load();
        let result: ReturnType<typeof boot.useClerkApiBootstrap> | null = null;
        function Editor() {
          result = boot.useClerkApiBootstrap();
          return null;
        }
        const page = (children: ReactNode) => (
          <ClerkProvider>
            <WorkbenchAuthBridge session={sessionOf()}>{children}</WorkbenchAuthBridge>
          </ClerkProvider>
        );

        render(page(<Editor />));
        await act(async () => {});

        expect(result).toEqual({
          isSignedIn: true,
          authLoaded: true,
          clerkUserId: 'user_1',
          clerkDisplayName: 'Webber',
        });
        expect(apiMigrateGuestData).not.toHaveBeenCalled();
        expect(await core.apiHeaders('user_1')).toEqual({ Authorization: `Bearer ${SECRET}` });
        core.setTokenProvider(null);
        core.setWorkbenchConfinement(null);
      });
    });
  }
});
