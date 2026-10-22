'use client';

// Persistence-model prompt shown inside the Explorer. Present for guest
// sessions so the user understands their documents are browser-local
// until they sign in; rendered shape depends on what the deployment
// supports:
//
//   - Clerk disabled, any session
//        → "No sign-in on this deployment": the documents are saved, but
//          only this browser's guest id can open them.
//
//   - Clerk enabled, signed out
//        → "Sign in to keep your documents across devices." + CTA to
//          /live/sign-in/.
//
//   - Clerk enabled, signed in
//        → renders nothing (the user already has the account that
//          syncs everything).
//
// The prompt carries a dismiss (X) so a user who's made their peace
// with browser-local storage can reclaim the panel space; the choice
// persists per-browser in localStorage (same degradation contract as
// the other persisted toggles — see local-storage-safe).
//
// Same module-load enabled/disabled hook-swap pattern as
// AuthControls and useClerkApiBootstrap — calling useAuth outside a
// ClerkProvider would throw, so the disabled branch never touches
// Clerk.

import { useSyncExternalStore } from 'react';
import { buttonClassName, CloseIcon, ButtonContent } from '@livedocuments/ui';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import Link from 'next/link';
import { useAuthHrefs } from '@/components/chrome/auth-shared';
import { clerkEnabled } from '@/lib/clerk-config';
import { useLocalStorageValue, writeLocalStorageValue } from '@/hooks/ui/useLocalStorageValue';

const DISMISS_KEY = 'livedocuments:v2:signin-prompt-dismissed';

const subscribeNever = () => () => {};

// Per-browser dismissal. Returns `null` until the render after hydration,
// the first that may read localStorage, so the prompt never flashes in for a
// user who already closed it (the SSR/export build and the hydrating render
// both resolve to `null` → render nothing). `dismiss` writes the flag and
// hides immediately.
function usePromptDismissed(): { dismissed: boolean | null; dismiss: () => void } {
  const stored = useLocalStorageValue(DISMISS_KEY);
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const dismiss = () => writeLocalStorageValue(DISMISS_KEY, 'true');
  return { dismissed: hydrated ? stored === 'true' : null, dismiss };
}

function PromptShell({
  title,
  body,
  action,
  onDismiss,
  bar = false,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  onDismiss: () => void;
  // One quiet line (the editor's Explorer, under its Current Document card): the title as a lead-in, the action, the
  // dismiss.
  bar?: boolean;
}) {
  if (bar)
    return (
      <div
        data-signin-bar=""
        className="flex items-center gap-3 rounded-lg bg-amber-50/70 py-1.5 pl-3 pr-1.5 text-xs ring-1 ring-amber-200/70 dark:bg-amber-500/10 dark:ring-amber-400/25"
      >
        <p className="min-w-0 flex-1 leading-snug text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-800 dark:text-white">{title}.</span>{' '}
          {/* On a phone a note with an action keeps to its title and the action, so it stays one line. */}
          <span className={action ? 'max-sm:hidden' : undefined}>{body}</span>
        </p>
        {action}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="relative flex h-6 w-6 shrink-0 touch-target cursor-pointer items-center justify-center rounded text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-100"
        >
          <CloseIcon size={12} />
        </button>
      </div>
    );
  return (
    <div className="relative rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 flex h-5 w-5 touch-target items-center justify-center rounded text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
      >
        <CloseIcon size={12} />
      </button>
      {/* pr-5 keeps the title clear of the close button. */}
      <p className="pr-5 font-medium text-slate-800 dark:text-white">{title}</p>
      <p className="mt-1 leading-relaxed text-slate-500 dark:text-slate-200">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

// `fallback` is rendered in the prompt's slot once it has settled into a
// state where the prompt itself doesn't show (signed in, or the user has
// dismissed it). The Explorer passes its "Open Explorer" button here so
// the two never occupy the panel at once but the button still surfaces
// for dismissed guests. While Clerk / the dismissal read are still
// loading we render nothing, so the fallback doesn't flash in before the
// prompt has a chance to claim the slot.
// `bar`: the one-line form (the editor's Explorer, under its Current Document card).
type SignInPromptProps = { fallback?: React.ReactNode; bar?: boolean };

function SignInPromptEnabled({ fallback, bar = false }: SignInPromptProps) {
  const { authLoaded: isLoaded, isSignedIn } = useDeferredAuth();
  const { dismissed, dismiss } = usePromptDismissed();
  const { signInHref } = useAuthHrefs();
  if (!isLoaded || dismissed === null) return null;
  if (isSignedIn || dismissed) return <>{fallback ?? null}</>;
  return (
    <PromptShell
      bar={bar}
      title={bar ? 'Keep your work' : 'Sign in to keep your content'}
      body={
        bar
          ? 'A free account saves it across devices.'
          : 'A free account keeps your documents and content across sessions and devices.'
      }
      onDismiss={dismiss}
      action={
        <Link
          href={signInHref}
          className={buttonClassName({
            size: 'xs',
            className: bar ? 'shrink-0 shadow-sm' : 'w-full shadow-sm',
          })}
        >
          <ButtonContent>Sign in</ButtonContent>
        </Link>
      }
    />
  );
}

function SignInPromptDisabled({ fallback, bar = false }: SignInPromptProps) {
  const { dismissed, dismiss } = usePromptDismissed();
  if (dismissed === null) return null;
  if (dismissed) return <>{fallback ?? null}</>;
  return (
    <PromptShell
      bar={bar}
      // The documents are saved on the server ("Private" on the card), but without sign-in they belong to this
      // browser's guest id: what clearing site data loses is the way back to them. Never "Browser only", which is
      // what a This Browser document is.
      title={bar ? 'No sign-in here' : 'No sign-in on this deployment'}
      body={
        bar
          ? 'Only this browser can open your documents.'
          : 'Your documents are saved, but only this browser can open them. Clear its site data and you lose them.'
      }
      onDismiss={dismiss}
    />
  );
}

export const SignInPrompt = clerkEnabled ? SignInPromptEnabled : SignInPromptDisabled;
