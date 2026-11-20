'use client';

import { useDelayedReveal } from './useDelayedReveal';
import { useDismissibleBanner } from './useDismissibleBanner';

// How long a guest edits before the sign-in nudge appears (docs/specs/014-identity/sign-in-encouragement.md).
// Long enough that it never greets someone the instant they open their work; short enough to catch an invested
// session.
const SIGNIN_BANNER_DELAY_MS = 5 * 60_000;

// When the guest sign-in nudge is wanted (docs/specs/014-identity/sign-in-encouragement.md): about five minutes into
// the session, so it never interrupts someone the moment they open their work; never for an account, in an embed
// (read-only iframe, no `appChrome`), once dismissed in this browser or while `hidden` (zen mode). `hidden` is
// deliberately kept OUT of the timer's `enabled` so toggling it doesn't restart the countdown; it only hides the
// nudge. useSignInToast shows it.
export function useSignInNudge({
  dismissKey,
  accountUserId,
  appChrome,
  hidden,
}: {
  // The editor's own localStorage key for the dismissed nudge (kept from the banner it replaced).
  dismissKey: string;
  accountUserId: string | null | undefined;
  appChrome: boolean;
  hidden: boolean;
}): { showSignInNudge: boolean; dismissSignIn: () => void } {
  const { dismissed: signInDismissed, dismiss: dismissSignIn } = useDismissibleBanner(dismissKey);
  const signInTimerEnabled = !accountUserId && appChrome && !signInDismissed;
  const signInDelayElapsed = useDelayedReveal(SIGNIN_BANNER_DELAY_MS, signInTimerEnabled);
  const showSignInNudge = signInTimerEnabled && !hidden && signInDelayElapsed;
  return { showSignInNudge, dismissSignIn };
}
