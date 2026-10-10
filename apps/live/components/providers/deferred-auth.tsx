'use client';

// The auth surface the app tree consumes INSTEAD of Clerk's hooks, so
// `@clerk/react` (~96 kB min / ~25 kB gz) stays out of every route's
// first load and out of the bundle entirely for embeds and Clerk-less
// self-hosts (docs/specs/002-project-scope/open-source-and-business-model.md/04: Clerk is optional and purely additive). The
// real Clerk provider mounts inside a lazily-loaded bridge
// (ClerkBridge) that publishes this state; until that chunk lands the
// defaults below describe exactly what Clerk-loading always looked
// like ("not settled yet"), which every consumer already handles.
//
// The auth PAGES (/sign-in, /get-started, /sso-callback) don't use
// this — Clerk IS the page there, so they import it statically via
// their own page-level provider (StaticClerkProvider).

import { createContext, useContext } from 'react';
import { clerkEnabled, clerkPublishableKey, e2eAuthEnabled } from '@/lib/clerk-config';

// The subset of the Clerk user the app actually renders (AuthControls
// menu, the Settings identity card, the bootstrap's display name).
type DeferredAuthUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  email: string | null;
  createdAt: Date | null;
  // The resolved profile picture (docs/specs/014-identity/profile-picture.md), or null for the
  // initials avatar.
  pictureUrl: string | null;
};

export type DeferredAuthState = {
  // True once auth has SETTLED: Clerk's chunk + clerk-js resolved the
  // session (or Clerk is disabled for the deployment, where there is
  // nothing to wait for). Mirrors Clerk's `isLoaded`.
  authLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: DeferredAuthUser | null;
  // Clerk's session-token getter; resolves null when signed out /
  // disabled. Identity is stable once published. `skipCache` mints a fresh
  // token instead of returning the cached one.
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>;
  signOut: (opts?: { redirectUrl?: string }) => Promise<void>;
  // Reverified account self-deletion (Clerk step-up auth modal +
  // user.delete). Null until the bridge publishes it / when disabled.
  deleteAccount: (() => Promise<void>) | null;
};

const clerkConfigured = (clerkEnabled && !!clerkPublishableKey) || e2eAuthEnabled;

// With Clerk disabled the defaults ARE the final state (settled guest
// mode); with Clerk enabled they are the "still loading" state.
export const DEFERRED_AUTH_DEFAULT: DeferredAuthState = {
  authLoaded: !clerkConfigured,
  isSignedIn: false,
  userId: null,
  user: null,
  getToken: async () => null,
  signOut: async () => {},
  deleteAccount: null,
};

// Auth held unsettled, whatever the deployment: what the workbench page's surroundings read
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "The editor in a workbench"), so nothing
// above the editor ever reads as a settled guest; the editor itself reads WorkbenchAuthBridge's state.
export const DEFERRED_AUTH_PENDING: DeferredAuthState = {
  ...DEFERRED_AUTH_DEFAULT,
  authLoaded: false,
};

export const DeferredAuthContext = createContext<DeferredAuthState>(DEFERRED_AUTH_DEFAULT);

export function useDeferredAuth(): DeferredAuthState {
  return useContext(DeferredAuthContext);
}
