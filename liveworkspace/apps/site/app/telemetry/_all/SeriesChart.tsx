'use client';

import { StackTrendChart, type StackSeries } from '../_shared/StackTrendChart';
import { fmtDay } from '../_shared/chart-utils';

// One of Apps Compared's charts (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"): several daily
// series on one axis (StackTrendChart), the window shaded, the first and last day under it, and the same numbers as
// a table for a screen reader, since the drawing itself is hidden from one. Every series' count for a day is in that
// day's hover card.
export function SeriesChart({
  caption,
  days,
  series,
  highlightFromIndex,
  heightClassName = 'h-44',
}: {
  caption: string;
  days: number[];
  series: StackSeries[];
  highlightFromIndex: number;
  heightClassName?: string;
}) {
  return (
    <figure>
      <StackTrendChart
        days={days}
        series={series}
        highlightFromIndex={highlightFromIndex}
        heightClassName={heightClassName}
      />
      <div
        aria-hidden
        className="mt-2 flex justify-between text-[10px] text-slate-500 dark:text-slate-400"
      >
        <span>{fmtDay(days[0] ?? 0)}</span>
        <span>{fmtDay(days[days.length - 1] ?? 0)}</span>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Day (UTC)</th>
            {series.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((day, i) => (
            <tr key={day}>
              <th scope="row">{fmtDay(day)}</th>
              {series.map((s) => (
                <td key={s.label}>{(s.values[i] ?? 0).toLocaleString('en-GB')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// A legend swatch: a short line in the series' colour, dashed for a dashed series, in the series' app accent.
export function Swatch({ series }: { series: Pick<StackSeries, 'app' | 'dashed' | 'className'> }) {
  return (
    <span
      aria-hidden
      data-app={series.app}
      className={`inline-block w-4 shrink-0 border-t-2 ${series.dashed ? 'border-dashed' : ''} ${
        series.className ?? 'border-brand-500'
      }`}
    />
  );
}
