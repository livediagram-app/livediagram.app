'use client';

import { ClerkProvider as Clerk } from '@clerk/nextjs';
import type { ReactNode } from 'react';

// Wraps the live app with Clerk's React context so `useAuth` / `useSignIn`
// / `useSignUp` work anywhere in the tree. Mirrors Manager Toolkit's
// dashboard/components/providers/ClerkProvider — same shape, livediagram
// routes.
//
// Hybrid mode (spec/04): the provider is rendered on every page, but
// nothing here gates the editor — the canvas keeps working as a guest.
// Auth is purely additive: when signed in, the editor sends a Bearer
// token instead of `X-Owner-Id` (wired in editor-page.tsx).
//
// When the publishable key isn't set (local dev without `.env.local`, or
// a prod deploy missing the Cloudflare Pages env var) we render a
// branded fallback instead of crashing. Helps catch misconfigured
// deploys early — a blank screen could be many things, this card is
// one thing.

const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
const isValidKey = key.length > 0 && (key.startsWith('pk_test_') || key.startsWith('pk_live_'));

export function ClerkProvider({ children }: { children: ReactNode }) {
  if (!isValidKey) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-lg shadow-slate-900/10">
          <h1 className="mb-2 text-xl font-semibold text-slate-900">Clerk not configured</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Set{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            </code>{' '}
            in your build environment (Cloudflare Pages → Settings → Environment variables, or
            <code className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.local</code> for
            local dev) and redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Clerk
      publishableKey={key}
      signInUrl="/live/sign-in/"
      signUpUrl="/live/get-started/"
      afterSignOutUrl="/live/"
    >
      {children}
    </Clerk>
  );
}
