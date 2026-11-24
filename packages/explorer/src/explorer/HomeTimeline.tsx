'use client';

// Home's Recent, a timeline (liveworkspace/docs/specs/004-index/one-explorer.md "Recent, a timeline"): what the person made
// lately (New's items) and opened lately (Recent's) as one list of rows, newest first, under a heading per day ("Today",
// "Yesterday", "Saturday", then the date), each row led by its time and a mark on the line: a spark for one made, a
// ring for one opened. The rows are Home's own (HomeRow: the item's menu, rename and drag), so what a card does a row
// does. Days are the reader's own calendar days; the clock is their local time.

import { useMemo } from 'react';
import type { ShownItem } from '../data/overlay';
import type { ThisBrowserItem } from '../this-browser';
import { useNow } from '../time';
import { MUTED, SKELETON } from '../ui/classes';
import { useExplorer } from './context';
import { HomeRow } from './HomeCards';

type Shown = ShownItem | ThisBrowserItem;

export type TimelineEvent = { item: Shown; at: number; made: boolean };
export type TimelineDay = { key: string; at: number; events: TimelineEvent[] };

const DAY_MS = 86_400_000;

/** The local calendar day an instant falls on, as a key ("2026-11-24"). */
function dayKey(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** Midnight, local time, of the day `at` falls on. */
function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * The timeline: New's items by when each was made, Recent's by when each was last opened (or changed, for one never
 * opened), newest first, grouped by local day. New and Recent never hold the same item (home-sections.ts).
 */
export function timelineDays(made: readonly Shown[], opened: readonly Shown[]): TimelineDay[] {
  const events: TimelineEvent[] = [
    ...made.map((item) => ({ item, at: item.createdAt, made: true })),
    ...opened.map((item) => ({ item, at: item.lastOpenedAt ?? item.updatedAt, made: false })),
  ].sort((a, b) => b.at - a.at);
  const days: TimelineDay[] = [];
  for (const event of events) {
    const key = dayKey(event.at);
    const last = days[days.length - 1];
    if (last?.key === key) last.events.push(event);
    else days.push({ key, at: event.at, events: [event] });
  }
  return days;
}

/** A day's heading: Today, Yesterday, a weekday within the week, then the date ("Mon 10 Nov", with the year once it
 *  is another year's). */
export function dayHeading(at: number, now: number): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const date = new Date(at);
  if (days < 7) return date.toLocaleDateString('en-GB', { weekday: 'long' });
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.getFullYear() === new Date(now).getFullYear() ? '' : ` ${date.getFullYear()}`;
  return `${weekday} ${date.getDate()} ${month}${year}`;
}

/** A row's time, local and in 24 hours ("09:42"). */
export function clockOf(at: number): string {
  return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function HomeTimeline({
  made,
  opened,
  showApp,
}: {
  made: readonly Shown[];
  opened: readonly Shown[];
  showApp: boolean;
}) {
  const { words } = useExplorer();
  const now = useNow();
  const days = useMemo(() => timelineDays(made, opened), [made, opened]);
  return (
    <ol className="flex flex-col gap-5" data-home-timeline="">
      {days.map((day) => (
        <li key={day.key} data-timeline-day={day.key}>
          <h3 className="mb-1 flex items-center gap-3 text-[15px] font-extrabold tracking-[-0.01em] text-[#17153a] after:h-px after:flex-1 after:bg-slate-200 dark:text-slate-100 dark:after:bg-slate-700">
            <span className="min-h-5">{now ? dayHeading(day.at, now) : ''}</span>
            <span className={`text-xs font-medium tracking-normal ${MUTED}`}>
              {day.events.length} {day.events.length === 1 ? words.lowerOne : words.lowerMany}
            </span>
          </h3>
          <ul>
            {day.events.map((event) => (
              <li
                key={event.item.id}
                className="grid grid-cols-[2.25rem_1rem_minmax(0,1fr)] items-center gap-x-1 sm:grid-cols-[3rem_1.25rem_minmax(0,1fr)] sm:gap-x-2"
                data-timeline-event={event.made ? 'made' : 'opened'}
              >
                <span
                  className={`text-right text-[11px] tabular-nums sm:text-xs ${MUTED}`}
                  aria-hidden
                >
                  {now ? clockOf(event.at) : ''}
                </span>
                <EventMark made={event.made} />
                <HomeRow
                  item={event.item}
                  showApp={showApp}
                  line={event.made ? 'made-here' : 'opened-here'}
                />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

/** The mark on the line: a spark on the brand for something made, a ring for something opened. */
function EventMark({ made }: { made: boolean }) {
  return (
    <span
      aria-hidden
      className="relative grid h-full min-h-14 place-items-center before:absolute before:inset-y-0 before:left-1/2 before:w-0.5 before:-translate-x-1/2 before:bg-slate-200 dark:before:bg-slate-700"
    >
      {made ? (
        <span className="relative grid size-4 place-items-center rounded-full bg-brand-600 text-white dark:bg-brand-500">
          <svg viewBox="0 0 24 24" className="size-2.5" fill="currentColor">
            <path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6z" />
          </svg>
        </span>
      ) : (
        <span className="relative size-3 rounded-full border-2 border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-950" />
      )}
    </span>
  );
}

/** The timeline as it loads: a day's heading over a few rows, the same grid, so nothing jumps. */
export function TimelineSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="flex flex-col gap-2" data-home-timeline-skeleton="">
      <div className={`mb-1 h-4 w-24 ${SKELETON}`} />
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[2.25rem_1rem_minmax(0,1fr)] items-center gap-x-1 sm:grid-cols-[3rem_1.25rem_minmax(0,1fr)] sm:gap-x-2"
        >
          <div className={`ml-auto h-3 w-8 ${SKELETON}`} />
          <span />
          <div className="flex items-center gap-3 p-2">
            <div className={`h-11 w-16 shrink-0 rounded-lg ${SKELETON}`} />
            <div className="flex flex-1 flex-col gap-1.5">
              <div className={`h-3.5 w-2/3 ${SKELETON}`} />
              <div className={`h-3 w-1/3 ${SKELETON}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
