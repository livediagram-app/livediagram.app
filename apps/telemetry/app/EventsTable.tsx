'use client';

import { useMemo, useState } from 'react';
import { Tooltip } from '@livediagram/ui';
import { metricKey, type TelemetryCount, type TelemetryDaily } from '@livediagram/api-schema';
import { pct } from './chart-utils';
import { categoryColor, eventExplanation, eventLabel } from './event-vocab';
import { EventIcon } from './telemetry-event-icon';
import { MiniSparkline } from './MiniSparkline';

// Every event in the window as a sortable, category-filterable table
// (spec/22), replacing the per-category accordions. One row per
// (category, action, type): the category badge, the event with its icon,
// the count + share-of-window with an inline bar, and a 30-day trend
// sparkline (from byMetric). Click a column header to sort (re-click
// toggles direction; count-desc is the default); the funnel on Category
// narrows to a chosen subset.

type SortKey = 'category' | 'event' | 'count';
type SortDir = 'asc' | 'desc';

// A column's natural first-click direction: text sorts A→Z, numbers high→low.
const COLUMNS: { key: SortKey; label: string; firstDir: SortDir; align: 'left' | 'right' }[] = [
  { key: 'category', label: 'Category', firstDir: 'asc', align: 'left' },
  { key: 'event', label: 'Event', firstDir: 'asc', align: 'left' },
  { key: 'count', label: 'Count', firstDir: 'desc', align: 'right' },
];

function compare(a: TelemetryCount, b: TelemetryCount, key: SortKey): number {
  if (key === 'count') return a.count - b.count;
  if (key === 'category') return a.category.localeCompare(b.category);
  return eventLabel(a).localeCompare(eventLabel(b));
}

function FunnelIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M1.5 2.5 H10.5 L7 6.5 V10 L5 9 V6.5 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EventsTable({
  rows,
  total,
  daily,
}: {
  rows: TelemetryCount[];
  total: number;
  daily: TelemetryDaily | undefined;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  // null = all categories shown; otherwise only the ones in the set.
  const [included, setIncluded] = useState<Set<string> | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const categories = useMemo(
    () => [...new Set(rows.map((r) => r.category))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  const visible = useMemo(() => {
    const filtered = included ? rows.filter((r) => included.has(r.category)) : rows;
    const out = [...filtered].sort((a, b) => compare(a, b, sortKey));
    if (sortDir === 'desc') out.reverse();
    return out;
  }, [rows, included, sortKey, sortDir]);

  const onSort = (col: (typeof COLUMNS)[number]) => {
    if (col.key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(col.key);
      setSortDir(col.firstDir);
    }
  };

  const toggleCategory = (c: string) =>
    setIncluded((prev) => {
      const next = new Set(prev ?? categories);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      // Collapse back to "all" when every category is checked again.
      return next.size === categories.length ? null : next;
    });

  const maxCount = Math.max(...visible.map((r) => r.count), 1);
  const filtering = included !== null;

  return (
    <div className="mt-8 overflow-visible rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/50">
            {COLUMNS.map((col) => {
              const activeSort = col.key === sortKey;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={activeSort ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={
                    'px-4 py-2.5 font-medium ' +
                    (col.align === 'right' ? 'text-right' : 'text-left')
                  }
                >
                  <span
                    className={
                      'inline-flex items-center gap-1 ' +
                      (col.align === 'right' ? 'justify-end' : '')
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSort(col)}
                      className={
                        'inline-flex cursor-pointer items-center gap-1 text-xs font-semibold uppercase tracking-wide transition hover:text-slate-900 dark:hover:text-slate-100 ' +
                        (activeSort ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400')
                      }
                    >
                      {col.label}
                      <span aria-hidden className="text-[9px]">
                        {activeSort ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                    {col.key === 'category' ? (
                      <span className="relative">
                        <button
                          type="button"
                          aria-label="Filter categories"
                          onClick={() => setFilterOpen((o) => !o)}
                          className={
                            'flex h-5 w-5 cursor-pointer items-center justify-center rounded transition hover:bg-slate-200 dark:hover:bg-slate-700 ' +
                            (filtering
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-400 hover:text-slate-600')
                          }
                        >
                          <FunnelIcon />
                        </button>
                        {filtering ? (
                          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
                        ) : null}
                        {filterOpen ? (
                          <CategoryFilter
                            categories={categories}
                            included={included}
                            onToggle={toggleCategory}
                            onAll={() => setIncluded(null)}
                            onClose={() => setFilterOpen(false)}
                          />
                        ) : null}
                      </span>
                    ) : null}
                  </span>
                </th>
              );
            })}
            {daily ? (
              <th
                scope="col"
                className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-400"
              >
                30-day trend
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => {
            const color = categoryColor(row.category);
            const series = daily?.byMetric[metricKey(row.category, row.action, row.type ?? null)];
            return (
              <tr
                key={`${row.category}:${row.action}:${row.type ?? ''}`}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
              >
                <td className="px-4 py-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: `${color}1a`, color }}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {row.category}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Tooltip
                    title={`${row.category} · ${eventLabel(row)}`}
                    description={eventExplanation(row.category, row.action, row.type ?? null)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="shrink-0" style={{ color }}>
                        <EventIcon
                          category={row.category}
                          action={row.action}
                          type={row.type ?? null}
                        />
                      </span>
                      <span className="truncate text-slate-700 dark:text-slate-200">
                        {eventLabel(row)}
                      </span>
                    </span>
                  </Tooltip>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-slate-800">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct(row.count, maxCount)}%`, backgroundColor: color }}
                      />
                    </span>
                    <span className="w-10 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">
                      {row.count.toLocaleString()}
                    </span>
                    <span className="hidden w-9 text-right text-xs tabular-nums text-slate-400 sm:block">
                      {pct(row.count, total).toFixed(1)}%
                    </span>
                  </div>
                </td>
                {daily ? (
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      {series ? (
                        <MiniSparkline values={series} color={color} />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CategoryFilter({
  categories,
  included,
  onToggle,
  onAll,
  onClose,
}: {
  categories: string[];
  included: Set<string> | null;
  onToggle: (c: string) => void;
  onAll: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Click-away backdrop. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-10 cursor-default"
      />
      <div className="absolute left-0 top-full z-20 mt-1.5 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Categories
          </span>
          <button
            type="button"
            onClick={onAll}
            className="cursor-pointer text-[11px] font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            All
          </button>
        </div>
        <ul className="max-h-64 overflow-auto">
          {categories.map((c) => {
            const checked = included === null || included.has(c);
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => onToggle(c)}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm normal-case transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <span
                    aria-hidden
                    className={
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] text-white ' +
                      (checked
                        ? 'border-brand-500 bg-brand-500'
                        : 'border-slate-300 dark:border-slate-600')
                    }
                  >
                    {checked ? '✓' : ''}
                  </span>
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-sm"
                    style={{ backgroundColor: categoryColor(c) }}
                  />
                  <span className="text-slate-700 dark:text-slate-200">{c}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
