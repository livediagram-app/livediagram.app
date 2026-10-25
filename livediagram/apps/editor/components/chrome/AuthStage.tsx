'use client';

// The Night Band frame every account and connect page stands on (docs/specs/014-identity/auth-and-guest-access.md
// "The look: Night Band"): the brand (and, on the account pages, the guest way out) in a header, the page's card, and
// beside it a pitch. Dark mode wears Midnight, the marketing site's night section; light mode is the same layout on a
// pale dotted ground. Below lg the card comes first and the pitch stacks under it; the card is first in the DOM at
// every width, so the form is what the Tab key and a screen reader reach first.
import { Brand } from '@livediagram/ui';
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

// One promise in the pitch: a tinted icon, a coloured lead, a short title and a line.
export type PitchTone = 'emerald' | 'violet' | 'sky' | 'amber';
export interface PitchRow {
  tone: PitchTone;
  icon: ReactNode;
  lead: string;
  title: string;
  line: string;
}

// Light inks are the 700s (AA on white); dark ones the 400s on the Midnight card.
const TONE: Record<PitchTone, { chip: string; ink: string }> = {
  emerald: {
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400',
    ink: 'text-emerald-700 dark:text-emerald-400',
  },
  violet: {
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-400',
    ink: 'text-violet-700 dark:text-violet-400',
  },
  sky: {
    chip: 'bg-brand-100 text-brand-700 dark:bg-brand-400/10 dark:text-brand-400',
    ink: 'text-brand-700 dark:text-brand-400',
  },
  amber: {
    chip: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-400',
    ink: 'text-amber-700 dark:text-amber-400',
  },
};

export function AuthPitch({
  eyebrow,
  heading,
  rows,
}: {
  eyebrow: string;
  heading: string;
  rows: readonly PitchRow[];
}) {
  return (
    <section className="flex flex-col gap-4 lg:gap-6">
      <p className="lvd-auth-eyebrow text-xs font-semibold tracking-[0.18em] text-brand-800 uppercase sm:text-sm dark:text-brand-300">
        {eyebrow}
      </p>
      <h2 className="lvd-auth-heading text-2xl leading-tight font-semibold tracking-tight text-indigo-950 sm:text-4xl lg:text-6xl lg:leading-[1.02] lg:tracking-[-0.03em] 2xl:text-7xl dark:text-slate-100">
        {heading}
      </h2>
      <ul className="mt-1 flex flex-col gap-2 lg:mt-3 lg:gap-3 2xl:grid 2xl:grid-cols-2 2xl:gap-4">
        {rows.map((row) => (
          <li
            key={row.lead}
            className="lvd-auth-row flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm shadow-slate-900/5 lg:gap-4 lg:rounded-2xl lg:px-4.5 lg:py-4 2xl:py-5 dark:border-slate-700/70 dark:bg-slate-800/80 dark:shadow-none"
          >
            <span
              aria-hidden
              className={`lvd-auth-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lg:h-10 lg:w-10 ${TONE[row.tone].chip}`}
            >
              {row.icon}
            </span>
            <span className="min-w-0">
              <span className={`text-base font-semibold lg:text-xl ${TONE[row.tone].ink}`}>
                {row.lead}
              </span>{' '}
              <span className="text-sm font-semibold text-slate-900 lg:text-base dark:text-slate-100">
                {row.title}
              </span>
              <span className="block text-sm text-slate-600 dark:text-slate-400">{row.line}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
