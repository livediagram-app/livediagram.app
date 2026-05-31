'use client';

// Pieces shared between the sign-in (`/live/sign-in/`) and sign-up
// (`/live/get-started/`) pages. Without this, both pages held identical
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
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-lg shadow-slate-900/10">
          <div className="mb-8 text-center">
            <div className="mb-3 flex justify-center">
              <Brand href="/" />
            </div>
            <p className="text-sm text-slate-600">{subtitle}</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {children}

          {footer ? <p className="mt-6 text-center text-sm text-slate-600">{footer}</p> : null}
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
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <div className="rounded-xl border border-slate-200 bg-white px-8 py-6 text-center shadow-lg shadow-slate-900/10">
        <p className="text-sm text-slate-600">Redirecting…</p>
      </div>
    </div>
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
          className="h-12 w-10 rounded-md border border-slate-200 bg-white text-center text-lg font-semibold text-slate-900 transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
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
