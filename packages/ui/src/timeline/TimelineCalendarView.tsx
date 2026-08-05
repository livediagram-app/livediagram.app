'use client';

// The month grid (spec/138 §2.2).
//
// One coloured dot per source type present on a day, with a count
// badge above one. Clicking a dot opens a popover listing that day's
// events of that type as full bubbles — the SAME bubbles the list view
// draws, so there is one bubble implementation rather than a calendar
// flavour that drifts from it.

import { useEffect, useMemo, useRef, useState } from 'react';
import { dateKey } from './useTimelineGrouping';
import {
  buildMonthCells,
  formatMonth,
  monthKeyOf,
  nearestPopulatedMonth,
  shiftMonth,
} from './monthCells';
import { sourceTypeColor, sourceTypeLabel } from './sourceTypeMeta';
import { SourceTypeIcon, pickRenderer } from './renderers';
import { TimelineBubble } from './TimelineBubble';
import type { TimelineEvent, TimelineRendererContext, TimelineRendererRegistry } from './types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimelineCalendarView({
  events,
  monthKey,
  onMonthChange,
  registry,
  ctx,
  now,
}: {
  events: TimelineEvent[];
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  registry: TimelineRendererRegistry;
  ctx: TimelineRendererContext;
  now?: number;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Read once at mount rather than on every render: `Date.now()` in the
  // render body is an impure call whose result would change between
  // renders, and "which square is today" must not shift while someone
  // is looking at the grid. The `now` prop overrides it for tests.
  const [mountedAt] = useState(() => Date.now());

  // "2026-08-05::diagram" -> the events of that type on that day.
  const byDayAndType = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const key = `${dateKey(event.occurredAt)}::${event.sourceType}`;
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  // Source types present on each day, in a stable order so the dots
  // don't reshuffle between renders of the same data.
  const typesByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const event of events) {
      const key = dateKey(event.occurredAt);
      const list = map.get(key) ?? [];
      if (!list.includes(event.sourceType)) list.push(event.sourceType);
      map.set(key, list.sort());
    }
    return map;
  }, [events]);

  const populatedMonths = useMemo(
    () => new Set([...typesByDay.keys()].map((key) => key.slice(0, 7))),
    [typesByDay],
  );

  const previousMonth = nearestPopulatedMonth(populatedMonths, monthKey, -1);
  const nextMonth = nearestPopulatedMonth(populatedMonths, monthKey, 1);
  const cells = useMemo(() => buildMonthCells(monthKey), [monthKey]);
  const todayKey = dateKey(now ?? mountedAt);

  // Close the popover on any click outside it and on Escape. Listeners
  // are only mounted while one is open, so a closed calendar costs
  // nothing on every document click.
  useEffect(() => {
    if (!openCell) return;
    const onDown = (e: MouseEvent) => {
      if (!gridRef.current?.contains(e.target as Node)) setOpenCell(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCell(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openCell]);

  const openEvents = openCell ? (byDayAndType.get(openCell) ?? []) : [];

  return (
    <div ref={gridRef}>
      <div className="mb-3 flex items-center justify-between">
        <MonthArrow
          direction={-1}
          target={previousMonth}
          onPick={onMonthChange}
          label="No earlier events"
        />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {formatMonth(monthKey)}
        </p>
        <MonthArrow
          direction={1}
          target={nextMonth}
          onPick={onMonthChange}
          label="No later events"
        />
      </div>

      <div className="grid grid-cols-7 gap-px text-center">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
          >
            {day}
          </div>
        ))}
        {cells.map((cell, index) => {
          if (!cell.key) {
            // Pad squares carry no key of their own; the index is
            // stable because the grid is rebuilt whole per month.
            return <div key={`pad-${index}`} className="min-h-[68px]" />;
          }
          const types = typesByDay.get(cell.key) ?? [];
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
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {cell.day}
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {types.map((sourceType) => {
                  const key = `${cell.key}::${sourceType}`;
                  const count = byDayAndType.get(key)?.length ?? 0;
                  return (
                    <button
                      key={sourceType}
                      type="button"
                      title={`${count} ${sourceTypeLabel(sourceType).toLowerCase()} event${count === 1 ? '' : 's'}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setOpenCell((open) => (open === key ? null : key))}
                      className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] transition hover:bg-slate-900/5 dark:hover:bg-white/10"
                      style={{ color: sourceTypeColor(sourceType) }}
                    >
                      <SourceTypeIcon sourceType={sourceType} />
                      {count > 1 && <span className="font-semibold">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {openCell && openEvents.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {openCell.slice(0, 10)} · {sourceTypeLabel(openCell.split('::')[1] ?? '')}
            </p>
            <button
              type="button"
              onClick={() => setOpenCell(null)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <div className="space-y-1.5">
            {openEvents.map((event) => (
              <TimelineBubble
                key={event.id}
                event={event}
                rendered={pickRenderer(event, registry)(event, ctx)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MonthArrow({
  direction,
  target,
  onPick,
  label,
}: {
  direction: 1 | -1;
  target: string | null;
  onPick: (monthKey: string) => void;
  label: string;
}) {
  const disabled = target === null;
  return (
    <button
      type="button"
      disabled={disabled}
      // The title lands on the button either way. A disabled button
      // swallows pointer events, so the hint has to be the native
      // attribute rather than anything hover-driven.
      title={disabled ? label : undefined}
      aria-label={direction === 1 ? 'Later events' : 'Earlier events'}
      onClick={() => target && onPick(target)}
      className="rounded p-1 text-slate-500 transition enabled:hover:bg-slate-100 disabled:opacity-30 dark:text-slate-400 dark:enabled:hover:bg-slate-800"
    >
      <svg
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={direction === 1 ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
        />
      </svg>
    </button>
  );
}

export { monthKeyOf, shiftMonth };
