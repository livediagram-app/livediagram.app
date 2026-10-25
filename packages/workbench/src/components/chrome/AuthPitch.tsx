// The pitch beside the Night Band frame's card, on every editor's account and connect pages (docs/specs/014-identity/
// auth-and-guest-access.md "The look: Night Band" in each product): an eyebrow, a heading and its promise rows, one
// row under another at every width. Each row is a tinted icon, one title in its tone's colour and a line under it, as
// on liveworkspace.app's sign-in pitch (liveworkspace/apps/site/components/account/Pitch.tsx). Each editor hands in its
// own rows (its components/chrome/auth-pitches.tsx). Copy only; no controls.
import type { ReactNode } from 'react';

export type PitchTone = 'emerald' | 'violet' | 'sky' | 'amber';

// One promise: a title that stands alone, and the line under it.
export interface PitchRow {
  tone: PitchTone;
  icon: ReactNode;
  title: string;
  line: string;
}

// Light inks are the 700s (AA on white); dark ones the 400s on the Midnight card. Sky is the product's brand ramp.
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
      <ul className="mt-1 flex flex-col gap-2 lg:mt-3 lg:gap-3">
        {rows.map((row) => (
          <li
            key={row.title}
            className="lvd-auth-row flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm shadow-slate-900/5 lg:gap-4 lg:rounded-2xl lg:px-4.5 lg:py-4 2xl:py-5 dark:border-slate-700/70 dark:bg-slate-800/80 dark:shadow-none"
          >
            <span
              aria-hidden
              className={`lvd-auth-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-lg lg:h-10 lg:w-10 ${TONE[row.tone].chip}`}
            >
              {row.icon}
            </span>
            <span className="min-w-0">
              <span className={`block text-base font-semibold lg:text-lg ${TONE[row.tone].ink}`}>
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
