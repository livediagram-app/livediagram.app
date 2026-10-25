'use client';

// The Night Band frame every account and connect page stands on (docs/specs/014-identity/auth-and-guest-access.md
// "The look: Night Band"): the brand (and, on the account pages, the guest way out) in a header, the page's card, and
// beside it a pitch. Dark mode wears Midnight, the marketing site's night section; light mode is the same layout on a
// pale dotted ground. Below lg the card comes first and the pitch stacks under it; the card is first in the DOM at
// every width, so the form is what the Tab key and a screen reader reach first.
import { Brand } from '@livedocuments/ui';
import type { ReactNode } from 'react';
import { useMidnightPalette } from '@liveworkspace/workbench/hooks/ui/useMidnightPalette';
import { AuthLines } from '@liveworkspace/workbench/components/chrome/AuthLines';

// The card's title (the page's h1), shared by the account and connect pages.
export const AUTH_TITLE =
  'text-2xl font-semibold tracking-tight text-indigo-950 sm:text-[1.75rem] 2xl:text-[2rem] dark:text-slate-100';

// The card. Exported so a page can tell its own surface apart in tests; the classes are the look.
export const AUTH_STAGE_CARD =
  'w-full rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-900/10 sm:p-8 2xl:p-10 dark:border-slate-700 dark:bg-slate-800/95 dark:shadow-black/40';

export function AuthStage({
  children,
  aside,
  guestHref,
}: {
  // The card's content.
  children: ReactNode;
  // The pitch beside the card; none centres the card alone (the interstitials).
  aside?: ReactNode;
  // The "keep going as a guest" link; only the account pages pass one.
  guestHref?: string | null;
}) {
  useMidnightPalette();
  return (
    <main className="relative min-h-dvh overflow-hidden bg-slate-100 bg-[radial-gradient(var(--color-slate-300)_1px,transparent_1px)] bg-[size:24px_24px] dark:bg-slate-900 dark:bg-none">
      <AuthLines />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 lg:px-12 lg:py-10 2xl:max-w-[88rem] min-[1920px]:min-h-[calc(100dvh/1.2)] min-[1920px]:[zoom:1.2] min-[2400px]:min-h-[calc(100dvh/1.35)] min-[2400px]:[zoom:1.35]">
        <header className="lvd-auth-header flex items-center justify-between gap-4">
          <Brand href="/" size="md" />
          {guestHref ? (
            <a
              href={guestHref}
              className="py-2 text-sm font-semibold text-brand-800 transition hover:text-brand-900 dark:text-brand-300 dark:hover:text-brand-200"
            >
              <span className="hidden sm:inline">Not now, keep going as a guest</span>
              <span className="sm:hidden">Not now</span>
            </a>
          ) : null}
        </header>
        <div
          className={
            aside
              ? 'flex flex-1 flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:gap-16 2xl:grid-cols-[minmax(0,1fr)_480px] 2xl:gap-24'
              : 'flex flex-1 items-center justify-center'
          }
        >
          <div className={`w-full ${aside ? 'lg:col-start-2 lg:row-start-1' : 'max-w-md'}`}>
            <div className={`lvd-auth-card ${AUTH_STAGE_CARD}`}>{children}</div>
          </div>
          {aside ? <div className="lg:col-start-1 lg:row-start-1">{aside}</div> : null}
        </div>
      </div>
    </main>
  );
}
