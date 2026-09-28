// @vitest-environment jsdom

// A round trip through an auth page must not leave the app on a stale
// "settled" auth state (docs/specs/014-identity/auth-and-guest-access.md). The email-code sign-in
// returns with a soft navigation, keeping this provider mounted; if the
// bridge's last published guest state survived, the editor booted without
// waiting for the guest-data migration and 404'd the diagram until a refresh.

import { act, cleanup, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFERRED_AUTH_DEFAULT, useDeferredAuth, type DeferredAuthState } from './deferred-auth';

let pathname = '/diagram/abc';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('@/lib/clerk-config', () => ({ clerkEnabled: true, clerkPublishableKey: 'pk_test' }));

// The lazily-loaded bridge, standing in for Clerk: publishes a settled guest.
const GUEST: DeferredAuthState = { ...DEFERRED_AUTH_DEFAULT, authLoaded: true, isSignedIn: false };
vi.mock('next/dynamic', () => ({
  default: () =>
    function FakeBridge({ onState }: { onState: (s: DeferredAuthState) => void }) {
      useEffect(() => onState(GUEST), [onState]);
      return null;
    },
}));

const { ClerkProvider } = await import('./ClerkProvider');

afterEach(cleanup);

describe('ClerkProvider across an auth page', () => {
  it('starts the return trip "not settled", not on the stale guest state', () => {
    const seen: boolean[] = [];
    function Probe() {
      seen.push(useDeferredAuth().authLoaded);
      return null;
    }
    const tree = () => (
      <ClerkProvider>
        <Probe />
      </ClerkProvider>
    );
    const { rerender } = render(tree());
    expect(seen.at(-1)).toBe(true); // the bridge settled as a guest

    pathname = '/sign-in';
    act(() => rerender(tree()));
    expect(seen.at(-1)).toBe(false); // bridge stood down: reset

    // Back in the app. Every render before the bridge republishes must read
    // "not settled", so the editor waits for auth (and the migration).
    seen.length = 0;
    pathname = '/diagram/abc';
    rerender(tree());
    expect(seen[0]).toBe(false);
  });
});
