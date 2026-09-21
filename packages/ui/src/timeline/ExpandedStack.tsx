'use client';

// An expanded run of same-kind events (spec/138 §2.1).
//
// Rendered as a FRAGMENT: the stack card stays at the head of the run
// as its toggle, and the member cards take the cells after it in the
// day's grid. A wrapper element would make the run one oversized grid
// item instead.
//
// The collapsed card is the click target that opened the run, so the
// same card, in the same cell, is what closes it: it stays put, reads
// "click to collapse", and drops its faux layers. A reader who opened a
// day of twelve renames to check one of them folds it back from where
// they started, not from a footer link under the run.

import { StackedCard } from './StackedCard';
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
  onCollapse,
  isNew,
  focusEventId,
}: {
  stack: TimelineStack;
  registry: TimelineRendererRegistry;
  ctx: TimelineRendererContext;
  cardSlots?: TimelineCardSlotsFor;
  onCollapse: () => void;
  isNew?: (occurredAt: number) => boolean;
  focusEventId?: string;
}) {
  return (
    <>
      <StackedCard
        stack={stack}
        registry={registry}
        ctx={ctx}
        expanded
        isNew={stack.events.some((e) => isNew?.(e.occurredAt))}
        onToggle={onCollapse}
      />
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
