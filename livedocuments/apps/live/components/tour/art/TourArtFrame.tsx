'use client';

import type { ReactNode } from 'react';

// The frame every track's welcome card hero sits in (docs/specs/007-editor/pages-tour.md "Look and motion"): the welcome art's
// recipe (TourWelcomeArt, DrawTourArt) in one place. Pure inline SVG on a 304 x 104 stage + CSS keyframes, Tailwind
// fill/stroke classes for light and dark, looping with the `animation` shorthand and `infinite`, and still under
// reduced motion (the global collapse in globals.css, plus each art's own `animation: none`). The tour's spark
// twinkles in the top-right corner of every one.
const SPARK_CSS = `
  .tour-art-el { transform-box: fill-box; transform-origin: 50% 50%; }
  @keyframes tour-art-twinkle {
    0%, 100% { opacity: 0.25; transform: scale(0.8) rotate(0deg); }
    50% { opacity: 1; transform: scale(1.05) rotate(12deg); }
  }
  .tour-art-spark { animation: tour-art-twinkle 2.3s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .tour-art-spark { animation: none; }
  }
`;

// Shared fills, so every art reads as one set in both themes.
export const ART = {
  paper: 'fill-white stroke-slate-200 dark:fill-slate-700 dark:stroke-slate-600',
  well: 'fill-slate-100 dark:fill-slate-700/40',
  ink: 'fill-slate-700 dark:fill-slate-200',
  faint: 'fill-slate-300 dark:fill-slate-500',
  line: 'stroke-slate-300 dark:stroke-slate-500',
  accent: 'fill-brand-500',
  accentSoft: 'fill-brand-50 stroke-brand-500 dark:fill-brand-500/20 dark:stroke-brand-400',
} as const;

export function TourArtFrame({ css, children }: { css: string; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/40"
    >
      <style>{SPARK_CSS + css}</style>
      <svg viewBox="0 0 304 104" className="block w-full" role="presentation">
        {children}
        <path
          d="M 284 18 c 1.1 5.5 3.2 7.6 8.7 8.7 -5.5 1.1 -7.6 3.2 -8.7 8.7 -1.1 -5.5 -3.2 -7.6 -8.7 -8.7 5.5 -1.1 7.6 -3.2 8.7 -8.7 Z"
          className="tour-art-el tour-art-spark fill-brand-400 dark:fill-brand-300"
        />
      </svg>
    </div>
  );
}
