'use client';

// Pieces shared between the sign-in (`/sign-in/`) and sign-up
// (`/get-started/`) pages. Without this, both pages held identical
// copies of the 6-digit code input, the Google glyph SVG, the
// "Redirecting…" interstitial, and the Clerk error-message parser —
// roughly 100 lines of literal copy-paste. AGENTS.md's reuse rule is
// non-negotiable; both auth pages stay in sync as Clerk's API evolves.
//
// Lives in `components/` (not `packages/`) because the styling is
// app-specific (liveplanner brand colours, liveplanner Brand wordmark);
// no other workspace consumes it yet. If marketing later grows its
// own auth surface this can be promoted to `packages/ui`.

import { Button, buttonClassName, TextInput, ButtonContent } from '@liveplanner/ui';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type MutableRefObject, type ReactNode } from 'react';
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
// Interstitial — shown while Clerk is redirecting an already-signed-in
// user, and as the Suspense fallback for both pages. Same frame, no
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
// Notice shown on the auth routes when Clerk isn't configured for the
// deployment (no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY).
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
        This liveplanner instance is running in <strong>guest-only</strong> mode: the canvas works
        without an account. To enable sign-in, set{' '}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-900 dark:text-slate-200">
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
        </code>{' '}
        at build time and redeploy.
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
// 6-digit code input — used by both the sign-in `first factor` and
// sign-up `email_address` verification flows. Auto-advances on type,
// back-deletes on backspace into an empty cell, and pastes a full
// code in one shot. Caller owns the digit state + refs so it can
// reset / refocus between submissions.
// ---------------------------------------------------------------------

function CodeInputRow({
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
          className="h-13 w-11 rounded-lg border border-slate-200 bg-white text-center text-xl font-semibold text-slate-900 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-500/30"
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
// The email-code verification step
// ---------------------------------------------------------------------

// Phase two of both flows: the code has been sent, and the user types
// it in. Sign-in and sign-up had literally the same form here — the
// "we sent a code to <email>" line, the CodeInputRow, the Verify
// button and its 6-digit gate, and the Resend / Back row.
//
// Only two things ever differed, and both are passed in. `ready` is
// the page's Clerk object (`clerkSignIn` / `clerkSignUp`), which the
// auto-submit checks before firing so a completed code cannot submit
// against an SDK that has not loaded. `onBack` differs because the two
// pages return to different places: sign-in drops the code step, while
// sign-up steps its phase counter back.
export function EmailCodeStep({
  email,
  codeDigits,
  setCodeDigits,
  inputRefs,
  loading,
  ready,
  onSubmit,
  onResend,
  onBack,
}: {
  email: string;
  codeDigits: string[];
  setCodeDigits: (digits: string[]) => void;
  inputRefs: MutableRefObject<(HTMLInputElement | null)[]>;
  loading: boolean;
  // Truthy once the page's Clerk object is available.
  ready: unknown;
  // Takes the code directly on auto-submit, since the sixth keystroke
  // fires before the state holding it has been committed.
  onSubmit: (e: React.FormEvent, code?: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        We sent a verification code to{' '}
        <strong className="text-slate-900 dark:text-slate-100">{email}</strong>. Enter it below.
      </p>
      <CodeInputRow
        codeDigits={codeDigits}
        setCodeDigits={setCodeDigits}
        inputRefs={inputRefs}
        onComplete={(full) => {
          if (!loading && ready) {
            onSubmit({ preventDefault: () => {} } as React.FormEvent, full);
          }
        }}
      />
      <Button
        type="submit"
        size="md"
        disabled={loading || codeDigits.join('').length !== 6}
        className="w-full shadow-sm"
      >
        {loading ? 'Verifying…' : 'Verify'}
      </Button>
      <div className="flex justify-between text-sm">
        <button
          type="button"
          onClick={onResend}
          disabled={loading}
          className="text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Resend code
        </button>
        <button
          type="button"
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Back
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
// Google brand SVG. Same colours as the official "Sign in with Google"
// guidelines (4285F4 / 34A853 / FBBC05 / EA4335). Used by both pages'
// OAuth button.
// ---------------------------------------------------------------------

function GoogleGlyph() {
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
// Google OAuth button + "or" divider — the block both auth pages render
// above their email form. Was duplicated in sign-in and get-started,
// and both copies were light-only: on the dark card the slate-700 label
// read as a disabled button and the divider's bg-white chip floated as
// a light box.
// ---------------------------------------------------------------------

// The email input both pages open with. Identical down to the placeholder and
// the autocomplete hint, and the `id`/`htmlFor` pairing is the reason it is
// worth a component rather than two copies: a label that stops matching its
// input is invisible until somebody uses a screen reader.
//
// The last piece of these two pages that had not been lifted here. The 6-digit
// code input, the Google glyph, the interstitial and the error parser all were;
// this one stayed behind because it is short, which is exactly how a
// divergence gets in.
export function AuthEmailField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor="email"
        className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
      >
        Email
      </label>
      <TextInput
        id="email"
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
      />
    </div>
  );
}

export function GoogleAuthButton({
  label,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-white/5 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-white/10"
    >
      {loading ? (
        <span className="text-slate-500 dark:text-slate-400">Redirecting…</span>
      ) : (
        <>
          <GoogleGlyph />
          {label}
        </>
      )}
    </button>
  );
}

export function OrDivider() {
  // Two rules either side of the word rather than a chip over one rule: the card is
  // translucent now, so a filled chip would show as a box.
  return (
    <div className="flex items-center gap-3 text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      or
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
    </div>
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
    // Clerk's `longMessage` is the sentence written for people ("Enter a valid email address."); `message` is
    // its terse form ("is invalid"), so it is only the fallback.
    const list = (err as { errors: Array<{ message?: string; longMessage?: string }> }).errors;
    if (Array.isArray(list)) {
      const joined = list
        .map((e) => e.longMessage || e.message)
        .filter(Boolean)
        .join(', ');
      // An empty list still failed: say so rather than show no error at all.
      return joined || fallback;
    }
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

// The OAuth round-trip's callback URL, carrying a valid `?redirect_url` on.
// `redirectUrlComplete` only covers a round-trip Clerk finishes on its own;
// one that ends on /sso-callback (a Google sign-in Clerk turns into a
// sign-up, an extra step) navigates from that page instead, so the
// destination has to travel there too or the user lands on a default and
// loses where they were going (an MCP consent, issue #612).
const SSO_CALLBACK_PATH = '/sso-callback';
export function ssoCallbackUrl(searchParams: { get: (key: string) => string | null }): string {
  const redirect = searchParams.get('redirect_url');
  return isSafeInternalPath(redirect)
    ? `${SSO_CALLBACK_PATH}?redirect_url=${encodeURIComponent(redirect)}`
    : SSO_CALLBACK_PATH;
}

// Where /sso-callback sends a finished round-trip: the carried
// `?redirect_url` when it is safe, else nothing, leaving the callback's own
// per-flow defaults (Explorer after sign-in, /new after sign-up) in charge.
export function ssoCallbackDestination(searchParams: {
  get: (key: string) => string | null;
}): string | undefined {
  const redirect = searchParams.get('redirect_url');
  return isSafeInternalPath(redirect) ? redirect : undefined;
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
