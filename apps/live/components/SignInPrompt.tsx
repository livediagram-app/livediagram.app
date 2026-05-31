'use client';

// Persistence-model prompt shown inside the Explorer. Always present
// for guest sessions so the user understands their diagrams are
// browser-local until they sign in; rendered shape depends on what
// the deployment supports:
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
// Same module-load enabled/disabled hook-swap pattern as
// AuthControls and useClerkApiBootstrap — calling useAuth outside a
// ClerkProvider would throw, so the disabled branch never touches
// Clerk.

import { useAuth } from '@clerk/react';
import Link from 'next/link';
import { clerkEnabled } from '@/lib/clerk-config';

function PromptShell({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-600">
      <p className="font-medium text-slate-800">{title}</p>
      <p className="mt-1 leading-relaxed text-slate-500">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

function SignInPromptEnabled() {
  const { isLoaded, isSignedIn } = useAuth();
  // Wait for Clerk to settle, then hide entirely for signed-in users.
  if (!isLoaded || isSignedIn) return null;
  return (
    <PromptShell
      title="Sign in to keep your diagrams"
      body="A free account syncs your diagrams across devices."
      action={
        <Link
          href="/live/sign-in/"
          className="inline-flex w-full items-center justify-center rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-600"
        >
          Sign in
        </Link>
      }
    />
  );
}

function SignInPromptDisabled() {
  return (
    <PromptShell
      title="Diagrams saved to this browser"
      body="Sign-in isn't enabled on this deployment, so diagrams stay local to this browser. Clear your storage and they're gone."
    />
  );
}

export const SignInPrompt = clerkEnabled ? SignInPromptEnabled : SignInPromptDisabled;
