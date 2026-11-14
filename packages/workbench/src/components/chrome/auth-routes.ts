'use client';

// The return-path half of the sign-in (`/sign-in/`) and sign-up (`/get-started/`) pages, one copy for every editor:
// the hand-off to the liveworkspace accounts site, and the rules that bring the visitor back where they started. Each
// editor's components/chrome/auth-shared.tsx re-exports it beside its own cards (auth-cards), which wear its brand.

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isPostAuthPath } from '@liveworkspace/auth-client/return-path';
import { API_BASE } from '../../lib/api/base';

// ---------------------------------------------------------------------
// An error's message for the person, or a fallback when it has none.
// ---------------------------------------------------------------------

export function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// ---------------------------------------------------------------------
// Post-auth destination resolution
//
// Both sign-in and sign-up accept a protected page's bounce as
// `?redirect_url=/<path>`. After verification the user should land back
// where they came from. Routes are now clean (no `/live` prefix — the
// router selects the editor app by route, docs/specs/016-platform/router-app.md), so destinations are
// plain same-origin paths. Validation rules:
//
//   - Must be a same-origin absolute PATH: starts with a single `/`,
//     NOT `//` or `/\` — those are protocol-relative / backslash
//     open-redirect tricks that browsers resolve to a foreign origin.
//   - Must NOT start with `/sign-in` or `/get-started` (loop guard:
//     bouncing back to the auth page after sign-in would cycle).
//   - Anything missing, unsafe, or pointing back at auth falls through
//     to the supplied default.
// ---------------------------------------------------------------------

// Sign-up / generic default: the welcome + create-new flow (`/new` used
// to be where bare `/live` redirected). NOT `/` — that's the marketing
// home now, not the app.
export const POST_AUTH_DEFAULT = '/new';

// Sign-in default: a returning user with no `?redirect_url` lands on
// their Explorer ("here's all your stuff") rather than the new-document
// welcome flow that suits a fresh sign-up. See docs/specs/014-identity/auth-and-guest-access.md.
export const POST_AUTH_SIGNIN_DEFAULT = '/explorer';

export function resolvePostAuthDestination(
  searchParams: { get: (key: string) => string | null },
  defaultDest: string = POST_AUTH_DEFAULT,
): string {
  const redirect = searchParams.get('redirect_url');
  return isPostAuthPath(redirect) ? redirect : defaultDest;
}

// Where the header's "Not now, keep going as a guest" link goes
// (docs/specs/014-identity/auth-and-guest-access.md "The look: Night Band"):
// back to the page the visitor came from when that is safe and works
// without an account, else the new-document flow. The connect pages
// (/oauth/*, /workbench/*) only work signed in, so returning a guest
// there would just bounce them straight back here.
const SIGNED_IN_ONLY = /^\/(oauth|workbench)(\/|\?|#|$)/i;
export function guestReturnHref(searchParams: { get: (key: string) => string | null }): string {
  const redirect = searchParams.get('redirect_url');
  return isPostAuthPath(redirect) && !SIGNED_IN_ONLY.test(redirect) ? redirect : POST_AUTH_DEFAULT;
}

// The hand-off to the accounts site: this app's api starts the sign-in and
// brings the browser back to `destination` once it is done
// (apps/api/src/routes/auth.ts). A full-page visit, never a fetch: the accounts
// site's own cookie can only be read there.
// `signUp` asks the accounts site for its registration page rather than its sign-in.
export function accountsSignInUrl(destination: string, signUp = false): string {
  const screen = signUp ? '&screen=sign-up' : '';
  return `${API_BASE}/auth/sign-in?return_to=${encodeURIComponent(destination)}${screen}`;
}

// ---------------------------------------------------------------------
// Building auth hrefs (the OTHER half of the round-trip)
//
// The resolvers above CONSUME `?redirect_url` on the auth pages. These
// build it, so every "Sign in" / "Create account" trigger sends the user
// back where they started after auth. Same param name, same safety rules
// (via isPostAuthPath) — an unsafe or auth-page `returnTo` is simply
// dropped, so the auth page falls back to its own default and we never
// seed a redirect loop or an open redirect.
// ---------------------------------------------------------------------

// Compose an auth-route href carrying a return path as `?redirect_url`.
export function authHrefWithReturn(
  authPath: '/sign-in/' | '/get-started/',
  returnTo: string | null | undefined,
): string {
  return isPostAuthPath(returnTo)
    ? `${authPath}?redirect_url=${encodeURIComponent(returnTo)}`
    : authPath;
}

// The visitor's current same-origin location (path + query + hash), for
// use as the auth return path. Recomputes on client navigation
// (usePathname) and on hash changes, so a Sign in click always carries
// the live location — including a document's `?query` and `#t=<tab>` hash
// so you land back on the exact tab. SSR / first paint has no `window`,
// so it starts at the bare pathname and upgrades on mount, well before
// any click.
function useAuthReturnPath(): string {
  const pathname = usePathname();
  const [returnTo, setReturnTo] = useState(pathname);
  useEffect(() => {
    const read = () =>
      setReturnTo(window.location.pathname + window.location.search + window.location.hash);
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [pathname]);
  return returnTo;
}

// Both auth hrefs wired to the current location, for the sign-in /
// create-account triggers. Cheap — destructure just the one you need.
export function useAuthHrefs(): { signInHref: string; signUpHref: string } {
  const returnTo = useAuthReturnPath();
  return {
    signInHref: authHrefWithReturn('/sign-in/', returnTo),
    signUpHref: authHrefWithReturn('/get-started/', returnTo),
  };
}
