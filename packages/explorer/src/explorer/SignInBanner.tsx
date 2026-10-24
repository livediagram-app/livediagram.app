'use client';

// A guest's sign-in banner (liveplanner/docs/specs/014-identity/sign-in-encouragement.md): a floating card at the
// foot of the Explorer for someone not signed in, with Sign In, Learn More (the reasons, loaded on first press) and
// a close that this browser remembers. The Explorer shows it when the host passes `signInBanner`, the person is a
// guest and there is a `signInHref`. While it shows, a spacer lets the last row scroll clear of it, and the toasts
// stand above it. It stands on a host's bottom bar (`--explorer-floor`).

import { lazy, Suspense, useEffect, useState } from 'react';
import { CloseIcon, SparkleIcon } from '../ui/icons';
import { readStored, writeStored } from '../ui/storage';
import type { SignInBannerHost } from '../types';
import { useExplorer } from './context';

const SignInReasons = lazy(() =>
  import('./SignInReasons').then((m) => ({ default: m.SignInReasons })),
);

// One key on liveworkspace.app for every app's guests: closing it once closes it.
export const SIGN_IN_BANNER_KEY = 'liveworkspace:explorer-signin-banner-dismissed';

export function SignInBanner({ href, host }: { href: string; host: SignInBannerHost }) {
  const { kind } = useExplorer();
  // Read after the first paint, so a prerendered page and the browser agree.
  const [dismissed, setDismissed] = useState(true);
  const [reasons, setReasons] = useState(false);
  useEffect(() => setDismissed(readStored(SIGN_IN_BANNER_KEY) === '1'), []);
  if (dismissed) return null;
  const signIn = () => host.onTelemetry?.('Selected', 'SignInBannerExplorer');
  return (
    <>
      <div aria-hidden className="h-28 shrink-0 sm:h-20" />
      <div
        data-sign-in-banner=""
        className="pointer-events-none fixed inset-x-0 bottom-[calc(1rem+var(--explorer-floor,0px))] z-40 flex justify-center px-4"
      >
        <div
          role="region"
          aria-label="Sign in"
          // brand-700 to brand-800 in either appearance: white reads on both at 5.9:1 and better.
          className="pointer-events-auto flex w-full max-w-3xl flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-brand-800 bg-gradient-to-br from-brand-700 to-brand-800 p-4 text-white shadow-2xl shadow-brand-900/30 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
        >
          <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-white/15 sm:flex">
            <SparkleIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold sm:text-base">Sign in to access Teams &amp; AI</p>
            <p className="mt-0.5 text-xs text-white/90 sm:text-sm">
              Share with your team, build with AI, and keep your {kind.lowerMany} on every device.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                host.onTelemetry?.('Opened', 'SignInReasonsExplorer');
                setReasons(true);
              }}
              className="rounded-lg border border-white/40 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              Learn More
            </button>
            <a
              href={href}
              onClick={signIn}
              className="inline-flex items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
            >
              Sign In
            </a>
            <button
              type="button"
              onClick={() => {
                host.onTelemetry?.('Closed', 'SignInBannerExplorer');
                writeStored(SIGN_IN_BANNER_KEY, '1');
                setDismissed(true);
              }}
              aria-label="Dismiss"
              className="flex size-8 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white"
            >
              <CloseIcon size={16} />
            </button>
          </div>
        </div>
      </div>
      {reasons ? (
        <Suspense fallback={null}>
          <SignInReasons
            href={href}
            helpHref={host.helpHref}
            onSignIn={signIn}
            onClose={() => setReasons(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
