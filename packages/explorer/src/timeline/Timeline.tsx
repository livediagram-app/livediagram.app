'use client';

// The Timeline's feed (livediagram's @livediagram/ui Timeline): a rail of days, each day's events as cards in the
// Explorer's card grid, a day's runs of one kind folded into a stack, and a month grid as the other mode. It has no
// header of its own: the controls sit in the pane header (TimelineControls) and share one useTimelineControls
// state with it. It owns which stacks are open and nothing else; the events and their paging are the pane's.

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { CARD_GRID, CARD_PREVIEW, CARD_SHELL, SOLID_BRAND_DARK_CONTROL } from '../ui/classes';
import { Chevron, eventIcon } from './icons';
import {
  buildMonthCells,
  buildStacks,
  cascadeDelayMs,
  dateKey,
  eventTone,
  formatMonth,
  groupByDay,
  isNewEvent,
  shiftMonth,
  stackLabel,
  timeLabel,
  TONE_LABELS,
  toneColor,
  toneSoftColor,
  WEEKDAY_SHORT,
  type TimelineCardRender,
  type TimelineCardSlots,
  type TimelineEvent,
  type TimelineRenderer,
  type TimelineStack,
  type TimelineTone,
} from './model';
import type { TimelineControls } from './useTimelineControls';

const SOLID_BRAND = `bg-brand-700 text-white ${SOLID_BRAND_DARK_CONTROL}`;

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
  onRetry?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onStackExpand?: () => void;
  /** Events after this are New; null (never looked) marks none. */
  lastSeenAt?: number | null;
};

export function Timeline({
  controls,
  viewerId,
  render,
  loading,
  isEmpty,
  emptyState,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  onStackExpand,
  lastSeenAt = null,
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

  useEffect(() => {
    if (!pulseDay) return;
    const timer = setTimeout(clearPulse, 1400);
    return () => clearTimeout(timer);
  }, [pulseDay, clearPulse]);

  if (loading) return <SkeletonFeed />;
  if (error && isEmpty) return <TimelineErrorState onRetry={onRetry} />;
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
        {hasMore ? <ShowMore loading={loadingMore} onClick={onLoadMore} /> : null}
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
                  <TimelineCard event={event} isNew={isNew(event)} rendered={render(event)} />
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
                        <TimelineCard event={event} isNew={isNew(event)} rendered={render(event)} />
                      </div>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </TimelineGroup>
      ))}
      {hasMore ? <ShowMore loading={loadingMore} onClick={onLoadMore} /> : null}
    </div>
  );
}

const QUIET_BUTTON =
  'rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

function ShowMore({ loading, onClick }: { loading?: boolean; onClick?: () => void }) {
  return (
    <div className="pt-2 text-center">
      <button type="button" disabled={loading} onClick={onClick} className={QUIET_BUTTON}>
        {loading ? 'Loading…' : 'Show More'}
      </button>
    </div>
  );
}

