'use client';

// The guest sign-in toast (docs/specs/014-identity/sign-in-encouragement.md), one for every editor: a standing,
// highlighted (solid green) toast on the one shared toast (liveworkspace/docs/specs/016-notifications/toasts.md), raised when useSignInNudge
// says the nudge is wanted, with Sign In as its one action. Sign In goes to the editor's sign-in page, back here
// after; closing it keeps it away in this browser (the editor's dismiss key, the one its banner used). When the nudge
// stops being wanted (signed in, zen mode, the editor closing), the toast is taken down by its key.
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { workbench } from '../../bindings';
import { useAuthHrefs } from '../../components/chrome/auth-routes';
import { useSignInNudge } from './useSignInNudge';
import { useToast } from './useToast';

const SIGN_IN_TOAST_KEY = 'sign-in';

/** The toast's words, the owner's, the same in every editor (2026-11-20): short enough to sit on one line beside
 *  Sign In at a toast's usual widest (576px), so every toast keeps one width. A phone may wrap it. */
export const SIGN_IN_TOAST_MESSAGE = 'Sign in to get Teams, AI & even more powerful features.';

// The telemetry type both events carry: the banner's editor one, so its series carries on.
const SIGN_IN_TOAST_TYPE = 'SignInBannerEditor';

export function useSignInToast({
  dismissKey,
  accountUserId,
  appChrome,
  hidden,
}: {
  // The editor's own localStorage key for the dismissed nudge.
  dismissKey: string;
  accountUserId: string | null | undefined;
  appChrome: boolean;
  // Zen mode: hides the toast without restarting the delay.
  hidden: boolean;
}): void {
  const { showSignInNudge, dismissSignIn } = useSignInNudge({
    dismissKey,
    accountUserId,
    appChrome,
    hidden,
  });
  const toast = useToast();
  const router = useRouter();
  const { signInHref } = useAuthHrefs();
  // The latest of each, read when the toast is answered, so a new return path never re-raises it.
  const latest = useRef({ router, signInHref, dismissSignIn });
  useEffect(() => {
    latest.current = { router, signInHref, dismissSignIn };
  });

  useEffect(() => {
    if (!showSignInNudge) return;
    toast.action({
      key: SIGN_IN_TOAST_KEY,
      message: SIGN_IN_TOAST_MESSAGE,
      sticky: true,
      highlight: true,
      actions: [
        {
          label: 'Sign In',
          ariaLabel: 'Sign In',
          onSelect: () => {
            workbench.track('UI', 'Selected', SIGN_IN_TOAST_TYPE);
            latest.current.router.push(latest.current.signInHref);
          },
        },
      ],
      onDismiss: () => {
        workbench.track('UI', 'Closed', SIGN_IN_TOAST_TYPE);
        latest.current.dismissSignIn();
      },
    });
    return () => toast.dismissAction(SIGN_IN_TOAST_KEY);
  }, [showSignInNudge, toast]);
}
