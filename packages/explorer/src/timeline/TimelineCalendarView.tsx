'use client';

import { useMemo, useRef, useState } from 'react';
import { CARD_GRID } from '../ui/classes';
import { Chevron } from './icons';
import {
  buildMonthCells,
  dateKey,
  eventTone,
  formatMonth,
  shiftMonth,
  TONE_LABELS,
  TONE_INKS,
  toneColor,
  WEEKDAY_SHORT,
  type TimelineEvent,
  type TimelineRenderer,
  type TimelineTone,
} from './model';
import { TimelineCard } from './timeline-feed-parts';
import { useDismiss } from './useDismiss';

// ---------- The month grid --------------------------------------------------------------------------------------

const TONE_ORDER: TimelineTone[] = ['danger', 'structural', 'create', 'neutral'];

/**
 * One dot per tone on a day, with a count over one; a dot opens that day's events of that tone as the same cards
 * the list draws.
 */
export function TimelineCalendarView({
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
                      className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] transition hover:bg-slate-900/5 dark:hover:bg-white/10 ${TONE_INKS}`}
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
