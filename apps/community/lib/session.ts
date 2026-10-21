import { clerkPublishableKeyOrNull } from '@livediagram/ui/clerk-key';

// Who is signed in, for My Shares only (docs/specs/025-community/community.md "My Shares"). The rest of the
// Community needs no identity, so Clerk is loaded only once My Shares is chosen (components/auth), and on a
// build without a Clerk key (self-hosted, guest only) My Shares is not offered at all.

export const clerkPublishableKey = clerkPublishableKeyOrNull(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);
export const signInAvailable = clerkPublishableKey !== null;

export type CommunitySession = {
  loaded: boolean;
  signedIn: boolean;
  // Who is signed in (null signed out), so an answer for one account is never shown for another.
  userId: string | null;
  // A fresh session token for the api's Authorization header; null when signed out.
  getToken: () => Promise<string | null>;
};

// How long My Shares waits for Clerk to say who is signed in before it gives up and offers Try Again (a blocked
// script, a network failure): long enough for a slow connection, short enough not to look stuck.
export const SESSION_LOAD_TIMEOUT_MS = 10_000;

// The editor's sign-in page, returning here afterwards (it reads `redirect_url`).
export function signInHref(returnTo: string): string {
  return `/sign-in/?redirect_url=${encodeURIComponent(returnTo)}`;
}
