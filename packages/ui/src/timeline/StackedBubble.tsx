'use client';

// A collapsed run of same-kind events (spec/138 §2.1).
//
// Renders the newest member's bubble wearing a generic headline, with
// one or two faux-card layers stepping out to the right so the pile
// reads as depth rather than as a bubble with odd copy.

import { TimelineBubble } from './TimelineBubble';
import { stackLabel, type TimelineStack } from './stacking';
import type { TimelineRendererContext, TimelineRendererRegistry } from './types';
import { pickRenderer } from './renderers';

export function StackedBubble({
  stack,
  registry,
  ctx,
  onExpand,
  isNew,
}: {
  stack: TimelineStack;
  registry: TimelineRendererRegistry;
  ctx: TimelineRendererContext;
  onExpand: () => void;
  /** True when ANY member of the run is unseen — a collapsed stack
   *  hiding the one new thing in it would defeat the marker. */
  isNew?: boolean;
}) {
  const anchor = stack.events[0]!;
  const rendered = pickRenderer(anchor, registry)(anchor, ctx);
  const count = stack.events.length;
  // Two layers at three or more, one at two: a single thin layer behind
  // a pair of events reads as depth, but two layers behind a pair reads
  // as a deck that isn't there.
  const deep = count >= 3;

  return (
    <div className="relative mr-3">
      {deep && (
        <div
          aria-hidden
          className="pointer-events-none absolute -right-3 bottom-2 top-2 w-3 rounded-r-lg bg-slate-900/[0.04] dark:bg-white/[0.04]"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1.5 bottom-1 top-1 w-3 rounded-r-lg bg-slate-900/[0.06] dark:bg-white/[0.06]"
      />
      <div className="relative">
        <TimelineBubble
          event={anchor}
          isNew={isNew}
          rendered={{
            ...rendered,
            // The generic headline, not the anchor's own: "Renamed
            // Payments architecture" on a stack that also holds two
            // other diagrams is a sentence the reader can't trust.
            label: stackLabel(stack),
            description: `${count} events · click to expand`,
            meta: undefined,
            // The anchor's preview would speak for the whole run, and a
            // stack of five renames across five diagrams showing one of
            // their thumbnails is a claim the bubble can't support.
            preview: undefined,
            actions: [],
            onClick: onExpand,
          }}
        />
      </div>
    </div>
  );
}
