'use client';

// The month grid (spec/138 §2.2).
//
// One coloured dot per tone present on a day, with a count badge above
// one. Clicking a dot opens a popover listing that day's events of that
// tone as cards — the SAME cards the list view draws, so there is one
// card implementation rather than a calendar flavour that drifts from
// it.

import { useEffect, useMemo, useRef, useState } from 'react';
import { dateKey } from './useTimelineGrouping';
import { buildMonthCells, formatMonth, monthKeyOf, shiftMonth } from './monthCells';
import { CARD_GRID } from '../cardGrid';
import { TONE_LABELS, eventTone, toneColor, type TimelineTone } from './eventTone';
import { pickRenderer } from './renderers';
import { TimelineCard } from './TimelineCard';
import type {
  TimelineCardSlotsFor,
  TimelineEvent,
  TimelineRendererContext,
  TimelineRendererRegistry,
} from './types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TimelineCalendarView({
  events,
  monthKey,
  onMonthChange,
  registry,
  ctx,
  cardSlots,
  now,
}: {
  events: TimelineEvent[];
  monthKey: string;
  onMonthChange: (monthKey: string) => void;
  registry: TimelineRendererRegistry;
  ctx: TimelineRendererContext;
  cardSlots?: TimelineCardSlotsFor;
  now?: number;
}) {
  const [openCell, setOpenCell] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Read once at mount rather than on every render: `Date.now()` in the
  // render body is an impure call whose result would change between
  // renders, and "which square is today" must not shift while someone
  // is looking at the grid. The `now` prop overrides it for tests.
  const [mountedAt] = useState(() => Date.now());

  // "2026-08-05::danger" -> that day's events of that tone.
  //
  // Grouped by TONE rather than by source type, matching the bubbles:
  // three dots that mean created / changed / removed answer "what kind
  // of day was that" at a glance, where "diagram vs team" does not.
  const byDayAndTone = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();
    for (const event of events) {
      const key = `${dateKey(event.occurredAt)}::${eventTone(event.eventType)}`;
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);

  // Tones present on each day, in a fixed severity order so the dots
  // never reshuffle between renders and the eye can rely on position.
  const tonesByDay = useMemo(() => {
    const order: TimelineTone[] = ['danger', 'structural', 'create', 'neutral'];
    const map = new Map<string, TimelineTone[]>();
    for (const event of events) {
      const key = dateKey(event.occurredAt);
      const tone = eventTone(event.eventType);
      const list = map.get(key) ?? [];
      if (!list.includes(tone)) list.push(tone);
      map.set(key, list);
    }
    for (const [key, list] of map) {
      map.set(
        key,
        [...list].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      );
    }
    return map;
  }, [events]);

  // Both directions page one month at a time.
  //
  // Months used to jump to the nearest month that had events and disable the
  // chevron when there wasn't one, which was right while the client held the
  // whole history. It stopped being right when the feed became paginated with
  // fetch-on-demand: "has events" could only be answered from the LOADED
  // events, i.e. the 50 on page one. So an active user with a busy month saw
  // both chevrons greyed out and titled "No earlier events" while the server
  // held years of them — and since paging is what triggers the period fetch,
  // the one control that could have loaded those months was the one being
  // disabled for not having loaded them.
  //
  // The cost is the honest one the original comment worried about: a quiet
  // quarter now takes a click per month. It beats a control that lies.
  const previousMonth = shiftMonth(monthKey, -1);
  const nextMonth = shiftMonth(monthKey, 1);
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

  const openEvents = openCell ? (byDayAndTone.get(openCell) ?? []) : [];

  return (
    <div ref={gridRef}>
      <div className="mb-3 flex items-center justify-between">
        {/* Paging is unconditional — a step is small enough that
            skipping empty months would hide the shape of a quiet
            stretch, which is often the thing you're looking at, and the
            visible month is fetched on demand either way. */}
        <MonthArrow direction={-1} target={previousMonth} onPick={onMonthChange} />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {formatMonth(monthKey)}
        </p>
        <MonthArrow direction={1} target={nextMonth} onPick={onMonthChange} />
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
          const tones = tonesByDay.get(cell.key) ?? [];
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
                {tones.map((tone) => {
                  const key = `${cell.key}::${tone}`;
                  const count = byDayAndTone.get(key)?.length ?? 0;
                  return (
                    <button
                      key={tone}
                      type="button"
                      title={`${count} ${TONE_LABELS[tone].toLowerCase()} event${count === 1 ? '' : 's'}`}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => setOpenCell((open) => (open === key ? null : key))}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition hover:bg-slate-900/5 dark:hover:bg-white/10"
                      style={{ color: toneColor(tone) }}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: toneColor(tone) }}
                      />
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
              {openCell.slice(0, 10)} ·{' '}
              {TONE_LABELS[(openCell.split('::')[1] ?? 'neutral') as TimelineTone]}
            </p>
            <button
              type="button"
              onClick={() => setOpenCell(null)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Close
            </button>
          </div>
          <div className={CARD_GRID}>
            {openEvents.map((event) => (
              <TimelineCard
                key={event.id}
                event={event}
                rendered={pickRenderer(event, registry)(event, ctx)}
                slots={cardSlots?.(event)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Always enabled: `target` is the adjacent period, which always exists.
// It used to be nullable, for a disabled "No earlier events" state that
// could only ever be derived from the loaded page — see the note at the
// call site.
function MonthArrow({
  direction,
  target,
  onPick,
}: {
  direction: 1 | -1;
  target: string;
  onPick: (monthKey: string) => void;
}) {
  return (
    <button
      type="button"
      aria-label={direction === 1 ? 'Later events' : 'Earlier events'}
      onClick={() => onPick(target)}
      className="rounded p-1 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
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
