'use client';

import { EmptyState } from '@livediagram/ui';
import { metricKey, type TelemetryCount, type TelemetryDaily } from '@livediagram/api-schema';
import { pct } from './chart-utils';
import { categoryColor, typeLabel } from './event-vocab';
import { ActivityGlyph } from './glyphs';
import { MiniSparkline } from './MiniSparkline';
import { aliasedSeries, foldAliases, type TypeAliases } from './rank';
import { TrendBadge } from './TrendBadge';
import type { RankTrend } from './windows';

// A ranked usage list: rows sorted most-to-least, each with a share bar and
// (on desktop) a mini trend line, the top row tagged Most used. (No "least
// used" tag: unused features have no row, so the bottom isn't truly least.)
// Shared by the Look & Feel and Palette views so both render their rankings
// identically (the colour follows the row's telemetry category).

// `rank` lives in its own pure module so non-view code (page-views) can
// use it without importing a component; re-exported for the views.
export { rank } from './rank';

export function RankCard({
  title,
  subtitle,
  ...list
}: {
  title: string;
  subtitle: string;
} & RankListProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
      <RankList {...list} />
    </div>
  );
}

type RankListProps = {
  category: string;
  action: string;
  items: TelemetryCount[];
  daily: TelemetryDaily | undefined;
  emptyLabel: string;
  // The same old-spelling map the items were ranked with, so a folded row's
  // trend line includes the history stored under its old spelling.
  aliases?: TypeAliases;
  // The previous window, for each row's trend arrow (rankTrend). Omitted when
  // the api sent no previous windows.
  trend?: RankTrend;
  // The items come in a fixed order that means something (a funnel's steps),
  // not most-to-least: no Most used tag, and bars scale to the biggest row.
  ordered?: boolean;
  // How a row's type reads; the shared typeLabel unless the ranking knows a
  // better name (a tour step's own name, without its TourStep prefix).
  label?: (type: string) => string;
};

// The ranked rows, inside RankCard's frame.
function RankList({
  category,
  action,
  items,
  daily,
  emptyLabel,
  aliases,
  trend,
  ordered = false,
  label = typeLabel,
}: RankListProps) {
  const color = categoryColor(category);
  // Each row's count in the previous window, folded like the items were.
  const before = new Map<string, number>();
  if (trend) {
    const rows = aliases ? foldAliases(trend.rows, aliases) : trend.rows;
    for (const r of rows) before.set(metricKey(r.category, r.action, r.type), r.count);
  }
  if (items.length === 0) {
    return (
      <div className="mt-4">
        <EmptyState icon={<ActivityGlyph />} title="Nothing yet" description={emptyLabel} />
      </div>
    );
  }
  const widest = Math.max(...items.map((r) => r.count));
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {items.map((row, i) => {
        // Only the top row is tagged. We deliberately don't tag a "least
        // used" — features with zero usage have no row at all, so the
        // bottom of this list isn't truly the least used, just the lowest
        // among those that have any data.
        const isTop = !ordered && items.length > 1 && i === 0;
        const series = daily
          ? aliasedSeries(daily.byMetric, category, action, row.type, aliases)
          : undefined;
        return (
          <li key={row.type} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-slate-700 dark:text-slate-200">
                    {label(row.type ?? '')}
                  </span>
                  {isTop ? <RankTag /> : null}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {trend ? (
                    <TrendBadge
                      now={row.count}

                      before={before.get(metricKey(row.category, row.action, row.type)) ?? 0}

                      against={trend.against}
                    />
                  ) : null}

                  <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {row.count.toLocaleString()}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${widest > 0 ? pct(row.count, widest) : 0}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
            {series ? (
              <MiniSparkline values={series} color={color} className="hidden h-6 w-20 sm:block" />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function RankTag() {
  return (
    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
      Most used
    </span>
  );
}
