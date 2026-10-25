'use client';

// Whether a signed-in-only page (the AI-tool consent and device pages) shows its content, its loading line, or its
// Sign in step (docs/specs/014-identity/auth-and-guest-access.md "Who is a guest, before sign-in answers" in each
// product). Each editor's useAccountBootstrap settles `authLoaded` at its 5 s give-up with no one in it, so the
// Sign in step can't follow `authLoaded` alone: a browser whose signed-in hint says a session is coming waits for
// the session's own answer (`sessionAnswered`), up to SESSION_WAIT_MS. Reading the give-up as signed out showed a
// signed-in person "Sign in to connect", and the click then signed them straight in.
import { useEffect, useState } from 'react';

// How long a page waits for a session its hint says is there before it offers Sign in anyway. The same bound /new
// waits before keeping a create in This Browser.
export const SESSION_WAIT_MS = 15_000;

export type SignInGate = 'waiting' | 'signed-in' | 'sign-in';

export interface SignInGateInput {
  // useAccountBootstrap's: settled, by the session or by the give-up.
  authLoaded: boolean;
  // useAccountBootstrap's: the session itself has answered.
  sessionAnswered: boolean;
  // A known account: signed in, with its id.
  signedIn: boolean;
  // The app's `<prefix>signed_in=1` cookie: this browser had a session here.
  signedInHint: boolean;
  // SESSION_WAIT_MS has passed since the page opened, with the hint set and no answer.
  waitedOut: boolean;
}

export function signInGateOf(input: SignInGateInput): SignInGate {
  if (input.signedIn) return 'signed-in';
  if (!input.authLoaded) return 'waiting';
  if (input.signedInHint && !input.sessionAnswered && !input.waitedOut) return 'waiting';
  return 'sign-in';
}

export function useSignInGate(input: Omit<SignInGateInput, 'waitedOut'>): SignInGate {
  const [waitedOut, setWaitedOut] = useState(false);
  // Only a hinted browser waits on the session, so only it needs the bound, counted from the page's first render.
  const waiting = input.signedInHint && !input.sessionAnswered && !input.signedIn;
  useEffect(() => {
    if (!waiting) return;
    const id = window.setTimeout(() => setWaitedOut(true), SESSION_WAIT_MS);
    return () => window.clearTimeout(id);
  }, [waiting]);
  return signInGateOf({ ...input, waitedOut });
}
