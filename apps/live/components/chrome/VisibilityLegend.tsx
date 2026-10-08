'use client';

// The visibility pill's legend (docs/specs/006-document/offline-mode.md "The visibility legend"): who can see this
// document, as a ladder of widening audience (Private, Shared, Team, Public) joined by a rail, each state a round
// tile in its own tone over its name and what it means, the current one tinted and marked Current; Local only
// stands apart under a divider, the deliberate opt-out. Shown on the pill's hover or focus, for the eye only (the
// pill carries the current state's words for assistive technology).
import type { ReactNode } from 'react';
import { CheckIcon, lucideGlyph } from '@livediagram/ui';
import { lucideGlobe, lucideLink, lucideLock, lucideUsers } from '@livediagram/icons/lucide';
import { ThisBrowserIcon } from '@/components/primitives/explorer-icons';
import { SHARE_STATE_META, type ShareState } from './share-states';

const LockGlyph = lucideGlyph(lucideLock, 14);
const LinkGlyph = lucideGlyph(lucideLink, 14);
const TeamGlyph = lucideGlyph(lucideUsers, 14);
const GlobeGlyph = lucideGlyph(lucideGlobe, 14);

// The audiences from narrowest to widest, then the opt-out.
const LADDER: readonly ShareState[] = ['private', 'shared', 'team', 'community'];

// Each state's tile (icon on a tint of its tone) and, when current, its row's wash.
const LOOK: Record<ShareState, { icon: ReactNode; tile: string; current: string }> = {
  private: {
    icon: <LockGlyph />,
    tile: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    current: 'bg-slate-50 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700',
  },
  shared: {
    icon: <LinkGlyph />,
    tile: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    current: 'bg-emerald-50/70 ring-emerald-200 dark:bg-emerald-500/10 dark:ring-emerald-500/30',
  },
  team: {
    icon: <TeamGlyph />,
    tile: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
    current: 'bg-brand-50/70 ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30',
  },
  community: {
    icon: <GlobeGlyph />,
    tile: 'bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
    current: 'bg-pink-50/70 ring-pink-200 dark:bg-pink-500/10 dark:ring-pink-500/30',
  },
  offline: {
    icon: <ThisBrowserIcon size={14} />,
    tile: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    current: 'bg-amber-50/70 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30',
  },
};

function Row({ state, current }: { state: ShareState; current: boolean }) {
  const m = SHARE_STATE_META[state];
  const look = LOOK[state];
  return (
    <li
      data-current={current ? '' : undefined}
      className={`relative flex items-center gap-3 rounded-lg px-2 py-1.5 ${
        current ? `ring-1 ${look.current}` : ''
      }`}
    >
      {/* The tile sits on the rail, ringed in the card's colour so the rail stops at its edge. */}
      <span
        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-[3px] ring-white dark:ring-slate-900 ${look.tile}`}
      >
        {look.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
          {m.label}
        </span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
          {m.description}
        </span>
      </span>
      {current ? (
        <span className="flex shrink-0 items-center gap-1 self-start pt-0.5 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
          <CheckIcon size={11} />
          Current
        </span>
      ) : null}
    </li>
  );
}

export function VisibilityLegend({ current }: { current: ShareState }) {
  return (
    <div
      aria-hidden
      data-visibility-legend=""
      className="absolute left-1/2 top-full z-10 mt-2 w-[21rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-fade-in rounded-xl border border-slate-200 bg-white p-2 text-left shadow-xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
    >
      <div className="px-2 pb-2 pt-1">
        <p className="text-[13px] font-semibold text-slate-900 dark:text-slate-50">
          Who Can See This
        </p>
        <p className="text-[11.5px] text-slate-500 dark:text-slate-400">
          From just you to everyone, as you share it.
        </p>
      </div>
      <ol className="relative flex flex-col gap-0.5">
        {/* The rail: from the first tile's middle to the last's, the audience widening down it. */}
        <span
          aria-hidden
          className="absolute bottom-6 left-[1.4rem] top-6 w-0.5 rounded-full bg-gradient-to-b from-slate-200 via-emerald-200 to-pink-200 dark:from-slate-700 dark:via-emerald-500/40 dark:to-pink-500/40"
        />
        {LADDER.map((s) => (
          <Row key={s} state={s} current={s === current} />
        ))}
      </ol>
      <div className="mx-2 my-1.5 border-t border-slate-100 dark:border-slate-800" />
      <ol>
        <Row state="offline" current={current === 'offline'} />
      </ol>
    </div>
  );
}
