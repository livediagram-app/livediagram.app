'use client';

// An expanded run of same-kind events (spec/138 §2.1).
//
// The collapsed bubble is its own click target, so expanding is
// obvious. Collapsing is not: once the run is open there is nothing
// left saying it was ever a stack, and the reader who opened a day of
// twelve renames to check one of them has no way back short of
// navigating away. Hence the footer.
//
// The control sits below the run rather than in a bubble's right strip
// because it acts on the STACK, not on any one event — and the right
// strip is reserved for per-event actions (spec/138 §2).

import { TimelineBubble } from './TimelineBubble';
import type { TimelineStack } from './stacking';
import { pickRenderer } from './renderers';
import type { TimelineRendererContext, TimelineRendererRegistry } from './types';

// Slower than the first-load cascade: an expansion is a deliberate act
// on a handful of rows, so the fan is worth seeing. A whole page at this
// rate would drag.
const EXPAND_STAGGER_MS = 60;

export function ExpandedStack({
  stack,
  registry,
  ctx,
  onCollapse,
  isNew,
}: {
  stack: TimelineStack;
  registry: TimelineRendererRegistry;
  ctx: TimelineRendererContext;
  onCollapse: () => void;
  isNew?: (occurredAt: number) => boolean;
}) {
  return (
    <div className="space-y-1.5">
      {stack.events.map((event, index) => (
        // The delay restarts at zero for the run rather than continuing
        // the page's cascade: what just arrived is these bubbles, and
        // carrying a global offset would make a stack halfway down the
        // feed sit still for a second before unfolding.
        <div
          key={event.id}
          className="tl-fan-out"
          style={{ animationDelay: `${index * EXPAND_STAGGER_MS}ms` }}
        >
          <TimelineBubble
            event={event}
            isNew={isNew?.(event.occurredAt)}
            rendered={pickRenderer(event, registry)(event, ctx)}
          />
        </div>
      ))}
      <button
        type="button"
        // Deliberately mirrors the "N events · click to expand" the
        // reader just clicked, so the pair reads as one toggle rather
        // than as an open action and an unrelated close. Indented to
        // the bubbles' content column (past the 44px icon strip) so it
        // sits under the run it belongs to.
        onClick={onCollapse}
        className="ml-11 flex items-center gap-1 pb-1 pl-3 text-[11px] text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
        </svg>
        Collapse {stack.events.length} events
      </button>
    </div>
  );
}
