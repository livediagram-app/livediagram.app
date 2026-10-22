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

import { buttonClassName, ButtonContent } from '@livedocuments/ui';
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
// Band"): the page's title, an optional line under it, an optional
// inline error or notice, and an optional footer link slot, beside the
// account pitch. Keeps the two pages from drifting in spacing / colour /
// shadow tokens. `pitch={false}` drops the pitch for the interstitials
// and the guest-only notice, where "what an account adds" would mislead.
export function AuthCard({
  title,
  subtitle,
  error,
  notice,
  children,
  footer,
  guestHref,
  pitch = true,
}: {
  title: string;
  subtitle?: string;
  error: string;
  // Good news (a code was resent): a status, never the error box; an error wins over it.
  notice?: string;
  children: ReactNode;
  footer?: ReactNode;
  // The header's "keep going as a guest" link (guestReturnHref); none hides it.
  guestHref?: string | null;
  pitch?: boolean;
}) {
  return (
    <AuthStage aside={pitch ? <AccountPitch /> : undefined} guestHref={guestHref}>
      <div className="mb-6">
        <h1 className={AUTH_TITLE}>{title}</h1>
        {subtitle ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
        >
          {error}
        </div>
      ) : notice ? (
        <div
          role="status"
          className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          {notice}
        </div>
      ) : null}

      {children}

      {footer ? (
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</p>
      ) : null}
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
// Notice shown on the auth routes when sign-in isn't configured for the
// deployment (self-host path, NEXT_PUBLIC_SIGN_IN_ENABLED unset).
// The editor still works — only sign-up / sign-in are off — so the
// CTA points back to the editor's welcome flow.
// ---------------------------------------------------------------------

export function AuthDisabledNotice() {
  return (
    <AuthCard
      title="Sign-in is off here"
      subtitle="Sign-in isn't enabled on this deployment"
      error=""
      pitch={false}
    >
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        This livedocuments instance is running in <strong>guest-only</strong> mode: the canvas works
        without an account. To enable sign-in, set{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-900 dark:text-slate-200">
          NEXT_PUBLIC_SIGN_IN_ENABLED=true
        </code>{' '}
        at build time, configure the api&apos;s accounts settings, and redeploy.
      </p>
      <div className="mt-6 flex justify-center">
        <a href="/" className={buttonClassName({ size: 'md', className: 'shadow-sm' })}>
          <ButtonContent>Continue as guest</ButtonContent>
        </a>
      </div>
    </AuthCard>
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
// router selects the live app by route, docs/specs/016-platform/router-app.md), so destinations are
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
