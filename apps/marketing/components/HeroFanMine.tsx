'use client';

import { lucideLayoutGrid } from '@liveplanner/icons/lucide';
import type { RecentDiagram } from '@liveplanner/api-schema';
import { ChevronRightIcon, EXPLORER_HOME_HREF, lucideGlyph, relativeSince } from '@liveplanner/ui';
import { useState, type CSSProperties } from 'react';
import { RecentPreview } from './RecentPreview';

// The hero fan for a returning visitor with RECENT_FAN_MIN or more recent projects
// (docs/specs/019-marketing/returning-visitor.md): their projects, most recent first, each its preview
// on the fan's card, then a card to Explorer Home for everything else. They stay put (no dealing): a
// returning visitor came for these. On a phone the three most recent, without Explorer Home: the band has
// room for three cards there, and their own projects are what a returning visitor came for.

const ExplorerGlyph = lucideGlyph(lucideLayoutGrid, 28);

// The fan's poses for four cards and for five, left to right, mirrored about the middle; on a phone the
// PHONE_RECENT most recent projects take a three-card fan of their own.
const POSES: Record<number, readonly string[]> = {
  4: [
    '[transform:translateY(1.5rem)_rotate(-5deg)]',
    '[transform:translateY(0.25rem)_rotate(-1.75deg)]',
    '[transform:translateY(0.25rem)_rotate(1.75deg)]',
    '[transform:translateY(1.5rem)_rotate(5deg)]',
  ],
  5: [
    '[transform:translateY(2.5rem)_rotate(-7deg)]',
    '[transform:translateY(0.75rem)_rotate(-3.5deg)]',
    '[transform:translateY(0)_rotate(0deg)]',
    '[transform:translateY(0.75rem)_rotate(3.5deg)]',
    '[transform:translateY(2.5rem)_rotate(7deg)]',
  ],
};
/** How many projects a phone's fan shows; Explorer Home is left off there. */
export const PHONE_RECENT = 3;
const PHONE = [
  'max-sm:[transform:translateY(0.5rem)_rotate(-4deg)]',
  'max-sm:[transform:none]',
  'max-sm:[transform:translateY(0.5rem)_rotate(4deg)]',
];

// Pointing at (or focusing) a card straightens it and lifts it far enough to bring its foot, where a
// project's save time sits, up over the band's edge; at rest the foot runs off it, out of sight.
const SLOT =
  'shrink-0 transition-transform duration-micro ease-out hover:[transform:translateY(-4.25rem)_rotate(0deg)] has-[:focus-visible]:[transform:translateY(-4.25rem)_rotate(0deg)] motion-reduce:transition-none';
// Explorer Home's top row: its title on the left, Open on the right (stacked, right-aligned, on a phone).
const HEAD =
  'flex flex-col items-stretch gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2 [&>*:last-child]:self-end sm:[&>*:last-child]:self-auto';
const CARD =
  'hero-fan-in flex h-56 w-[6.5rem] flex-col gap-2 rounded-xl border border-brand-100 bg-white p-2 text-slate-900 shadow-[0_30px_60px_-30px_var(--hero-card-shadow)] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-400 sm:h-72 sm:w-56 sm:gap-3 sm:rounded-2xl sm:p-4 dark:border-transparent';

export function HeroFanMine({ diagrams }: { diagrams: readonly RecentDiagram[] }) {
  // Read once per mount: "2 hours ago" need not tick while the page is open.
  const [now] = useState(() => Date.now());
  const count = diagrams.length + 1;
  const poses = POSES[count] ?? POSES[5]!;
  const slot = (i: number, phone: string | null) =>
    `${SLOT} ${poses[i]} ${phone ?? 'max-sm:hidden'}`;
  // Each card springs in a beat after the one before it.
  const dealt = (i: number) => ({ animationDelay: `${i * 70}ms` }) as CSSProperties;
  return (
    <>
      {diagrams.map((d, i) => (
        <div key={d.id} className={slot(i, i < PHONE_RECENT ? PHONE[i]! : null)}>
          <a href={`/project/${encodeURIComponent(d.id)}`} className={CARD} style={dealt(i)}>
            <span className="truncate text-xs font-semibold sm:text-sm">
              {d.name || 'Untitled project'}
            </span>
            <RecentPreview diagram={d} className="h-20 rounded-lg sm:h-32 sm:rounded-xl" />
            {/* How long since it was saved, at the card's foot, right-aligned: off the band at rest, and
                in view once the card is lifted. */}
            <span className="mt-auto text-right text-[11px] text-slate-500 sm:text-xs">
              {relativeSince(d.savedAt, now)}
            </span>
          </a>
        </div>
      ))}
      <div className={slot(diagrams.length, null)}>
        <a href={EXPLORER_HOME_HREF} className={CARD} style={dealt(diagrams.length)}>
          <span className={HEAD}>
            <span className="min-w-0 truncate text-xs font-semibold sm:text-sm">Explorer Home</span>
            <span className="flex shrink-0 items-center justify-end gap-1 text-[11px] font-semibold text-brand-700 sm:text-xs">
              Open
              <ChevronRightIcon size={12} aria-hidden />
            </span>
          </span>
          <span className="flex h-20 flex-col items-center justify-center gap-2 rounded-lg bg-brand-50 text-brand-700 sm:h-32 sm:rounded-xl">
            <ExplorerGlyph size={28} aria-hidden />
            <span className="hidden text-xs font-medium sm:block">All your projects</span>
          </span>
        </a>
      </div>
    </>
  );
}
