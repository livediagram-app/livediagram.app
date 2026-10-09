'use client';

// "Does this deployment serve its own identity provider?"
// (docs/specs/016-platform/self-hosted-runtime.md, "Identity")
//
// Asked at RUNTIME, on purpose. The build-time flag (NEXT_PUBLIC_SELF_HOST_AUTH) reads
// as undefined in the browser: Next.js compiles \`process.env.NEXT_PUBLIC_*\` in this app
// into a lookup on the process shim rather than a literal, so nothing folds it and the
// value never reaches the client. Measured: a build made with the flag set had no trace
// of it in any chunk, which meant a self-hosted deployment showed Clerk's "no key"
// notice instead of its own sign-in form.
//
// So the provider is discovered the way the api discovers everything else: by asking
// it. Better Auth answers /api/auth/ok with 200; a hosted deployment has no such route
// and answers 404. The answer cannot change while a page is open, so it is cached for
// the tab.

import { useEffect, useState } from 'react';

let cached: Promise<boolean> | null = null;

export function detectSelfHostAuth(): Promise<boolean> {
  cached ??= fetch('/api/auth/ok', { headers: { accept: 'application/json' } })
    .then((res) => res.ok)
    .catch(() => false);
  return cached;
}

/**
 * `null` while the question is in flight. Both auth pages and the session bridge wait
 * for it, which is why this is a hook and not a constant.
 */
let cachedMethods: Promise<string[]> | null = null;

/**
 * Which sign-in methods this deployment offers — `['email-otp', 'feishu', …]`. The
 * sign-in page renders a button per answer, so an unconfigured provider never appears.
 */
export function detectAuthMethods(): Promise<string[]> {
  cachedMethods ??= fetch('/api/auth-methods', { headers: { accept: 'application/json' } })
    .then(async (res) => (res.ok ? (((await res.json()) as { methods?: string[] }).methods ?? []) : []))
    .catch(() => []);
  return cachedMethods;
}

/** `null` until the answer arrives, like `useSelfHostAuth`. */
export function useAuthMethods(): string[] | null {
  const [methods, setMethods] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    void detectAuthMethods().then((found) => {
      if (live) setMethods(found);
    });
    return () => {
      live = false;
    };
  }, []);
  return methods;
}

export function useSelfHostAuth(): boolean | null {
  const [answer, setAnswer] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void detectSelfHostAuth().then((found) => {
      if (live) setAnswer(found);
    });
    return () => {
      live = false;
    };
  }, []);
  return answer;
}