'use client';

// The Timeline's feed (livediagram's @livediagram/ui Timeline): a rail of days, each day's events as cards in the
// Explorer's card grid, a day's runs of one kind folded into a stack, and a month grid as the other mode. It has no
// header of its own: the controls sit in the pane header (TimelineControls) and share one useTimelineControls
// state with it. It owns which stacks are open and nothing else; the events and their paging are the pane's.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  buildStacks,
  cascadeDelayMs,
  groupByDay,
  isNewEvent,
  type TimelineCardSlots,
  type TimelineEvent,
  type TimelineRenderer,
  type TimelineStack,
} from './model';
import type { TimelineControls } from './useTimelineControls';
import { QUIET_BUTTON, ShowMore, SkeletonFeed, TimelineErrorState } from './timeline-states';
import { StackedCard, TimelineCard, TimelineGroup } from './timeline-feed-parts';
import { TimelineCalendarView } from './TimelineCalendarView';

export { TimelineErrorState } from './timeline-states';
export { TimelineCard } from './timeline-feed-parts';
export { useDismiss } from './useDismiss';

export type TimelineProps = {
  controls: TimelineControls;
  /** Compared with each event's actor, so the reader's own doings are never New. */
  viewerId: string | null;
  render: TimelineRenderer;
  loading?: boolean;
  /** Nothing at all has happened (not: the filters hid everything). */
  isEmpty?: boolean;
  emptyState?: ReactNode;
  /** The read failed: with nothing loaded this outranks the empty state, since an unread feed is not an empty one. */
  error?: boolean;
  /** What the failed state says; the reader's own Timeline by default. */
  errorTitle?: string;
  onRetry?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  /** The last Show More failed: it says so, with Try Again. */
  moreFailed?: boolean;
  onLoadMore?: () => void;
  onStackExpand?: () => void;
  /** Events after this are New; null (never looked) marks none. */
  lastSeenAt?: number | null;
  /** A card's own controls (its ⋯ menu, a rename in place), by event. */
  cardSlots?: (event: TimelineEvent) => TimelineCardSlots | undefined;
  /** A stack's ⋯ menu, by stack. */
  stackSlots?: (stack: TimelineStack) => TimelineCardSlots | undefined;
  /** The event a link named (#event=<id>): its card is ringed, its stack held open, and it is scrolled to once. */
  focusEventId?: string | null;
};

