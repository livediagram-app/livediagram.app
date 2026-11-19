'use client';

// "Signed out of <app> only" (`/signed-out-notice`; liveworkspace/docs/specs/003-accounts/accounts.md "Signing out",
// "Signed out of this app only"). A sign-out that couldn't end the liveworkspace session (the accounts site didn't
// answer, or there was no refresh token) signs out of this app alone; the page that signed out noted it in the tab
// before it left, and the page it lands on takes the note here, once, and says so under its account control. Light:
// a visitor's header draws it, so it loads no icon set and reads nothing until the page has hydrated.

import { useEffect, useState } from 'react';
import { takeSignedOutHere } from '@liveworkspace/auth-client/signed-out-here';
import { ACCOUNT_PALETTE } from './palette';

export const SIGNED_OUT_HERE_BODY =
  'Your liveworkspace account didn’t answer in time, so other apps in this browser may still be signed in. Sign out in each of them, or on liveworkspace.app.';

export const signedOutHereTitle = (app: string) => `Signed out of ${app} only`;

/** The notice, when this tab's last sign-out a moment ago was of `app` alone; nothing otherwise. Place it inside the
 *  account control's positioned box: it hangs under the control's right edge. */
export function SignedOutHereNotice({ app }: { app: string }) {
  const [shown, setShown] = useState(false);
  // After hydration (the static HTML can't know), once: the note is taken as it is read, so a second run of the
  // effect (React's development checks) finds none and leaves the notice up.
  useEffect(() => {
    if (takeSignedOutHere()) setShown(true);
  }, []);
  useEffect(() => {
    if (!shown) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShown(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown]);
  if (!shown) return null;
  return (
    <div
      role="status"
      data-signed-out-here=""
      className={`absolute top-full right-0 z-50 mt-2 flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-(--account-line) bg-(--account-surface) p-3 shadow-lg shadow-slate-900/10 ${ACCOUNT_PALETTE}`}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--account-tile) text-(--account-tile-ink)"
      >
        {/* Lucide's info, drawn inline: the notice loads no icon set. */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold text-(--account-ink)">{signedOutHereTitle(app)}</p>
        <p className="mt-1 text-xs leading-relaxed text-(--account-hint)">{SIGNED_OUT_HERE_BODY}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        onClick={() => setShown(false)}
        className="-mt-1 -mr-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-(--account-hint) transition-colors hover:bg-(--account-hover) hover:text-(--account-ink) focus-visible:bg-(--account-hover) focus-visible:text-(--account-ink) focus-visible:outline-none"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </div>
  );
}
