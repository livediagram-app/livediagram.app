'use client';

// The feed (spec/138 §2).
//
// Renders the day rail, the groups, and the bubbles. It deliberately
// has NO header of its own: the controls live in <TimelineControls>, so
// the host can put them in its own page-header row rather than stacking
// a second toolbar underneath one (spec/138 §2.3). Both halves share
// one `useTimelineControls()` state, so a filter chip and the list it
// filters can never disagree.
//
// State this owns: which stacks are expanded, and nothing else. The
// events and paging belong to the consumer, because only it knows how
// to fetch.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { TimelineGroup } from './TimelineGroup';
import { TimelineBubble } from './TimelineBubble';
import { StackedBubble } from './StackedBubble';
import { ExpandedStack } from './ExpandedStack';
import { TimelineCalendarView } from './TimelineCalendarView';
import { buildStacks } from './stacking';
import { pickRenderer } from './renderers';
import { useTimelineGrouping } from './useTimelineGrouping';
import type { TimelineControls } from './useTimelineControls';
import type { TimelineRendererRegistry } from './types';

export type TimelineProps = {
  /** Shared with <TimelineControls>; see useTimelineControls. */
  controls: TimelineControls;
  /** Compared against each event's actorId so renderers can say "You". */
  viewerId: string | null;
  renderers?: TimelineRendererRegistry;
  /** True while the first page is still resolving. */
  loading?: boolean;
  /** True when the feed is genuinely empty, as opposed to filtered empty. */
  isEmpty?: boolean;
  emptyState?: ReactNode;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onStackExpand?: () => void;
};

export function Timeline({
  controls,
  viewerId,
  renderers = {},
  loading,
  isEmpty,
  emptyState,
  hasMore,
  loadingMore,
  onLoadMore,
  onStackExpand,
}: TimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const ctx = { viewerId };
  const { visibleEvents, pulseDay, clearPulse } = controls;
  const groups = useTimelineGrouping(visibleEvents);

  // Expanding and collapsing are the same control, so they're one
  // handler. An expand-only set meant a run you opened to check a
  // single rename stayed open for the rest of the visit.
  const toggleStack = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Clear the mini-calendar pulse once it has played. Guarded on
  // pulseDay so the timer only exists while one is running.
  useEffect(() => {
    if (!pulseDay) return;
    const timer = setTimeout(clearPulse, 1400);
    return () => clearTimeout(timer);
  }, [pulseDay, clearPulse]);

  if (loading) return <SkeletonFeed />;
  if (isEmpty) return <>{emptyState ?? null}</>;

  // Distinct from the empty state above. Telling someone with three
  // years of history that they have none, because a chip is off, is the
  // kind of small lie that erodes trust in a feed.
  if (visibleEvents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
        <p className="text-sm text-slate-500 dark:text-slate-400">No events match these filters.</p>
        <button
          type="button"
          onClick={controls.resetTypes}
          className="mt-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
        >
          Clear filters
        </button>
      </div>
    );
  }

  if (controls.mode === 'calendar') {
    return (
      <TimelineCalendarView
        events={visibleEvents}
        monthKey={controls.monthKey}
        onMonthChange={controls.setMonthKey}
        registry={renderers}
        ctx={ctx}
      />
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <TimelineGroup
          key={group.key}
          label={group.label}
          year={group.year}
          isToday={group.isToday}
          isFuture={group.isFuture}
          dateKey={group.key}
          pulse={pulseDay === group.key}
        >
          {buildStacks(group.events).map((stack) => {
            // A stack of one was never collapsed, so there is no
            // collapse affordance to offer.
            if (stack.events.length === 1) {
              const event = stack.events[0]!;
              return (
                <TimelineBubble
                  key={event.id}
                  event={event}
                  rendered={pickRenderer(event, renderers)(event, ctx)}
                />
              );
            }
            if (expanded.has(stack.key)) {
              return (
                <ExpandedStack
                  key={stack.key}
                  stack={stack}
                  registry={renderers}
                  ctx={ctx}
                  onCollapse={() => toggleStack(stack.key)}
                />
              );
            }
            return (
              <StackedBubble
                key={stack.key}
                stack={stack}
                registry={renderers}
                ctx={ctx}
                onExpand={() => {
                  toggleStack(stack.key);
                  onStackExpand?.();
                }}
              />
            );
          })}
        </TimelineGroup>
      ))}

      {hasMore && (
        <div className="pt-2 text-center">
          <button
            type="button"
            disabled={loadingMore}
            onClick={onLoadMore}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  );
}

// A skeleton rather than a spinner or the empty state: the feed
// arriving after a fetch would otherwise pop in and read as a layout
// jump, and showing "nothing has happened yet" while loading is a
// statement that's usually false.
function SkeletonFeed() {
  return (
    <div className="space-y-6" aria-hidden>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-4">
          <div className="mt-3 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