// A skeleton rather than the empty state: "nothing has happened" while loading is usually false.
function SkeletonFeed() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      {[0, 1].map((row) => (
        <div key={row} className="flex gap-4">
          <div className="mt-3 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className={CARD_GRID}>
              {[0, 1, 2].map((card) => (
                <div key={card} className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** "We couldn't read the feed": never the empty state, which would tell someone with a history that they have none. */
export function TimelineErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700"
    >
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Couldn&rsquo;t load your Timeline
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your history is safe. Check your connection and try again.
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={`mt-3 ${QUIET_BUTTON}`}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

// ---------- One day ---------------------------------------------------------------------------------------------

function TimelineGroup({
  label,
  year,
  isToday,
  dateKey: key,
  pulse,
  children,
}: {
  label: string;
  year: string;
  isToday: boolean;
  dateKey: string;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    // The mini calendar finds a day by this attribute: the day it scrolls to may not be mounted when it renders.
    <section
      className="flex gap-3 md:gap-4"
      data-timeline-day={key}
      aria-label={`${label} ${year}`}
    >
      <div className="flex flex-shrink-0 flex-col items-center">
        <div
          className={`mt-3 h-2.5 w-2.5 flex-shrink-0 rounded-full ${
            isToday ? 'bg-brand-500 ring-2 ring-brand-500/30' : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
        <div className="w-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <div className="mb-2 flex items-baseline gap-2 pt-1">
          {isToday ? (
            <span
              className={`inline-flex h-[19px] items-center rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide ${SOLID_BRAND}`}
            >
              Today
            </span>
          ) : null}
          <h2
            className={`whitespace-nowrap text-sm font-semibold ${
              isToday ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'
            } ${pulse ? 'lw-tl-date-pulse' : ''}`}
          >
            {label}
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{year}</p>
        </div>
        <div className={CARD_GRID}>{children}</div>
      </div>
    </section>
  );
}

// ---------- One event -------------------------------------------------------------------------------------------

function stop(e: MouseEvent | KeyboardEvent) {
  e.stopPropagation();
}

/**
 * One event as a card: the preview box, the title, the reason line in the event's tone, and the time with its
 * detail. The whole card opens what it is about, through one real button stretched across it, so the slots above
 * it (a menu, a rename) are never controls nested in a control.
 */
export function TimelineCard({
  event,
  rendered,
  slots,
  isNew,
  focused,
}: {
  event: TimelineEvent;
  rendered: TimelineCardRender;
  slots?: TimelineCardSlots;
  isNew?: boolean;
  focused?: boolean;
}) {
  const subject = slots?.subject ?? rendered.subject ?? event.title;
  const label = rendered.label ?? event.title;
  const description = rendered.description ?? null;
  const interactive = Boolean(rendered.onClick);
  const nameOf = (node: unknown) => (typeof node === 'string' ? node : null);
  const buttonName = [nameOf(subject) ?? event.title, nameOf(label)].filter(Boolean).join(', ');
  // Coloured by what happened, so a busy day answers "is any of this alarming?" before it is read.
  const tone = eventTone(event.type);
  return (
    <div
      onClick={rendered.onClick}
      onContextMenu={slots?.onContextMenu}
      data-timeline-event={event.id}
      className={`${CARD_SHELL} h-full has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-brand-500 has-[>button:focus-visible]:ring-offset-1 dark:has-[>button:focus-visible]:ring-offset-slate-900 ${
        focused ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-offset-slate-900 ' : ''
      }${interactive ? 'cursor-pointer' : 'opacity-60'}`}
    >
      {interactive ? (
        <button
          type="button"
          aria-label={buttonName}
          onClick={(e) => {
            e.stopPropagation();
            rendered.onClick?.();
          }}
          className="absolute inset-0 z-0 cursor-pointer rounded-[inherit] outline-none"
        />
      ) : null}
      <div className={`relative ${CARD_PREVIEW}`}>
        {rendered.preview ?? (
          <div
            aria-hidden
            className="flex h-full w-full items-center justify-center [&_svg]:h-10 [&_svg]:w-10"
            style={{ backgroundColor: toneSoftColor(tone), color: toneColor(tone) }}
          >
            {rendered.icon}
          </div>
        )}
        {isNew ? (
          <span
            className={`absolute left-2 top-2 inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide shadow-sm ${SOLID_BRAND}`}
          >
            New
          </span>
        ) : null}
        {rendered.badge ? (
          <span className="pointer-events-none absolute right-2 top-2 inline-flex">
            {rendered.badge}
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <div className="flex items-start gap-1">
          {slots?.title ? (
            <span className="relative z-10 min-w-0 flex-1" onClick={stop} onKeyDown={stop}>
              {slots.title}
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {subject}
            </span>
          )}
          {slots?.menu ? (
            <span
              className="relative z-10 shrink-0"
              onClick={stop}
              onKeyDown={stop}
              onContextMenu={stop}
            >
              {slots.menu}
            </span>
          ) : null}
        </div>
        <p
          className="flex items-center gap-1.5 text-xs font-medium [&_svg]:h-3.5 [&_svg]:w-3.5"
          style={{ color: toneColor(tone) }}
        >
          <span aria-hidden className="inline-flex shrink-0">
            {rendered.icon}
          </span>
          <span className="truncate">{label}</span>
        </p>
        <p className="break-words text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          <time dateTime={new Date(event.occurredAt).toISOString()}>
            {timeLabel(event.occurredAt)}
          </time>
          {rendered.meta ? (
            <>
              <span aria-hidden> · </span>
              <span>{rendered.meta}</span>
            </>
          ) : null}
        </p>
        {description ? (
          <p className="line-clamp-3 whitespace-pre-wrap break-words text-xs text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A run of one kind on one day, collapsed or open: one cell of the grid wearing the run's headline, with faux
 * cards stepping out behind it. Its preview shows the kind's glyph, not one member's picture, which could not
 * speak for the run. The same card toggles the run in both states.
 */
function StackedCard({
  stack,
  render,
  onToggle,
  expanded = false,
  isNew,
  stagger = 0,
}: {
  stack: TimelineStack;
  render: TimelineRenderer;
  onToggle: () => void;
  expanded?: boolean;
  isNew?: boolean;
  stagger?: number;
}) {
  const anchor = stack.events[0]!;
  const rendered = render(anchor);
  const count = stack.events.length;
  const deep = count >= 3 && !expanded;
  const layer =
    'pointer-events-none absolute inset-0 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';
  return (
    <div
      className="lw-tl-fan-out-up relative mb-3 mr-3 flex h-full flex-col"
      style={{ animationDelay: `${stagger}ms` }}
      data-timeline-stack={stack.key}
    >
      {deep ? (
        <div aria-hidden className={`${layer} translate-x-3 translate-y-3 opacity-50`} />
      ) : null}
      {!expanded ? (
        <div aria-hidden className={`${layer} translate-x-1.5 translate-y-1.5 opacity-75`} />
      ) : null}
      <div className="relative flex-1">
        <TimelineCard
          event={anchor}
          isNew={isNew}
          focused={expanded}
          rendered={{
            ...rendered,
            // The kind's own glyph: the anchor's (sparkles for an AI-made plan, say) would speak for the whole run.
            icon: eventIcon(anchor.type),
            subject: stackLabel(stack),
            label: `${count} events · click to ${expanded ? 'collapse' : 'expand'}`,
            description: null,
            meta: undefined,
            preview: undefined,
            badge: undefined,
            onClick: onToggle,
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-2 top-2 inline-flex h-5 items-center rounded-full bg-slate-900/70 px-2 text-[11px] font-semibold text-white dark:bg-white/80 dark:text-slate-900"
        >
          {count}
        </span>
      </div>
    </div>
  );
}

// ---------- The month grid --------------------------------------------------------------------------------------

const TONE_ORDER: TimelineTone[] = ['danger', 'structural', 'create', 'neutral'];

/**
 * One dot per tone on a day, with a count over one; a dot opens that day's events of that tone as the same cards
 * the list draws.
 */
function TimelineCalendarView({
  events,
  monthKey,
  onMonthChange,
  render,
  now,
}: {
  events: TimelineEvent[];
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  render: TimelineRenderer;
  now: number;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const byDayAndTone = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const key = `${dateKey(event.occurredAt)}::${eventTone(event.type)}`;
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);
  const tonesByDay = useMemo(() => {
    const map = new Map<string, Set<TimelineTone>>();
    for (const event of events) {
      const key = dateKey(event.occurredAt);
      const set = map.get(key) ?? new Set<TimelineTone>();
      set.add(eventTone(event.type));
      map.set(key, set);
    }
    return map;
  }, [events]);
  const cells = useMemo(() => buildMonthCells(monthKey), [monthKey]);
  const todayKey = dateKey(now);
  useDismiss(gridRef, () => setOpenCell(null), openCell !== null);
  const openEvents = openCell ? (byDayAndTone.get(openCell) ?? []) : [];

  return (
    <div ref={gridRef} data-timeline-calendar="">
      <div className="mb-3 flex items-center justify-between">
        <MonthArrow direction={-1} onPick={() => onMonthChange(shiftMonth(monthKey, -1))} />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {formatMonth(monthKey)}
        </p>
        <MonthArrow direction={1} onPick={() => onMonthChange(shiftMonth(monthKey, 1))} />
      </div>
      <div className="grid grid-cols-7 gap-px text-center">
        {WEEKDAY_SHORT.map((day) => (
          <div
            key={day}
            className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
          >
            {day}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.key) return <div key={`pad-${index}`} className="min-h-[68px]" />;
          const present = tonesByDay.get(cell.key);
          const tones = present ? TONE_ORDER.filter((t) => present.has(t)) : [];
          const isToday = cell.key === todayKey;
          return (
            <div
              key={cell.key}
              className={`min-h-[68px] rounded-md border p-1 text-left ${
                isToday
                  ? 'border-brand-400 bg-brand-50/60 dark:border-brand-500/60 dark:bg-brand-500/10'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <span
                className={`text-[11px] ${
                  isToday
                    ? 'font-semibold text-brand-700 dark:text-brand-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {cell.day}
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {tones.map((tone) => {
                  const key = `${cell.key}::${tone}`;
                  const count = byDayAndTone.get(key)?.length ?? 0;
                  const name = `${count} ${TONE_LABELS[tone].toLowerCase()} event${count === 1 ? '' : 's'}`;
                  return (
                    <button
                      key={tone}
                      type="button"
                      aria-label={name}
                      title={name}
                      aria-pressed={openCell === key}
                      onClick={() => setOpenCell((open) => (open === key ? null : key))}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition hover:bg-slate-900/5 dark:hover:bg-white/10"
                      style={{ color: toneColor(tone) }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: toneColor(tone) }}
                      />
                      {count > 1 ? <span className="font-semibold">{count}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {openCell && openEvents.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {openCell.slice(0, 10)} ·{' '}
              {TONE_LABELS[(openCell.split('::')[1] ?? 'neutral') as TimelineTone]}
            </p>
            <button
              type="button"
              onClick={() => setOpenCell(null)}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <div className={CARD_GRID}>
            {openEvents.map((event) => (
              <TimelineCard key={event.id} event={event} rendered={render(event)} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthArrow({ direction, onPick }: { direction: 1 | -1; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-label={direction === 1 ? 'Later events' : 'Earlier events'}
      onClick={onPick}
      className="rounded p-1 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
    >
      <Chevron direction={direction} size={16} />
    </button>
  );
}

/** Closes on a press outside `ref` (and outside `keep`, the control that toggles it) and on Escape, listening only
 *  while `enabled`. */
export function useDismiss(
  ref: { current: HTMLElement | null },
  onDismiss: () => void,
  enabled = true,
  keep?: string,
) {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;
  useEffect(() => {
    if (!enabled) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (keep && target?.closest?.(keep)) return;
      if (ref.current && !ref.current.contains(target)) latest.current();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') latest.current();
    };
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, enabled, keep]);
}
