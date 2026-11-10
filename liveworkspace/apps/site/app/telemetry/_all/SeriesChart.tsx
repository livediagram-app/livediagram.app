'use client';

import { StackTrendChart, type StackSeries } from '../_shared/StackTrendChart';
import { fmtDay } from '../_shared/chart-utils';
import type { EmphasisStore } from '../_shared/chart-hover/emphasis';

// One of Apps Compared's charts (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"): several daily
// series on one axis (StackTrendChart), the window shaded, the first and last day under it, and the same numbers as
// a table for a screen reader, since the drawing itself is hidden from one. Every series' count for a day is in that
// day's tooltip (telemetry.md "Tooltips"), which can add the lines up as `totalLabel`; `emphasis` is the legend's.
export function SeriesChart({
  caption,
  days,
  series,
  highlightFromIndex,
  heightClassName = 'h-44',
  totalLabel,
  emphasis,
}: {
  caption: string;
  days: number[];
  series: StackSeries[];
  highlightFromIndex: number;
  heightClassName?: string;
  totalLabel?: string;
  emphasis?: EmphasisStore;
}) {
  return (
    <figure>
      <StackTrendChart
        days={days}
        series={series}
        highlightFromIndex={highlightFromIndex}
        heightClassName={heightClassName}
        label={caption}
        totalLabel={totalLabel}
        emphasis={emphasis}
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
