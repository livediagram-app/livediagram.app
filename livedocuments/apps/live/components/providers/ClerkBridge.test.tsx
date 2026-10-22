// @vitest-environment jsdom

// The Clerk bridge publishes the distilled auth state (docs/specs/014-identity/auth-and-guest-access.md):
// once per change of an auth field, with a delete-account action that always runs Clerk's newest
// reverified delete.

import { RECENT_DIAGRAMS_KEY } from '@livedocuments/api-schema';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DeferredAuthState } from './deferred-auth';
import { ClerkBridge } from './ClerkBridge';

const clerk = vi.hoisted(() => ({
  reverified: (() => Promise.resolve()) as () => Promise<void>,
  session: { checkAuthorization: (_: unknown): boolean => true },
  step: (fetcher: () => Promise<unknown>) => fetcher(),
  auth: { getToken: async () => 'jwt', isLoaded: true, isSignedIn: true, userId: 'u1' },
  signOut: async () => {},
  user: {
    id: 'u1',
    delete: async () => {},
    hasImage: false,
    imageUrl: 'https://img.clerk.com/default-avatar',
    externalAccounts: [{ provider: 'google', imageUrl: 'https://img.clerk.com/google-picture' }],
  },
}));
vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => clerk.auth,
  useUser: () => ({ user: clerk.user }),
  useClerk: () => ({ signOut: clerk.signOut }),
  // The delete's reverification is `reverified`; confirmIdentity's runs its fetcher, as Clerk's does when no
  // step-up is needed, unless a test stands in for the modal.
  useReverification: (fetcher: () => Promise<unknown>) =>
    fetcher.toString().includes('delete') ? clerk.reverified : () => clerk.step(fetcher),
  useSession: () => ({ session: clerk.session }),
}));
vi.mock('@/lib/clerk-config', () => ({ clerkPublishableKey: 'pk_test' }));

describe('ClerkBridge', () => {
  it('republishes only on auth changes, and deletes through the newest reverification', async () => {
    const onState = vi.fn<(s: DeferredAuthState) => void>();
    const { rerender } = render(<ClerkBridge onState={onState} />);
    expect(onState).toHaveBeenCalledTimes(1);
    expect(onState.mock.lastCall![0]).toMatchObject({
      authLoaded: true,
      isSignedIn: true,
      userId: 'u1',
    });

    const newest = vi.fn(async () => {});
    clerk.reverified = newest;
    rerender(<ClerkBridge onState={onState} />);
    expect(onState).toHaveBeenCalledTimes(1);

    await onState.mock.lastCall![0].deleteAccount!();
    expect(newest).toHaveBeenCalledOnce();
  });

  it('publishes the resolved profile picture (docs/specs/014-identity/profile-picture.md)', () => {
    const onState = vi.fn<(s: DeferredAuthState) => void>();
    render(<ClerkBridge onState={onState} />);
    expect(onState.mock.lastCall![0].user?.pictureUrl).toBe('https://img.clerk.com/google-picture');
  });

  // docs/specs/019-marketing/returning-visitor.md, "Forgotten on sign-out": the landing page sign-out
  // returns to must not show the account's recent diagrams.
  it('forgets the recent diagrams before signing out', async () => {
    localStorage.setItem(RECENT_DIAGRAMS_KEY, '{"v":1,"diagrams":[]}');
    const seenAtSignOut: (string | null)[] = [];
    clerk.signOut = async () => void seenAtSignOut.push(localStorage.getItem(RECENT_DIAGRAMS_KEY));
    const onState = vi.fn<(s: DeferredAuthState) => void>();
    render(<ClerkBridge onState={onState} />);

    await onState.mock.lastCall![0].signOut({ redirectUrl: '/' });

    expect(seenAtSignOut).toEqual([null]);
  });

  it('forgets the recent diagrams once the account is deleted', async () => {
    localStorage.setItem(RECENT_DIAGRAMS_KEY, '{"v":1,"diagrams":[]}');
    clerk.reverified = async () => {};
    const onState = vi.fn<(s: DeferredAuthState) => void>();
    render(<ClerkBridge onState={onState} />);

    await onState.mock.lastCall![0].deleteAccount!();

    expect(localStorage.getItem(RECENT_DIAGRAMS_KEY)).toBeNull();
  });

  // docs/specs/014-identity/auth-and-guest-access.md "Deleting an account"
  it('confirms identity: at once on a fresh session, through the step-up otherwise, false on a cancel', async () => {
    const onState = vi.fn<(s: DeferredAuthState) => void>();
    clerk.session = { checkAuthorization: () => true };
    render(<ClerkBridge onState={onState} />);
    expect(await onState.mock.lastCall![0].confirmIdentity!()).toBe(true);

    // No recent verification: the fetcher answers with Clerk's hint, which the real hook meets with its modal.
    clerk.session = { checkAuthorization: () => false };
    const hints: unknown[] = [];
    clerk.step = async (fetcher) => {
      hints.push(await fetcher());
      throw new Error('reverification_cancelled');
    };
    render(<ClerkBridge onState={onState} />);
    expect(await onState.mock.lastCall![0].confirmIdentity!()).toBe(false);
    expect(hints).toEqual([
      {
        clerk_error: {
          type: 'forbidden',
          reason: 'reverification-error',
          metadata: { reverification: 'strict' },
        },
      },
    ]);
  });
});
