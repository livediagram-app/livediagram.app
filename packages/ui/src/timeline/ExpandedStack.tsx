'use client';

// The members of an expanded run of same-kind events (spec/138 §2.1).
//
// Rendered as a FRAGMENT: the member cards take the cells after the
// stack card in the day's grid. A wrapper element would make the run
// one oversized grid item instead.
//
// The stack card itself is NOT rendered here. It is the run's toggle in
// both states, and it has to be the SAME element across them so that
// collapsing doesn't remount it and replay its arrival animation: the
// feed renders <StackedCard> unconditionally and mounts this after it
// only while the run is open.

import { TimelineCard } from './TimelineCard';
import type { TimelineStack } from './stacking';
import { pickRenderer } from './renderers';
import type {
  TimelineCardSlotsFor,
  TimelineRendererContext,
  TimelineRendererRegistry,
} from './types';

// Slower than the first-load cascade: an expansion is a deliberate act
// on a handful of cards, so the fan is worth seeing. A whole page at
// this rate would drag.
const EXPAND_STAGGER_MS = 60;

export function ExpandedStack({
  stack,
  registry,
  ctx,
  cardSlots,
  isNew,
  focusEventId,
}: {
  stack: TimelineStack;
  registry: TimelineRendererRegistry;
  ctx: TimelineRendererContext;
  cardSlots?: TimelineCardSlotsFor;
  isNew?: (occurredAt: number) => boolean;
  focusEventId?: string;
}) {
  return (
    <>
      {stack.events.map((event, index) => (
        // The delay restarts at zero for the run rather than continuing
        // the page's cascade: what just arrived is these cards, and
        // carrying a global offset would make a stack halfway down the
        // feed sit still for a second before unfolding.
        <div
          key={event.id}
          className="tl-fan-out"
          style={{ animationDelay: `${index * EXPAND_STAGGER_MS}ms` }}
        >
          <TimelineCard
            event={event}
            isNew={isNew?.(event.occurredAt)}
            focused={event.id === focusEventId}
            rendered={pickRenderer(event, registry)(event, ctx)}
            slots={cardSlots?.(event)}
          />
        </div>
      ))}
    </>
  );
}
