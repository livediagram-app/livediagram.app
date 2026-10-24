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
};

export type DeferredAuthState = {
  // True once auth has SETTLED: the bridge's chunk loaded and the api answered
  // for the session (or sign-in is off for the deployment, where there is
  // nothing to wait for).
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
  // Step-up auth ahead of anything irreversible: resolves true once the person has proved it is them
  // again, false when it was cancelled or failed. Account deletion runs it BEFORE the server data goes, so
  // a cancelled prompt deletes nothing. Absent when the session has no such step (the accounts Worker has
  // none yet).
  confirmIdentity?: () => Promise<boolean>;
};

// The "still loading" state, until the accounts bridge publishes the session.
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
export const DEFERRED_AUTH_PENDING: DeferredAuthState = {
  ...DEFERRED_AUTH_DEFAULT,
  authLoaded: false,
};

export const DeferredAuthContext = createContext<DeferredAuthState>(DEFERRED_AUTH_DEFAULT);

export function useDeferredAuth(): DeferredAuthState {
  return useContext(DeferredAuthContext);
}
