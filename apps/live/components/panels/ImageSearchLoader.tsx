'use client';

// The image picker's Search tab loaders (docs/specs/009-elements/image-search.md "Loading" and
// "Picking"); their motion lives in app/image-search-loader.css. While a search runs, placeholder
// photos fill the grid with a glint rolling across them under a scanning lens; while a pick is
// stored, its tile lifts behind a chasing ring and says which stage it is at.
import type { ReactNode } from 'react';
import { SearchIcon } from '@livediagram/ui';
import type { PickStage } from '@/lib/image-search/pick';

// One search page fills two rows of four; a further page adds one row.
export const SKELETON_TILES_FIRST = 8;
export const SKELETON_TILES_MORE = 4;
// Each tile's glint starts this long after the one before, so it rolls across the grid.
const GLINT_STEP_S = 0.09;

export const PICK_STAGE_COPY: Record<PickStage, { short: string; long: string }> = {
  downloading: { short: 'Downloading', long: 'Downloading the full-size picture…' },
  saving: { short: 'Adding', long: 'Adding it to your gallery…' },
};

// The placeholder photo's tints, cycled across the grid so it reads as a mix of pictures.
const TINTS = [
  'from-sky-100 to-indigo-100 dark:from-sky-500/15 dark:to-indigo-500/15',
  'from-amber-100 to-rose-100 dark:from-amber-500/15 dark:to-rose-500/15',
  'from-emerald-100 to-teal-100 dark:from-emerald-500/15 dark:to-teal-500/15',
  'from-violet-100 to-pink-100 dark:from-violet-500/15 dark:to-pink-500/15',
];

// A placeholder photo's classes: the glint, over the n-th tint.
export function skeletonClass(n: number): string {
  return `lvd-search-skeleton bg-gradient-to-br ${TINTS[n % TINTS.length]}`;
}

export function PlaceholderArt() {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden
      className="lvd-search-art absolute inset-0 m-auto h-1/2 w-1/2 text-white dark:text-slate-300/40"
    >
      <circle cx="28" cy="12" r="4" fill="currentColor" />
      <path d="M2 34 L14 20 L22 28 L28 22 L38 34 Z" fill="currentColor" />
    </svg>
  );
}

export function SkeletonTiles({ count, from = 0 }: { count: number; from?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const n = from + i;
        return (
          <li
            key={`skeleton-${n}`}
            aria-hidden
            data-image-search-skeleton=""
            className={`relative aspect-square overflow-hidden rounded-md animate-fade-in ${skeletonClass(n)}`}
            style={{ ['--lvd-search-phase' as string]: `${(i * GLINT_STEP_S).toFixed(2)}s` }}
          >
            <PlaceholderArt />
          </li>
        );
      })}
    </>
  );
}

// The line above the grid while a search runs: the lens scanning, and what it is looking for.
export function SearchingStatus({ query }: { query: string }) {
  return (
    <p className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
        <span className="lvd-search-lens flex">
          <SearchIcon size={13} />
        </span>
      </span>
      <span className="min-w-0 truncate">
        Searching Openverse for{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-100">“{query}”</span>…
      </span>
    </p>
  );
}

// Over the picked tile: a soft veil, a ring chasing round its edge and the stage's word.
export function PickOverlay({ stage }: { stage: PickStage }) {
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/55 backdrop-blur-[2px] animate-fade-in dark:bg-slate-900/60">
      <svg viewBox="0 0 32 32" aria-hidden className="h-8 w-8">
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="none"
          strokeWidth="3"
          className="stroke-white/80 dark:stroke-slate-700"
        />
        <circle
          cx="16"
          cy="16"
          r="13"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="22 60"
          className="lvd-pick-ring stroke-brand-500 dark:stroke-brand-400"
        />
      </svg>
      <span className="rounded-full bg-white/90 px-1.5 py-px text-[10px] font-semibold text-slate-700 shadow-sm dark:bg-slate-900/90 dark:text-slate-200">
        {PICK_STAGE_COPY[stage].short}
      </span>
    </span>
  );
}

// Under the grid while a pick is stored: the stage in words over a running light, two steps lit
// in turn so the wait reads as progress.
export function PickStatus({ stage }: { stage: PickStage }) {
  const steps: PickStage[] = ['downloading', 'saving'];
  const at = steps.indexOf(stage);
  return (
    <div
      role="status"
      className="flex flex-col gap-1.5 rounded-lg bg-brand-50/70 px-3 py-2 ring-1 ring-brand-100 animate-fade-in dark:bg-brand-500/10 dark:ring-brand-500/25"
    >
      <p className="text-xs font-medium text-brand-800 dark:text-brand-200">
        {PICK_STAGE_COPY[stage].long}
      </p>
      <div className="flex gap-1" aria-hidden>
        {steps.map((s, i) => (
          <Step key={s} state={i < at ? 'done' : i === at ? 'active' : 'todo'} />
        ))}
      </div>
    </div>
  );
}

function Step({ state }: { state: 'done' | 'active' | 'todo' }): ReactNode {
  return (
    <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-brand-100 dark:bg-brand-500/20">
      {state === 'done' ? (
        <span className="absolute inset-0 rounded-full bg-brand-500 dark:bg-brand-400" />
      ) : state === 'active' ? (
        <span className="lvd-pick-bar absolute inset-y-0 left-0 w-2/5 rounded-full bg-brand-500 dark:bg-brand-400" />
      ) : null}
    </span>
  );
}
