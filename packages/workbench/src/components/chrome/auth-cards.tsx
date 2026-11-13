'use client';

// The card the sign-in and sign-up pages render in, and the interstitial on the way to the accounts site, one copy
// for every editor. Each editor makes them once, at module scope, around its own Night Band frame (AuthStage, with
// its Brand) and account pitch (auth-pitches), in its components/chrome/auth-shared.tsx.

import type { ReactNode } from 'react';

export type AuthCardsDeps = {
  AuthStage: (props: {
    aside?: ReactNode;
    guestHref?: string | null;
    children: ReactNode;
  }) => ReactNode;
  // The page title's class (AuthStage's AUTH_TITLE).
  AUTH_TITLE: string;
  AccountPitch: () => ReactNode;
};

/** The auth pages' card and interstitial, made once per editor at module scope. */
export function createAuthCards({ AuthStage, AUTH_TITLE, AccountPitch }: AuthCardsDeps) {
  // ---------------------------------------------------------------------
  // Outer card layout
  // ---------------------------------------------------------------------

  // The card both auth pages render inside, on the Night Band frame
  // (docs/specs/014-identity/auth-and-guest-access.md "The look: Night
  // Band"): the page's title, an optional line under it, an optional
  // inline error or notice, and an optional footer link slot, beside the
  // account pitch. Keeps the two pages from drifting in spacing / colour /
  // shadow tokens. `pitch={false}` drops the pitch for the interstitials
  // such as Redirecting…, where "what an account adds" would mislead.
  function AuthCard({
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

  function RedirectingCard() {
    return (
      <AuthStage>
        <p className="text-center text-sm text-slate-600 dark:text-slate-400">Redirecting…</p>
      </AuthStage>
    );
  }

  return { AuthCard, RedirectingCard };
}
