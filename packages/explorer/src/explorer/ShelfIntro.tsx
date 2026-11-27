'use client';

// The band over the Trash and Archived (one-explorer.md "The Trash and Archived", Work Tracker 1492): the place's
// glyph in a soft tile, one line saying what the place is for and one on how to get something back, and on the right
// what it holds now (how many, and in the Trash how many leave within the week). It replaces the plain info callout
// the Trash had and the bare list Archived had, so each place says at a glance what it keeps and for how long.

import type { ReactNode } from 'react';
import { MUTED } from '../ui/classes';
import { ArchiveIcon } from '../ui/icons';
import type { Words } from '../words';

export type ShelfStat = { label: string; tone?: 'plain' | 'soon' };

export function ShelfIntro({
  icon,
  tone,
  title,
  description,
  stats = [],
  ...data
}: {
  icon: ReactNode;
  /** The tile's colour: slate for the Trash (never red: it is undoable), amber for Archived's box. */
  tone: 'slate' | 'amber';
  title: string;
  description: ReactNode;
  stats?: readonly ShelfStat[];
} & Record<`data-${string}`, string>) {
  return (
    <section
      {...data}
      aria-label={title}
      className="relative mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900"
    >
      {/* A wash of the tile's colour behind the corner, so the band reads as the place's own. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl ${
          tone === 'amber'
            ? 'bg-amber-200/40 dark:bg-amber-400/10'
            : 'bg-slate-200/60 dark:bg-slate-500/10'
        }`}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3.5">
          <span
            aria-hidden
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 [&_svg]:size-5 ${
              tone === 'amber'
                ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25'
                : 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-200 dark:ring-slate-600'
            }`}
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
            <p className={`mt-0.5 text-[13px] leading-5 ${MUTED}`}>{description}</p>
          </div>
        </div>
        {stats.length > 0 ? (
          <ul className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end" data-shelf-stats="">
            {stats.map((stat) => (
              <li
                key={stat.label}
                className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tabular-nums ring-1 ${
                  stat.tone === 'soon'
                    ? 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-200 dark:ring-amber-400/25'
                    : 'bg-white/80 text-slate-700 ring-slate-200 dark:bg-slate-900/60 dark:text-slate-200 dark:ring-slate-600'
                }`}
              >
                {stat.tone === 'soon' ? (
                  <span aria-hidden className="size-1.5 rounded-full bg-amber-500" />
                ) : null}
                <span className="text-optical-line">{stat.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

/** Archived's band: what it is for, the way out (Change Folder), and how many it holds ("12+" while more wait). */
export function ArchivedIntro({
  words,
  count,
  more,
}: {
  words: Words;
  count: number;
  more: boolean;
}) {
  return (
    <ShelfIntro
      data-archived-intro=""
      icon={<ArchiveIcon />}
      tone="amber"
      title="Out of the way, kept safe"
      description={`Archived ${words.lowerMany} rest here, closed and out of every other list. Change Folder (or a drag onto a space) moves one back, open again.`}
      stats={[{ label: `${count.toLocaleString()}${more ? '+' : ''} archived` }]}
    />
  );
}