export function Timeline({
  controls,
  viewerId,
  render,
  loading,
  isEmpty,
  emptyState,
  error,
  errorTitle,
  onRetry,
  hasMore,
  loadingMore,
  moreFailed,
  onLoadMore,
  onStackExpand,
  lastSeenAt = null,
  cardSlots,
  stackSlots,
  focusEventId = null,
}: TimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // Read once: which events are New must not shift while the reader looks.
  const [now] = useState(() => Date.now());
  const isNew = useCallback(
    (event: TimelineEvent) => isNewEvent(event, lastSeenAt, viewerId, now),
    [lastSeenAt, viewerId, now],
  );
  const { visibleEvents, pulseDay, clearPulse } = controls;
  const groups = useMemo(() => groupByDay(visibleEvents, now), [visibleEvents, now]);

  // Each event's place in the whole feed, so the first load cascades in global order rather than restarting per day.
  const fanIndex = useMemo(() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const group of groups) for (const event of group.events) map.set(event.id, i++);
    return map;
  }, [groups]);

  const toggleStack = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Scroll to the linked card once it is drawn; after paint, so the stack holding it has opened first.
  const scrolledTo = useRef<string | null>(null);
  const focusShown = Boolean(
    focusEventId && controls.mode === 'list' && visibleEvents.some((e) => e.id === focusEventId),
  );
  // The stack holding it opens once, and folds again like any other.
  const focusStack = useMemo(() => {
    if (!focusShown) return null;
    for (const group of groups) {
      for (const stack of buildStacks(group.events)) {
        if (stack.events.length > 1 && stack.events.some((e) => e.id === focusEventId)) {
          return stack.key;
        }
      }
    }
    return null;
  }, [focusShown, focusEventId, groups]);
  useEffect(() => {
    if (focusStack && scrolledTo.current !== focusEventId) {
      setExpanded((prev) => (prev.has(focusStack) ? prev : new Set(prev).add(focusStack)));
    }
  }, [focusStack, focusEventId]);
  useEffect(() => {
    if (!focusShown || !focusEventId || scrolledTo.current === focusEventId) return;
    if (focusStack && !expanded.has(focusStack)) return;
    const frame = requestAnimationFrame(() => {
      // The event's own card, not a stack's front card, which wears its first member's id.
      const card = [
        ...document.querySelectorAll(`[data-timeline-event="${CSS.escape(focusEventId)}"]`),
      ].find((el) => !el.closest('[data-timeline-stack]'));
      if (!card) return;
      scrolledTo.current = focusEventId;
      card.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusShown, focusEventId, focusStack, expanded]);

  useEffect(() => {
    if (!pulseDay) return;
    const timer = setTimeout(clearPulse, 1400);
    return () => clearTimeout(timer);
  }, [pulseDay, clearPulse]);

  if (loading) return <SkeletonFeed />;
  if (error && isEmpty) return <TimelineErrorState onRetry={onRetry} title={errorTitle} />;
  if (isEmpty) return <>{emptyState ?? null}</>;

  // Not the empty state: the filters hid what there is. They run on the loaded pages only, so while the index has
  // more the words claim no more than that, and Show More stays in reach.
  if (visibleEvents.length === 0) {
    return (
      <div>
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No {hasMore ? 'loaded events' : 'events'} match these filters
          </p>
          {hasMore ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Show More to look further back, or remove a filter.
            </p>
          ) : null}
          <button type="button" onClick={controls.resetFilters} className={`mt-3 ${QUIET_BUTTON}`}>
            Clear filters
          </button>
        </div>
        {hasMore ? (
          <ShowMore loading={loadingMore} failed={moreFailed} onClick={onLoadMore} />
        ) : null}
      </div>
    );
  }

  if (controls.mode === 'calendar') {
    return (
      <TimelineCalendarView
        events={visibleEvents}
        monthKey={controls.monthKey}
        onMonthChange={controls.setMonthKey}
        render={render}
        now={now}
      />
    );
  }

  return (
    <div data-timeline-feed="">
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
            if (stack.events.length === 1) {
              const event = stack.events[0]!;
              return (
                <div
                  key={event.id}
                  className="lw-tl-fan-out"
                  style={{ animationDelay: `${cascadeDelayMs(fanIndex.get(event.id) ?? 0)}ms` }}
                >
                  <TimelineCard
                    event={event}
                    isNew={isNew(event)}
                    rendered={render(event)}
                    slots={cardSlots?.(event)}
                    focused={event.id === focusEventId}
                  />
                </div>
              );
            }
            const open = expanded.has(stack.key);
            // One StackedCard in both states, so toggling never remounts it and replays its arrival.
            return (
              <Fragment key={stack.key}>
                <StackedCard
                  stack={stack}
                  render={render}
                  expanded={open}
                  isNew={stack.events.some(isNew)}
                  stagger={cascadeDelayMs(fanIndex.get(stack.events[0]!.id) ?? 0)}
                  slots={stackSlots?.(stack)}
                  onToggle={() => {
                    toggleStack(stack.key);
                    if (!open) onStackExpand?.();
                  }}
                />
                {open
                  ? stack.events.map((event, index) => (
                      <div
                        key={event.id}
                        className="lw-tl-fan-out"
                        style={{ animationDelay: `${cascadeDelayMs(index)}ms` }}
                      >
                        <TimelineCard
                          event={event}
                          isNew={isNew(event)}
                          rendered={render(event)}
                          slots={cardSlots?.(event)}
                          focused={event.id === focusEventId}
                        />
                      </div>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </TimelineGroup>
      ))}
      {hasMore ? <ShowMore loading={loadingMore} failed={moreFailed} onClick={onLoadMore} /> : null}
    </div>
  );
}
