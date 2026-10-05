import { clerkPublishableKeyOrNull } from '@livediagram/ui';

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
  // A fresh session token for the api's Authorization header; null when signed out.
  getToken: () => Promise<string | null>;
};

// The editor's sign-in page, returning here afterwards (it reads `redirect_url`).
export function signInHref(returnTo: string): string {
  return `/sign-in/?redirect_url=${encodeURIComponent(returnTo)}`;
}
