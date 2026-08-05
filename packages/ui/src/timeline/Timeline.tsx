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

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TimelineGroup } from './TimelineGroup';
import { TimelineBubble } from './TimelineBubble';
import { StackedBubble } from './StackedBubble';
import { ExpandedStack } from './ExpandedStack';
import { isNewEvent } from './newness';
import { TimelineCalendarView } from './TimelineCalendarView';
import { buildStacks } from './stacking';
import { pickRenderer } from './renderers';
import { useTimelineGrouping } from './useTimelineGrouping';
import type { TimelineControls } from './useTimelineControls';
import type { TimelineRendererRegistry } from './types';

// Per-bubble delay in the arrival cascade — large enough that bubbles
// read as arriving in sequence rather than all at once.
const STAGGER_MS = 35;

// …and a ceiling on the total, because the cascade is only worth
// watching for the rows a reader can actually see. Ungapped, a 50-event
// page would start its last bubble 1.7s in, so the bottom of the feed
// sits blank long after the top has settled. Past the cap the remaining
// bubbles arrive together, which is invisible: they're below the fold.
const MAX_STAGGER_MS = 700;

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
  /** Events after this timestamp are marked New (spec/138 §2.5). */
  lastSeenAt?: number;
  /** Event id to scroll to and highlight — the deep-link target. */
  focusEventId?: string;
};

function staggerFor(index: number | undefined): number {
  return Math.min((index ?? 0) * STAGGER_MS, MAX_STAGGER_MS);
}

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
  lastSeenAt,
  focusEventId,
}: TimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Both bounds, and why the upper one exists, live in newness.ts.
  const isNew = useCallback(
    (occurredAt: number) => isNewEvent(occurredAt, lastSeenAt),
    [lastSeenAt],
  );
  const ctx = { viewerId };
  const { visibleEvents, pulseDay, clearPulse } = controls;
  const groups = useTimelineGrouping(visibleEvents);

  // Every visible event's position in the whole feed, so the first-load
  // cascade staggers by global order rather than restarting per day.
  //
  // Pre-computed into a map rather than incremented inside the JSX: the
  // index has to be the same however many times React calls the render
  // function (its development mode double-invokes), and it must not
  // depend on the order JSX children happen to be evaluated in.
  const fanIndex = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const group of groups) {
      for (const event of group.events) map.set(event.id, i++);
    }
    return map;
  }, [groups]);

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

  // Deep link (spec/138 §2.7). A linked event may be inside a collapsed
  // stack, so those stacks are forced open — otherwise the reader
  // follows a link to a row that isn't rendered and lands on a generic
  // "4 events" bubble with no idea which one they came for.
  //
  // DERIVED rather than pushed into `expanded` from an effect: which
  // stack holds the target is a function of the data, so computing it
  // avoids a setState-in-effect and the extra render that costs. The
  // reader can still collapse it — `expanded` stays a separate toggle.
  const forcedOpen = useMemo(() => {
    const keys = new Set<string>();
    if (!focusEventId) return keys;
    for (const group of groups) {
      for (const stack of buildStacks(group.events)) {
        if (stack.events.length > 1 && stack.events.some((e) => e.id === focusEventId)) {
          keys.add(stack.key);
        }
      }
    }
    return keys;
  }, [focusEventId, groups]);

  // Scroll after paint, so the row exists by the time we look for it.
  useEffect(() => {
    if (!focusEventId) return;
    const raf = requestAnimationFrame(() => {
      document
        .querySelector(`[data-timeline-event="${focusEventId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(raf);
  }, [focusEventId, groups]);

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
          onClick={controls.resetCategories}
          className="mt-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
        >
          Clear filters
        </button>
      </div>
    );
  }

  if (controls.mode === 'calendar' || controls.mode === 'week') {
    return (
      <TimelineCalendarView
        events={visibleEvents}
        monthKey={controls.monthKey}
        onMonthChange={controls.setMonthKey}
        weekKey={controls.mode === 'week' ? controls.weekKey : undefined}
        onWeekChange={controls.mode === 'week' ? controls.setWeekKey : undefined}
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
                <div
                  key={event.id}
                  className="tl-fan-out"
                  style={{ animationDelay: `${staggerFor(fanIndex.get(event.id))}ms` }}
                >
                  <TimelineBubble
                    event={event}
                    isNew={isNew(event.occurredAt)}
                    focused={event.id === focusEventId}
                    rendered={pickRenderer(event, renderers)(event, ctx)}
                  />
                </div>
              );
            }
            if (expanded.has(stack.key) || forcedOpen.has(stack.key)) {
              return (
                <ExpandedStack
                  key={stack.key}
                  stack={stack}
                  registry={renderers}
                  ctx={ctx}
                  isNew={isNew}
                  focusEventId={focusEventId}
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
                isNew={stack.events.some((e) => isNew(e.occurredAt))}
                stagger={staggerFor(fanIndex.get(stack.events[0]!.id))}
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
