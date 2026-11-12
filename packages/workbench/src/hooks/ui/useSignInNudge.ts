'use client';

import { useDelayedReveal } from './useDelayedReveal';
import { useDismissibleBanner } from './useDismissibleBanner';

// How long a guest edits before the sign-in nudge appears (docs/specs/014-identity/sign-in-encouragement.md).
// Long enough that it never greets someone the instant they open their work; short enough to catch an invested
// session.
const SIGNIN_BANNER_DELAY_MS = 5 * 60_000;

// Guest sign-in nudge (docs/specs/014-identity/sign-in-encouragement.md): the same banner the Explorer shows,
// but on the editor it waits ~5 minutes into the session before
// appearing so it never interrupts someone the moment they open their work. Hidden in embed (read-only iframe,
// no `appChrome`) and while `hidden` (zen mode). `hidden` is deliberately kept OUT of the timer's `enabled` so
// toggling it doesn't restart the countdown; it only hides the card at render.
export function useSignInNudge({
  dismissKey,
  accountUserId,
  appChrome,
  hidden,
}: {
  // The editor's own localStorage key for the dismissed banner (its SIGNIN_BANNER_DISMISS_KEY).
  dismissKey: string;
  accountUserId: string | null | undefined;
  appChrome: boolean;
  hidden: boolean;
}): { showSignInBanner: boolean; dismissSignIn: () => void } {
  const { dismissed: signInDismissed, dismiss: dismissSignIn } = useDismissibleBanner(dismissKey);
  const signInTimerEnabled = !accountUserId && appChrome && !signInDismissed;
  const signInDelayElapsed = useDelayedReveal(SIGNIN_BANNER_DELAY_MS, signInTimerEnabled);
  const showSignInBanner = signInTimerEnabled && !hidden && signInDelayElapsed;
  return { showSignInBanner, dismissSignIn };
}
