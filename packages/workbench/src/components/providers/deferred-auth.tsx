'use client';

// The auth surface the app tree consumes. The session itself comes from a
// lazily-loaded bridge (AccountsBridge, via AuthProvider) that publishes this
// state; until it lands the defaults below describe "not settled yet", which
// every consumer already handles.

import { createContext, useContext } from 'react';

// The subset of the account the app actually renders (AuthControls
// menu, the Settings identity card, the bootstrap's display name).
type DeferredAuthUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  email: string | null;
  createdAt: Date | null;
  // The account's Google picture (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"), for the person's own avatar;
  // absent or null without one. `pictureHidden`: Show My Google Picture is off, so presence leaves it out.
  picture?: string | null;
  pictureHidden?: boolean;
};

export type DeferredAuthState = {
  // True once auth has SETTLED: the bridge's chunk loaded and the api answered
  // for the session.
  authLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  user: DeferredAuthUser | null;
  // The access-token getter; resolves null when signed out / disabled.
  // Identity is stable once published. `skipCache` refreshes instead of
  // returning the held token.
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>;
  signOut: (opts?: { redirectUrl?: string }) => Promise<void>;
  // Ends the session after the api has deleted the account's data
  // (DeleteAccountDialog). Null until the bridge publishes it / when disabled.
  deleteAccount: (() => Promise<void>) | null;
};

// The "still loading" state, until the bridge publishes the session.
export const DEFERRED_AUTH_DEFAULT: DeferredAuthState = {
  authLoaded: false,
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
// A distinct object from the default, which useAccountBootstrap tells apart by identity.
export const DEFERRED_AUTH_PENDING: DeferredAuthState = {
  ...DEFERRED_AUTH_DEFAULT,
  authLoaded: false,
};

export const DeferredAuthContext = createContext<DeferredAuthState>(DEFERRED_AUTH_DEFAULT);

export function useDeferredAuth(): DeferredAuthState {
  return useContext(DeferredAuthContext);
}
