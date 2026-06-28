'use client';

import { EmptyState } from '@livediagram/ui';
import { metricKey, type TelemetryCount, type TelemetryDaily } from '@livediagram/api-schema';
import { pct } from './chart-utils';
import { categoryColor, titleCase } from './event-vocab';
import { ActivityGlyph } from './glyphs';
import { MiniSparkline } from './MiniSparkline';

// A ranked usage list: rows sorted most-to-least, each with a share bar and
// (on desktop) a mini trend line, the top/bottom tagged Most / Least used.
// Shared by the Look & Feel and Palette views so both render their rankings
// identically (the colour follows the row's telemetry category).

// Filter rows to a predicate (with a non-empty type) and sort by count desc.
export function rank(
  rows: TelemetryCount[],
  predicate: (r: TelemetryCount) => boolean,
): TelemetryCount[] {
  return rows.filter((r) => predicate(r) && r.type).sort((a, b) => b.count - a.count);
}

export function RankCard({
  title,
  subtitle,
  category,
  action,
  items,
  daily,
  emptyLabel,
}: {
  title: string;
  subtitle: string;
  category: string;
  action: string;
  items: TelemetryCount[];
  daily: TelemetryDaily | undefined;
  emptyLabel: string;
}) {
  const color = categoryColor(category);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<ActivityGlyph />} title="Nothing yet" description={emptyLabel} />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {items.map((row, i) => {
            // Only the top row is tagged. We deliberately don't tag a "least
            // used" — features with zero usage have no row at all, so the
            // bottom of this list isn't truly the least used, just the lowest
            // among those that have any data.
            const isTop = items.length > 1 && i === 0;
            const series = daily?.byMetric[metricKey(category, action, row.type)];
            return (
              <li key={row.type} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {titleCase(row.type ?? '')}
                      </span>
                      {isTop ? <RankTag /> : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {row.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct(row.count, items[0]!.count)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
                {series ? (
                  <MiniSparkline
                    values={series}
                    color={color}
                    className="hidden h-6 w-20 sm:block"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RankTag() {
  return (
    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
      Most used
    </span>
  );
}
