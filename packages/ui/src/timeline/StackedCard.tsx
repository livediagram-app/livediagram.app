'use client';

// A run of same-kind events, collapsed or open (docs/specs/013-workspace/timeline.md §2.1).
//
// One cell of the day's grid, wearing the generic headline, with one or
// two faux-card layers stepping out behind it so the pile reads as
// depth rather than as a card with odd copy. Its preview box shows the
// kind's glyph and the count rather than one member's thumbnail: one
// diagram's snapshot can't speak for a run spanning five.
//
// The same card is the run's toggle in both states: collapsed it reads
// "click to expand", open it stays put at the head of its members,
// reads "click to collapse", and loses its layers (they've been dealt
// out beside it). One control, one place, rather than a footer link
// the reader has to find under the run.

import { TimelineCard } from './TimelineCard';
import { stackLabel, type TimelineStack } from './stacking';
import type { TimelineCardSlots, TimelineRendererContext, TimelineRendererRegistry } from './types';
import { pickRenderer } from './renderers';

export function StackedCard({
  stack,
  registry,
  ctx,
  onToggle,
  expanded = false,
  isNew,
  stagger = 0,
  slots,
}: {
  stack: TimelineStack;
  registry: TimelineRendererRegistry;
  ctx: TimelineRendererContext;
  onToggle: () => void;
  /** The host's ⋯ menu for the whole run (docs/specs/013-workspace/timeline.md §2.9). The card
   *  stops its events at the slot, so opening it never toggles the run. */
  slots?: Pick<TimelineCardSlots, 'menu' | 'onContextMenu'>;
  /** The run is open: this card heads it and collapses it. */
  expanded?: boolean;
  /** ms of animation delay, so the feed cascades rather than popping. */
  stagger?: number;
  /** True when ANY member of the run is unseen: a collapsed stack
   *  hiding the one new thing in it would defeat the marker. */
  isNew?: boolean;
}) {
  const anchor = stack.events[0]!;
  const rendered = pickRenderer(anchor, registry)(anchor, ctx);
  const count = stack.events.length;
  // Two layers at three or more, one at two: a single thin layer behind
  // a pair of events reads as depth, but two layers behind a pair reads
  // as a deck that isn't there.
  const deep = count >= 3 && !expanded;
  const layer =
    'pointer-events-none absolute inset-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';

  return (
    // The layers step down and right into the grid gap; `mr-3 mb-3`
    // keeps the deepest one inside this cell rather than under the next.
    <div
      className="tl-fan-out-up relative mb-3 mr-3 flex h-full flex-col"
      style={{ animationDelay: `${stagger}ms` }}
    >
      {deep && <div aria-hidden className={`${layer} translate-x-3 translate-y-3 opacity-50`} />}
      {!expanded && (
        <div aria-hidden className={`${layer} translate-x-1.5 translate-y-1.5 opacity-75`} />
      )}
      <div className="relative flex-1">
        <TimelineCard
          event={anchor}
          isNew={isNew}
          slots={slots}
          // Ringed while open, so the head of the run reads as the
          // control it is rather than as one more member.
          focused={expanded}
          rendered={{
            ...rendered,
            // The generic headline, not the anchor's own: "Payments
            // architecture" on a stack that also holds two other
            // diagrams is a title the reader can't trust.
            subject: stackLabel(stack),
            label: `${count} events · click to ${expanded ? 'collapse' : 'expand'}`,
            description: null,
            meta: undefined,
            // The anchor's preview would speak for the whole run.
            preview: undefined,
            onClick: onToggle,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-2 rounded-full bg-slate-900/70 px-2 py-0.5 text-[11px] font-semibold text-white dark:bg-white/80 dark:text-slate-900"
        >
          {count}
        </span>
      </div>
    </div>
  );
}
