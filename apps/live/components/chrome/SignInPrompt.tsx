'use client';

// Persistence-model prompt shown inside the Explorer. Present for guest
// sessions so the user understands their diagrams are browser-local
// until they sign in; rendered shape depends on what the deployment
// supports:
//
//   - Clerk disabled, any session
//        → "Diagrams are saved to this browser only — sign-in isn't
//          enabled on this deployment."
//
//   - Clerk enabled, signed out
//        → "Sign in to keep your diagrams across devices." + CTA to
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

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { CloseIcon } from '@/components/primitives/CloseIcon';
import Link from 'next/link';
import { clerkEnabled } from '@/lib/clerk-config';
import { readLocalStorageSafe, writeLocalStorageSafe } from '@/lib/local-storage-safe';

const DISMISS_KEY = 'livediagram:v2:signin-prompt-dismissed';

// Per-browser dismissal. Returns `null` until the first client effect
// has read localStorage so the prompt never flashes in for a user who
// already closed it (the initial render and the SSR/export build both
// resolve to `null` → render nothing, then the effect settles the real
// value). `dismiss` writes the flag and hides immediately.
function usePromptDismissed(): { dismissed: boolean | null; dismiss: () => void } {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    setDismissed(readLocalStorageSafe(DISMISS_KEY) === 'true');
  }, []);
  const dismiss = () => {
    writeLocalStorageSafe(DISMISS_KEY, 'true');
    setDismissed(true);
  };
  return { dismissed, dismiss };
}

function PromptShell({
  title,
  body,
  action,
  onDismiss,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <div className="relative rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-200">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
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
type SignInPromptProps = { fallback?: React.ReactNode };

function SignInPromptEnabled({ fallback }: SignInPromptProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const { dismissed, dismiss } = usePromptDismissed();
  if (!isLoaded || dismissed === null) return null;
  if (isSignedIn || dismissed) return <>{fallback ?? null}</>;
  return (
    <PromptShell
      title="Sign in to keep your content"
      body="A free account keeps your diagrams and content across sessions and devices."
      onDismiss={dismiss}
      action={
        <Link
          href="/sign-in/"
          className="inline-flex w-full items-center justify-center rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          Sign in
        </Link>
      }
    />
  );
}

function SignInPromptDisabled({ fallback }: SignInPromptProps) {
  const { dismissed, dismiss } = usePromptDismissed();
  if (dismissed === null) return null;
  if (dismissed) return <>{fallback ?? null}</>;
  return (
    <PromptShell
      title="Diagrams saved to this browser"
      body="Sign-in isn't enabled on this deployment, so diagrams stay local to this browser. Clear your storage and they're gone."
      onDismiss={dismiss}
    />
  );
}

export const SignInPrompt = clerkEnabled ? SignInPromptEnabled : SignInPromptDisabled;
