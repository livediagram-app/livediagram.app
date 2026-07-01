'use client';

// Explorer sign-in encouragement banner (spec/36). A floating,
// gradient bottom-of-screen card shown to guest visitors, with a
// primary Sign in CTA, a Learn more button that opens the reasons
// modal, and a dismiss control. Visibility (Clerk enabled, not signed
// in, not dismissed) + the bottom-padding reservation are decided by
// the host (ExplorerShell); this component just renders the card and
// owns the modal-open state. The host passes `onDismiss` so the
// dismissal is persisted (useDismissibleBanner) in one place.

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';
import { track } from '@/lib/telemetry';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { CloseIcon } from '@/components/primitives/CloseIcon';

// Lazy-load the reasons modal: the banner shows on every guest
// Explorer load, but the modal only matters once Learn more is
// clicked, so its content (and icon set) stays out of the eager
// Explorer chunk. Same pattern as AuthControls' DeleteAccountDialog.
const SignInReasonsModal = dynamic(() =>
  import('@/components/dialogs/SignInReasonsModal').then((m) => m.SignInReasonsModal),
);

// Per-device dismissal key, shared by every surface that mounts the
// banner (Explorer + editor, spec/36) so dismissing it in one place
// hides it in both.
export const SIGNIN_BANNER_DISMISS_KEY = 'livediagram:signin-banner-dismissed:v1';

// Positioning of the fixed wrapper, swapped per host. The Explorer lifts
// it above its 48px bottom bar (pb-16, like the editor's tab bar) and below
// the mobile-nav overlay (z-[var(--z-chrome)]); the editor lifts it above
// the 48px tab bar (pb-16) and over the canvas chrome (z-[var(--z-overlay)]).
const EXPLORER_PLACEMENT = 'bottom-0 z-[var(--z-chrome)] pb-16';

export function SignInBanner({
  onDismiss,
  placementClassName = EXPLORER_PLACEMENT,
}: {
  onDismiss: () => void;
  placementClassName?: string;
}) {
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const { signInHref } = useAuthHrefs();

  return (
    <>
      {/* pointer-events-none on the wrapper so the empty gutters never
          eat clicks meant for the pane behind; the card re-enables
          them for itself. */}
      <div
        className={`pointer-events-none fixed inset-x-0 flex justify-center px-4 ${placementClassName}`}
      >
        <div className="pointer-events-auto flex w-full max-w-3xl animate-fly-up-in flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500 to-brand-600 p-4 text-white shadow-2xl shadow-brand-900/30 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
          {/* Decorative glyph tile */}
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:flex">
            <SparkleIcon />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold sm:text-base">Sign in to keep your work safe</p>
            <p className="mt-0.5 text-xs text-white/85 sm:text-sm">
              Free account. Your diagrams sync across devices, survive a cache clear or browser
              restart, and carry your real name.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                track('UI', 'Opened', 'SignInReasons');
                setReasonsOpen(true);
              }}
              className="rounded-lg border border-white/40 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Learn more
            </button>
            <Link
              href={signInHref}
              onClick={() => track('UI', 'Selected', 'SignInBanner')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
            >
              <SignInIcon />
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => {
                track('UI', 'Closed', 'SignInBanner');
                onDismiss();
              }}
              aria-label="Dismiss"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Only mount once opened so the dynamic chunk fetches on the
          first Learn more click, not on every Explorer load. */}
      {reasonsOpen ? (
        <SignInReasonsModal
          open
          onClose={() => setReasonsOpen(false)}
          onSignIn={() => track('UI', 'Selected', 'SignInBanner')}
        />
      ) : null}
    </>
  );
}

function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 1.5 9.2 5.4 13 6.6 9.2 7.8 8 11.7 6.8 7.8 3 6.6 6.8 5.4 8 1.5Z" />
      <path d="M13 10.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9Z" />
    </svg>
  );
}

function SignInIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 3h3.5A1.5 1.5 0 0 1 14 4.5v7A1.5 1.5 0 0 1 12.5 13H9" />
      <path d="M2 8h7" />
      <path d="M6 5l3 3-3 3" />
    </svg>
  );
}
