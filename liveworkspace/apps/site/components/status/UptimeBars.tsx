import type { IncidentEntry, StatusHistory } from '@liveworkspace/status';
import {
  type KeyboardEvent,
  memo,
  type ReactNode,
  type PointerEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  dayView,
  formatDay,
  formatDuration,
  formatUptime,
  stateOfLetter,
  stripSummary,
} from '@/lib/status/history';
import { STATE_LOOK } from './status-ui';

// A service's last 90 days from the hourly checks (liveworkspace/docs/specs/010-site/site.md "Status"): a bar per day, oldest on the
// left. A bar's colour and its height both say the day's worst state, and the day itself (date, uptime, worst state
// as an icon and a word, incidents) shows on hover, focus or tap. To assistive tech the strip is one image with its
// summary in words; the arrow keys move through the days, and the day shown is announced.

const HEIGHT: Record<string, string> = {
  u: 'h-full',
  s: 'h-2/3',
  d: 'h-2/5',
  '-': 'h-1',
};

const NO_DATA_SWATCH = 'bg-slate-200 dark:bg-slate-700/70';

// Memoised: the board ticks every second for its countdown, and 35 strips of 90 bars needn't follow it.
export const UptimeBars = memo(function UptimeBars({
  history,
  serviceId,
  incidents,
  checked,
}: {
  history: StatusHistory;
  serviceId: string;
  incidents: readonly IncidentEntry[];
  // When the last run was, for the footer's left.
  checked?: ReactNode;
}) {
  const service = history.services[serviceId];
  const [active, setActive] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const tipId = useId();
  const summary = useMemo(() => stripSummary(history, serviceId), [history, serviceId]);
  const worst = service?.w ?? '-'.repeat(history.days);
  const days = history.days;

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const box = strip.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const i = Math.floor(((e.clientX - box.left) / box.width) * days);
    setActive(Math.min(days - 1, Math.max(0, i)));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowLeft'
        ? -1
        : e.key === 'ArrowRight'
          ? 1
          : e.key === 'Home'
            ? -days
            : e.key === 'End'
              ? days
              : 0;
    if (step === 0) {
      if (e.key === 'Escape') setActive(null);
      return;
    }
    e.preventDefault();
    setActive((i) => Math.min(days - 1, Math.max(0, (i ?? days - 1) + step)));
  };

  const day = active === null ? null : dayView(history, serviceId, active, incidents);

  return (
    <div className="relative min-w-0">
      <div
        ref={strip}
        role="img"
        aria-label={`Last ${days} days: ${summary}`}
        aria-describedby={day ? tipId : undefined}
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setActive(null);
        }}
        onFocus={() => setActive((i) => i ?? days - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
        className="flex h-7 cursor-default touch-pan-y items-end gap-px rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--lw-ink)] dark:focus-visible:outline-[var(--lw-ink-dark)]"
      >
        {Array.from({ length: days }, (_, i) => {
          const letter = worst[i] ?? '-';
          const state = stateOfLetter(letter);
          return (
            <span
              key={i}
              data-day={letter}
              className={`min-w-0 flex-1 rounded-[2px] transition-opacity duration-micro ${HEIGHT[letter] ?? 'h-1'} ${state ? STATE_LOOK[state].swatch : NO_DATA_SWATCH} ${active !== null && active !== i ? 'opacity-45' : ''}`}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
        <span className="min-w-0">{checked}</span>
        <span aria-hidden className="shrink-0">
          <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-200">
            {service?.p != null ? formatUptime(service.p) : 'No data yet'}
          </span>
          {service?.p != null ? ` over ${days} days` : ''}
        </span>
      </div>
      {day && active !== null ? (
        <DayTip id={tipId} day={day} index={active} days={days} at={history.at} />
      ) : null}
    </div>
  );
});

function DayTip({
  id,
  day,
  index,
  days,
  at,
}: {
  id: string;
  day: ReturnType<typeof dayView>;
  index: number;
  days: number;
  at: number | null;
}) {
  const look = day.worst ? STATE_LOOK[day.worst] : null;
  const Icon = look?.icon;
  // Kept inside the card: anchored at its bar, but never past either edge.
  const left = `clamp(0px, calc(${((index + 0.5) / days) * 100}% - 7rem), calc(100% - 14rem))`;
  return (
    <div
      id={id}
      role="tooltip"
      aria-live="polite"
      style={{ left }}
      className="pointer-events-none absolute bottom-full z-10 mb-2 w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
    >
      <p className="font-semibold text-slate-900 dark:text-white">{formatDay(day.day)}</p>
      {look && Icon ? (
        <p className="mt-1.5 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${look.badge}`}
          >
            <Icon />
            {day.worst === 'up' ? 'Up all day' : `Worst: ${look.word}`}
          </span>
          <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200">
            {day.uptime === null ? '' : `${formatUptime(day.uptime)} up`}
          </span>
        </p>
      ) : (
        <p className="mt-1.5 text-slate-500 dark:text-slate-400">No checks this day.</p>
      )}
      {day.incidents.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">
          {day.incidents.slice(0, 3).map(([, started, ended, worst]) => (
            <li key={started}>
              {worst === 'd' ? 'Down' : 'Slow'}{' '}
              {ended === null
                ? `since ${new Date(started).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}, ongoing`
                : `for ${formatDuration(ended - started)}`}
            </li>
          ))}
          {day.incidents.length > 3 ? <li>and {day.incidents.length - 3} more</li> : null}
        </ul>
      ) : look ? (
        <p className="mt-2 border-t border-slate-100 pt-2 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          No incidents.
        </p>
      ) : null}
      {at !== null && index === days - 1 ? (
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">Today so far.</p>
      ) : null}
    </div>
  );
}
