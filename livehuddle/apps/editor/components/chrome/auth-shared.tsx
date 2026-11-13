'use client';

// Pieces shared between the sign-in (`/sign-in/`) and sign-up (`/get-started/`) pages: the card they render in,
// worn in this app's Night Band frame and account pitch, and the hand-off to the liveworkspace accounts site with the
// return-path rules (one copy for every editor, in the workbench).
import { isPostAuthPath } from '@liveworkspace/auth-client/return-path';
import { createAuthCards } from '@liveworkspace/workbench/components/chrome/auth-cards';
import { POST_AUTH_DEFAULT } from '@liveworkspace/workbench/components/chrome/auth-routes';
import { AUTH_TITLE, AuthStage } from './AuthStage';
import { AccountPitch } from './auth-pitches';

export * from '@liveworkspace/workbench/components/chrome/auth-routes';

export const { AuthCard, RedirectingCard } = createAuthCards({ AuthStage, AUTH_TITLE, AccountPitch });

// Where the header's "Not now, keep going as a guest" link goes (docs/specs/014-identity/auth-and-guest-access.md
// "The look: Night Band"): back to the page the visitor came from when that is safe, else the new-document flow.
// livehuddle has no signed-in-only connect pages (no OAuth consent or workbench pairing), so any safe page works for
// a guest; this one stands in for the shared rule, which keeps a guest off those pages.
export function guestReturnHref(searchParams: { get: (key: string) => string | null }): string {
  const redirect = searchParams.get('redirect_url');
  return isPostAuthPath(redirect) ? redirect : POST_AUTH_DEFAULT;
}
