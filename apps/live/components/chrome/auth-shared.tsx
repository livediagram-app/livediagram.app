'use client';

// Pieces shared between the sign-in (`/sign-in/`) and sign-up
// (`/get-started/`) pages. Without this, both pages held identical
// copies of the 6-digit code input, the Google glyph SVG, the
// "Redirecting…" interstitial, and the Clerk error-message parser —
// roughly 100 lines of literal copy-paste. CLAUDE.md's reuse rule is
// non-negotiable; both auth pages stay in sync as Clerk's API evolves.
//
// Lives in `components/` (not `packages/`) because the styling is
// app-specific (livediagram brand colours, livediagram Brand wordmark);
// no other workspace consumes it yet. If marketing later grows its
// own auth surface this can be promoted to `packages/ui`.

import { Brand } from '@livediagram/ui';
import type { MutableRefObject, ReactNode } from 'react';

// ---------------------------------------------------------------------
// Outer card layout
// ---------------------------------------------------------------------

// The full-bleed card that both auth pages render inside. Wraps the
// children in livediagram chrome: bg, centred Brand wordmark, optional
// subtitle, optional inline error, optional footer link slot. Keeps
// the two pages from drifting in spacing / colour / shadow tokens.
export function AuthCard({
  subtitle,
  error,
  children,
  footer,
}: {
  subtitle: string;
  error: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-8 text-center">
            <div className="mb-3 flex justify-center">
              <Brand href="/" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </div>
          ) : null}

          {children}

          {footer ? (
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Interstitial — shown while Clerk is redirecting an already-signed-in
// user, and as the Suspense fallback for both pages.
// ---------------------------------------------------------------------

export function RedirectingCard() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">Redirecting…</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Notice shown on the auth routes when Clerk isn't configured for the
// deployment (self-host path, no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).
// The editor still works — only sign-up / sign-in are off — so the
// CTA points back to the editor's welcome flow.
// ---------------------------------------------------------------------

export function AuthDisabledNotice() {
  return (
    <AuthCard subtitle="Sign-in isn't enabled on this deployment" error="">
      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        This livediagram instance is running in <strong>guest-only</strong> mode: the canvas works
        without an account. To enable sign-in, set{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800 dark:text-slate-200">
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        </code>{' '}
        at build time and redeploy.
      </p>
      <div className="mt-6 flex justify-center">
        <a
          href="/"
          className="inline-flex items-center rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
        >
          Continue as guest
        </a>
      </div>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------
// 6-digit code input — used by both the sign-in `first factor` and
// sign-up `email_address` verification flows. Auto-advances on type,
// back-deletes on backspace into an empty cell, and pastes a full
// code in one shot. Caller owns the digit state + refs so it can
// reset / refocus between submissions.
// ---------------------------------------------------------------------

export function CodeInputRow({
  codeDigits,
  setCodeDigits,
  inputRefs,
  onComplete,
}: {
  codeDigits: string[];
  setCodeDigits: (digits: string[]) => void;
  inputRefs: MutableRefObject<(HTMLInputElement | null)[]>;
  onComplete: (fullCode: string) => void;
}) {
  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={codeDigits[i]}
          className="h-12 w-10 rounded-md border border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(-1);
            const next = [...codeDigits];
            next[i] = v;
            setCodeDigits(next);
            if (v && i < 5) inputRefs.current[i + 1]?.focus();
            if (next.join('').length === 6) onComplete(next.join(''));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !codeDigits[i] && i > 0) {
              inputRefs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
            const next = ['', '', '', '', '', ''];
            for (let j = 0; j < pasted.length; j++) next[j] = pasted[j]!;
            setCodeDigits(next);
            inputRefs.current[Math.min(pasted.length, 5)]?.focus();
            if (pasted.length === 6) onComplete(next.join(''));
          }}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Google brand SVG. Same colours as the official "Sign in with Google"
// guidelines (4285F4 / 34A853 / FBBC05 / EA4335). Used by both pages'
// OAuth button.
// ---------------------------------------------------------------------

export function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------
// Clerk error shape parser. Clerk's API throws errors with shape
// `{ errors: [{ message: string }, ...] }`. This unwraps the array
// into a single comma-joined string, falling through to standard
// Error message handling, then to a caller-supplied fallback.
// ---------------------------------------------------------------------

export function messageOf(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'errors' in err) {
    const list = (err as { errors: Array<{ message: string }> }).errors;
    if (Array.isArray(list)) return list.map((e) => e.message).join(', ');
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// ---------------------------------------------------------------------
// Post-auth destination resolution
//
// Both sign-in and sign-up accept Clerk's protected-page bounce as
// `?redirect_url=/<path>`. After verification the user should land back
// where they came from. Routes are now clean (no `/live` prefix — the
// router selects the live app by route, spec/08), so destinations are
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
// their Explorer ("here's all your stuff") rather than the new-diagram
// welcome flow that suits a fresh sign-up. See spec/04.
export const POST_AUTH_SIGNIN_DEFAULT = '/explorer/recent';

// A redirect_url is safe iff it's a same-origin absolute path that
// isn't an auth page. The `//` / `/\` rejection is the open-redirect
// guard the old `/live`-prefix check used to provide implicitly.
function isSafeInternalPath(p: string | null | undefined): p is string {
  return (
    !!p &&
    p.startsWith('/') &&
    !p.startsWith('//') &&
    !p.startsWith('/\\') &&
    !p.toLowerCase().startsWith('/sign-in') &&
    !p.toLowerCase().startsWith('/get-started')
  );
}

export function resolvePostAuthDestination(
  searchParams: { get: (key: string) => string | null },
  defaultDest: string = POST_AUTH_DEFAULT,
): string {
  const redirect = searchParams.get('redirect_url');
  return isSafeInternalPath(redirect) ? redirect : defaultDest;
}

// OAuth form: Clerk's authenticateWithRedirect navigates the browser
// directly. With clean routing the completion URL is the SAME path as
// the router.push form (there's no basePath to add any more), so this
// just composes on top of resolvePostAuthDestination — the two helpers
// can't drift.
export function resolveOAuthCompleteUrl(
  searchParams: { get: (key: string) => string | null },
  defaultDest: string = POST_AUTH_DEFAULT,
): string {
  return resolvePostAuthDestination(searchParams, defaultDest);
}
