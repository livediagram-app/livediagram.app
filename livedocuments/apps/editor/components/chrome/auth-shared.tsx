'use client';

// Pieces shared between the sign-in (`/sign-in/`) and sign-up
// (`/get-started/`) pages: the card they render in, the hand-off to the
// liveworkspace accounts site, and the return-path rules that bring the
// visitor back where they started.
//
// Lives in `components/` (not `packages/`) because the styling is
// app-specific (livedocuments brand colours, livedocuments Brand wordmark);
// no other workspace consumes it yet. If marketing later grows its
// own auth surface this can be promoted to `packages/ui`.

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { API_BASE } from '@/lib/api/base';
import { sameOriginPath } from '@/lib/same-origin-path';
import { AUTH_TITLE, AuthStage } from './AuthStage';
import { AccountPitch } from './auth-pitches';

// ---------------------------------------------------------------------
// Outer card layout
// ---------------------------------------------------------------------

// The card both auth pages render inside, on the Night Band frame
// (docs/specs/014-identity/auth-and-guest-access.md "The look: Night
// Band"): the page's title and an optional inline error, beside the
// account pitch. Keeps the two pages from drifting in spacing / colour /
// shadow tokens.
export function AuthCard({
  title,
  error,
  children,
  guestHref,
}: {
  title: string;
  error: string;
  children: ReactNode;
  // The header's "keep going as a guest" link (guestReturnHref); none hides it.
  guestHref?: string | null;
}) {
  return (
    <AuthStage aside={<AccountPitch />} guestHref={guestHref}>
      <div className="mb-6">
        <h1 className={AUTH_TITLE}>{title}</h1>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </div>
      ) : null}

      {children}
    </AuthStage>
  );
}

// ---------------------------------------------------------------------
// Interstitial — shown while the browser is on its way to the accounts
// site, and as the Suspense fallback for both pages. Same frame, no
// pitch, so a hand-off never flashes a different ground.
// ---------------------------------------------------------------------

export function RedirectingCard() {
  return (
    <AuthStage>
      <p className="text-center text-sm text-slate-600 dark:text-slate-400">Redirecting…</p>
    </AuthStage>
  );
}

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

// A redirect_url is safe iff it's a same-origin absolute path that isn't an
// auth page. sameOriginPath is the open-redirect guard: it also refuses the
// `\` and control-character tricks browsers normalise into `//host`.
function isSafeInternalPath(p: string | null | undefined): p is string {
  const safe = sameOriginPath(p);
  return (
    safe !== null &&
    safe === p &&
    !safe.toLowerCase().startsWith('/sign-in') &&
    !safe.toLowerCase().startsWith('/get-started')
  );
}

export function resolvePostAuthDestination(
  searchParams: { get: (key: string) => string | null },
  defaultDest: string = POST_AUTH_DEFAULT,
): string {
  const redirect = searchParams.get('redirect_url');
  return isSafeInternalPath(redirect) ? redirect : defaultDest;
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
  return isSafeInternalPath(redirect) && !SIGNED_IN_ONLY.test(redirect)
    ? redirect
    : POST_AUTH_DEFAULT;
}

// The hand-off to the accounts site: this app's api starts the sign-in and
// brings the browser back to `destination` once it is done
// (apps/api/src/routes/auth.ts). A full-page visit, never a fetch: the accounts
// site's own cookie can only be read there.
export function accountsSignInUrl(destination: string): string {
  return `${API_BASE}/auth/sign-in?return_to=${encodeURIComponent(destination)}`;
}

// ---------------------------------------------------------------------
// Building auth hrefs (the OTHER half of the round-trip)
//
// The resolvers above CONSUME `?redirect_url` on the auth pages. These
// build it, so every "Sign in" / "Create account" trigger sends the user
// back where they started after auth. Same param name, same safety rules
// (via isSafeInternalPath) — an unsafe or auth-page `returnTo` is simply
// dropped, so the auth page falls back to its own default and we never
// seed a redirect loop or an open redirect.
// ---------------------------------------------------------------------

// Compose an auth-route href carrying a return path as `?redirect_url`.
export function authHrefWithReturn(
  authPath: '/sign-in/' | '/get-started/',
  returnTo: string | null | undefined,
): string {
  return isSafeInternalPath(returnTo)
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
