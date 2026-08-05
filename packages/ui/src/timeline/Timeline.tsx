'use client';

// The feed (spec/138 §2).
//
// Owns its own header — the mode switch, the filter popover, the
// refresh button — so a consumer drops it into a plain card rather
// than wrapping it in a panel whose header would pre-empt the controls.
//
// State the component owns: view mode, excluded source types, the
// calendar's month cursor, which stacks are expanded, and which day is
// pulsing. State the consumer owns: the events themselves, paging, and
// refreshing — because only the consumer knows how to fetch.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TimelineGroup } from './TimelineGroup';
import { TimelineBubble } from './TimelineBubble';
import { StackedBubble } from './StackedBubble';
import { TimelineCalendarView } from './TimelineCalendarView';
import { TimelineFilterPopover } from './TimelineFilterPopover';
import { buildStacks } from './stacking';
import { monthKeyOf } from './monthCells';
import { pickRenderer } from './renderers';
import { dateKey, useTimelineGrouping } from './useTimelineGrouping';
import type { TimelineEvent, TimelineMode, TimelineRendererRegistry } from './types';

export type TimelineProps = {
  events: TimelineEvent[];
  // Compared against each event's actorId so renderers can say "You".
  viewerId: string | null;
  // The heading above the feed. Pass `null` when the host already
  // renders one — the Explorer's pane header does, and two "Timeline"
  // headings stacked on each other reads as a rendering bug. The count
  // badge stays either way; it's the part that carries information.
  title?: string | null;
  renderers?: TimelineRendererRegistry;
  loading?: boolean;
  // Rendered when there are no events at all. Distinct from the
  // everything-filtered-out state, which the component owns — telling
  // someone with three years of history that they have none because a
  // chip is off is the kind of small lie that erodes trust in a feed.
  emptyState?: React.ReactNode;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  lastRefreshedAt?: number;
  onModeChange?: (mode: TimelineMode) => void;
  onFilterChange?: (excluded: string[]) => void;
  onStackExpand?: () => void;
};

export function Timeline({
  events,
  viewerId,
  title = 'Timeline',
  renderers = {},
  loading,
  emptyState,
  hasMore,
  loadingMore,
  onLoadMore,
  onRefresh,
  refreshing,
  lastRefreshedAt,
  onModeChange,
  onFilterChange,
  onStackExpand,
}: TimelineProps) {
  // Not persisted across navigation, on purpose: someone who looked at
  // the calendar once should not find the feed in calendar mode a week
  // later wondering where their list went.
  const [mode, setMode] = useState<TimelineMode>('list');
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(Date.now()));
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const [pulseDay, setPulseDay] = useState<string | null>(null);
  const ctx = useMemo(() => ({ viewerId }), [viewerId]);

  // Derived from the events actually present, not a hard-coded list, so
  // a source type a newer worker starts emitting gets a chip for free.
  const allSourceTypes = useMemo(() => {
    const seen = new Set<string>();
    for (const event of events) seen.add(event.sourceType);
    return [...seen].sort();
  }, [events]);

  const visible = useMemo(
    () => (excluded.size === 0 ? events : events.filter((e) => !excluded.has(e.sourceType))),
    [events, excluded],
  );

  const groups = useTimelineGrouping(visible);

  const eventDates = useMemo(() => {
    const set = new Set<string>();
    for (const event of visible) set.add(dateKey(event.occurredAt));
    return set;
  }, [visible]);

  const toggleType = useCallback(
    (sourceType: string) => {
      setExcluded((prev) => {
        const next = new Set(prev);
        if (next.has(sourceType)) next.delete(sourceType);
        else next.add(sourceType);
        onFilterChange?.([...next]);
        return next;
      });
    },
    [onFilterChange],
  );

  const changeMode = useCallback(
    (next: TimelineMode) => {
      setMode(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );

  const pickDate = useCallback((key: string) => {
    // The group may be far down a long feed, so scroll to it rather
    // than assuming it's on screen, then pulse it — otherwise the
    // reader lands somewhere new with no signal about why.
    document
      .querySelector(`[data-timeline-day="${key}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setPulseDay(key);
  }, []);

  // Clear the pulse after it has played. Guarded on pulseDay so the
  // timer only exists while one is running.
  useEffect(() => {
    if (!pulseDay) return;
    const timer = setTimeout(() => setPulseDay(null), 1400);
    return () => clearTimeout(timer);
  }, [pulseDay]);

  const filterButton = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {title && (
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          )}
          {events.length > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {events.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {(['list', 'calendar'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => changeMode(value)}
                className={`rounded-md px-2.5 py-1 text-xs capitalize transition ${
                  mode === value
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          <div className="flex items-center divide-x divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            <button
              ref={filterButton}
              type="button"
              aria-label="Filter timeline"
              onClick={() =>
                setFilterAnchor((open) =>
                  open ? null : (filterButton.current?.getBoundingClientRect() ?? null),
                )
              }
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <FilterIcon />
              <span className="hidden md:inline">Filter</span>
              {excluded.size > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand-500" />
              )}
            </button>
            {onRefresh && (
              <button
                type="button"
                aria-label="Refresh timeline"
                disabled={refreshing}
                onClick={onRefresh}
                title={
                  lastRefreshedAt
                    ? `Last refreshed ${new Date(lastRefreshedAt).toLocaleString('en-GB')}`
                    : undefined
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100"
              >
                <RefreshIcon spinning={refreshing} />
                <span className="hidden md:inline">Refresh</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {loading ? (
        <SkeletonFeed />
      ) : events.length === 0 ? (
        (emptyState ?? null)
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No events match these filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setExcluded(new Set());
              onFilterChange?.([]);
            }}
            className="mt-2 text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            Clear filters
          </button>
        </div>
      ) : mode === 'calendar' ? (
        <TimelineCalendarView
          events={visible}
          monthKey={monthKey}
          onMonthChange={setMonthKey}
          registry={renderers}
          ctx={ctx}
        />
      ) : (
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
                const single = stack.events.length === 1;
                const open = expanded.has(stack.key);
                if (single || open) {
                  return stack.events.map((event) => (
                    <TimelineBubble
                      key={event.id}
                      event={event}
                      rendered={pickRenderer(event, renderers)(event, ctx)}
                    />
                  ));
                }
                return (
                  <StackedBubble
                    key={stack.key}
                    stack={stack}
                    registry={renderers}
                    ctx={ctx}
                    onExpand={() => {
                      setExpanded((prev) => new Set(prev).add(stack.key));
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
      )}

      {filterAnchor && (
        <TimelineFilterPopover
          anchor={filterAnchor}
          allSourceTypes={allSourceTypes}
          excluded={excluded}
          onToggle={toggleType}
          onReset={() => {
            setExcluded(new Set());
            onFilterChange?.([]);
          }}
          eventDates={eventDates}
          monthKey={monthKey}
          onMonthChange={setMonthKey}
          onPickDate={pickDate}
          onClose={() => setFilterAnchor(null)}
        />
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

function FilterIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4.5h18M6.75 12h10.5M11.25 19.5h1.5"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 ${spinning ? 'animate-spin' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992V4.356M2.985 19.644v-4.992h4.992m-4.253-4.5a8.25 8.25 0 0113.803-3.7l3.181 3.182m0 0V4.5m0 5.634h-5.634M2.985 14.652l3.181 3.183a8.25 8.25 0 0013.803-3.7"
      />
    </svg>
  );
}
