'use client';

// Explorer sign-in encouragement banner (docs/specs/014-identity/sign-in-encouragement.md). A floating,
// gradient bottom-of-screen card shown to guest visitors, with a
// primary Sign in CTA, a Learn more button that opens the reasons
// modal, and a dismiss control. Visibility (Clerk enabled, not signed
// in, not dismissed) + the bottom-padding reservation are decided by
// the host (ExplorerShell); this component just renders the card and
// owns the modal-open state. The host passes `onDismiss` so the
// dismissal is persisted (useDismissibleBanner) in one place.

import dynamic from 'next/dynamic';
import { CloseIcon, SparkleIcon } from '@liveplanner/ui';
import { SignInIcon } from '@/components/chrome/AuthControls';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { announceToastFloorChange, BOTTOM_CHROME_SELECTOR } from '@/components/toast/toast-floor';
import { useChromeFloor } from '@/components/toast/useToastFloor';
import { track } from '@/lib/telemetry';
import { useAuthHrefs } from '@/components/chrome/auth-shared';

// Lazy-load the reasons modal: the banner shows on every guest
// Explorer load, but the modal only matters once Learn more is
// clicked, so its content (and icon set) stays out of the eager
// Explorer chunk. Same pattern as AuthControls' DeleteAccountDialog.
const SignInReasonsModal = dynamic(
  () => import('@/components/dialogs/SignInReasonsModal').then((m) => m.SignInReasonsModal),
  { ssr: false },
);

// Per-device dismissal key, shared by every surface that mounts the
// banner (Explorer + editor, docs/specs/014-identity/sign-in-encouragement.md) so dismissing it in one place
// hides it in both.
export const SIGNIN_BANNER_DISMISS_KEY = 'liveplanner:signin-banner-dismissed:v1';

// Positioning of the fixed wrapper, swapped per host. The Explorer lifts
// it above its 48px bottom bar (pb-16, like the editor's tab bar) and below
// the mobile-nav overlay (z-[var(--z-chrome)]); the editor lifts it above
// the 48px tab bar (pb-16) and over the canvas chrome (z-[var(--z-overlay)]).
const EXPLORER_PLACEMENT = 'bottom-0 z-[var(--z-chrome)] pb-16';
// The card's widest (`max-w-3xl`): the column that has to clear the chrome beneath it.
const BANNER_MAX_WIDTH_PX = 768;

export function SignInBanner({
  surface,
  onDismiss,
  placementClassName = EXPLORER_PLACEMENT,
  standOnChrome = false,
}: {
  // Which host mounted it, carried on every telemetry type (docs/specs/014-identity/sign-in-encouragement.md) so the
  // dashboard can tell an Explorer prompt from an editor one.
  surface: 'Explorer' | 'Editor';
  onDismiss: () => void;
  placementClassName?: string;
  // The editor's banner stands 8px above its bottom chrome (the tab bar, the Undo / Timer / Vote / Poll cluster, the
  // whiteboard dock) instead of a fixed lift, so it never covers a control somebody is running a session with.
  standOnChrome?: boolean;
}) {
  const chromeFloor = useChromeFloor(standOnChrome, 0, BOTTOM_CHROME_SELECTOR, BANNER_MAX_WIDTH_PX);
  const [reasonsOpen, setReasonsOpen] = useState(false);
  const editor = surface === 'Editor';
  const trackSignIn = () =>
    track('UI', 'Selected', editor ? 'SignInBannerEditor' : 'SignInBannerExplorer');
  const { signInHref } = useAuthHrefs();
  // The toasts stand on the card (docs/specs/004-interface-design/toasts.md "Placement"): it is
  // `data-toast-floor`, and says when it comes and goes so a toast already up moves with it.
  useEffect(() => {
    announceToastFloorChange();
    return announceToastFloorChange;
  }, []);

  return (
    <>
      {/* pointer-events-none on the wrapper so the empty gutters never
          eat clicks meant for the pane behind; the card re-enables
          them for itself. */}
      <div
        // Steps aside while a tour's offer or last card is up (both stand at the bottom centre, TourPopover) and while a
        // panel opened from the chrome is open (Tidy Up, Layers, the Explorer panel), which reaches up into its band.
        className={`pointer-events-none fixed inset-x-0 flex justify-center px-4 [body[data-tour-card-open]_&]:hidden [body:has([data-dock-button]_[aria-expanded=true])_&]:hidden ${placementClassName}`}
        style={standOnChrome ? { bottom: chromeFloor } : undefined}
      >
        <div
          data-toast-floor=""
          // brand-700 to brand-800 in light and dark alike: white reads on them at 5.9:1 and 7.6:1, and the copy at 90%
          // white at 5.1:1 (docs/specs/004-interface-design/color-scheme.md). brand-500 and brand-600 drew it at 2.8:1
          // and 4.1:1.
          className="pointer-events-auto flex w-full max-w-3xl animate-fly-up-in flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-brand-800 bg-gradient-to-br from-brand-700 to-brand-800 p-4 text-white shadow-2xl shadow-brand-900/30 sm:flex-row sm:items-center sm:gap-4 sm:px-5 landscape-phone:py-2"
        >
          {/* Decorative glyph tile */}
          <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:flex">
            <SparkleIcon size={20} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold sm:text-base">Sign in to access Teams &amp; AI</p>
            {/* A sideways phone has little height to give: the headline and the buttons say enough. */}
            <p className="mt-0.5 text-xs text-white/90 sm:text-sm landscape-phone:hidden">
              Share with your team, build with AI, sync across devices.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                track('UI', 'Opened', editor ? 'SignInReasonsEditor' : 'SignInReasonsExplorer');
                setReasonsOpen(true);
              }}
              className="rounded-lg border border-white/40 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Learn more
            </button>
            <Link
              href={signInHref}
              onClick={trackSignIn}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50 dark:text-brand-700"
            >
              <SignInIcon size={14} />
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => {
                track('UI', 'Closed', editor ? 'SignInBannerEditor' : 'SignInBannerExplorer');
                onDismiss();
              }}
              aria-label="Dismiss"
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Only mount once opened so the dynamic chunk fetches on the
          first Learn more click, not on every Explorer load. */}
      {reasonsOpen ? (
        <SignInReasonsModal open onClose={() => setReasonsOpen(false)} onSignIn={trackSignIn} />
      ) : null}
    </>
  );
}
