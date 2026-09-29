// @vitest-environment jsdom

// The Clerk bridge publishes the distilled auth state (docs/specs/014-identity/auth-and-guest-access.md):
// once per change of an auth field, with a delete-account action that always runs Clerk's newest
// reverified delete.

import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DeferredAuthState } from './deferred-auth';
import { ClerkBridge } from './ClerkBridge';

const clerk = vi.hoisted(() => ({
  reverified: (() => Promise.resolve()) as () => Promise<void>,
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
  useReverification: () => clerk.reverified,
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
    expect(onState.mock.lastCall![0].user?.pictureUrl).toBe(
      'https://img.clerk.com/google-picture?width=96&height=96&fit=crop',
    );
  });
});
