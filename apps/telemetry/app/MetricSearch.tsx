'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { EmptyState, TextInput } from '@livediagram/ui';
import type { TelemetryDaily, TelemetryWindow, TelemetryWindowKey } from '@livediagram/api-schema';
import { categoryColor, eventExplanation, eventLabel } from './event-vocab';
import { ActivityGlyph } from './glyphs';
import { EventIcon } from './telemetry-event-icon';
import { TrendChart } from './TrendChart';
import { buildWindowCounts, WINDOW_META } from './windows';

// Small inline magnifier for the search field's leading icon (the glyph
// set has no search icon and this is the only place that needs one).
function MagnifierIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 L14 14" />
    </svg>
  );
}

// The Search view (spec/22): type to find one specific event, then see
// just that metric charted over time. The metric universe is exactly the
// keys of `daily.byMetric` — every event the api aggregated a 30-day
// series for — so anything offered here is guaranteed to have a line to
// draw. Window totals come from the same `windows` payload the Raw view
// uses, looked up per metric.

type Metric = {
  key: string;
  category: string;
  action: string;
  type: string | null;
  label: string; // "Category · Action · Type"
  total30: number; // sum of the 30-day series, for default ranking
};

const MAX_SUGGESTIONS = 8;

export function MetricSearch({
  windows,
  daily,
}: {
  windows: Record<TelemetryWindowKey, TelemetryWindow>;
  daily: TelemetryDaily;
}) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listboxId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const windowCounts = useMemo(() => buildWindowCounts(windows), [windows]);

  const metrics = useMemo<Metric[]>(() => {
    // `?? {}` guards a summary from an older api revision that predates
    // byMetric: the search simply finds nothing rather than throwing.
    return Object.entries(daily.byMetric ?? {})
      .map(([key, series]) => {
        const [category = '', action = '', type = ''] = key.split('|');
        return {
          key,
          category,
          action,
          type: type === '' ? null : type,
          label: `${category} · ${eventLabel({ action, type: type === '' ? null : type })}`,
          total30: series.reduce((sum, n) => sum + n, 0),
        };
      })
      .sort((a, b) => b.total30 - a.total30);
  }, [daily.byMetric]);

  // Token-AND match against the metric's full label so "elem add" finds
  // "Element · Added · …". Empty query shows the busiest metrics as
  // discoverable suggestions.
  const matches = useMemo<Metric[]>(() => {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const filtered =
      tokens.length === 0
        ? metrics
        : metrics.filter((m) => {
            const hay = m.label.toLowerCase();
            return tokens.every((t) => hay.includes(t));
          });
    return filtered.slice(0, MAX_SUGGESTIONS);
  }, [metrics, query]);

  const selected = useMemo(
    () => (selectedKey ? (metrics.find((m) => m.key === selectedKey) ?? null) : null),
    [metrics, selectedKey],
  );

  const choose = (m: Metric) => {
    setSelectedKey(m.key);
    setQuery(m.label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const m = matches[highlight];
      if (m) {
        e.preventDefault();
        choose(m);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // Nothing to search: an older api with no byMetric, or a brand-new
  // deployment with zero events. Show the illustrated empty state rather
  // than a dead search box.
  if (metrics.length === 0) {
    return (
      <EmptyState
        icon={<ActivityGlyph />}
        title="No metrics to search yet"
        description="Once events start arriving you’ll be able to find any single metric here and chart it over time."
      />
    );
  }

  const showDropdown = open && matches.length > 0;

  return (
    <div>
      <div className="relative max-w-xl">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <MagnifierIcon />
        </span>
        <TextInput
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className="!pl-9 !pr-9"
          placeholder="Search a metric — e.g. “element added” or “diagram shared”"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedKey(null);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Defer so a click on an option still registers before close.
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              setSelectedKey(null);
              setOpen(true);
              setHighlight(0);
            }}
            className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <span aria-hidden className="text-sm leading-none">
              ✕
            </span>
          </button>
        ) : null}

        {showDropdown ? (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
              {query ? `Matches (${matches.length})` : 'Busiest metrics'}
            </p>
            <ul id={listboxId} role="listbox" className="max-h-80 overflow-auto p-1">
              {matches.map((m, i) => {
                const color = categoryColor(m.category);
                return (
                  <li
                    key={m.key}
                    role="option"
                    aria-selected={i === highlight}
                    onMouseEnter={() => setHighlight(i)}
                    onMouseDown={(e) => {
                      // Keep focus on the input (avoid the blur-close race).
                      e.preventDefault();
                      if (blurTimer.current) clearTimeout(blurTimer.current);
                      choose(m);
                    }}
                    className={
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ' +
                      (i === highlight
                        ? 'bg-brand-50 dark:bg-brand-500/10'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')
                    }
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${color}1a`, color }}
                    >
                      <EventIcon category={m.category} action={m.action} type={m.type} />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
                      {m.label}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {m.total30.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {selected ? (
        <SelectedMetric metric={selected} windowCounts={windowCounts} daily={daily} />
      ) : (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Start typing to find a metric, then pick it to chart its last 30 days.
        </p>
      )}
    </div>
  );
}

function SelectedMetric({
  metric,
  windowCounts,
  daily,
}: {
  metric: Metric;
  windowCounts: Record<TelemetryWindowKey, Map<string, number>>;
  daily: TelemetryDaily;
}) {
  const color = categoryColor(metric.category);
  const series = daily.byMetric[metric.key] ?? [];
  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          <EventIcon category={metric.category} action={metric.action} type={metric.type} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {metric.label}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {eventExplanation(metric.category, metric.action, metric.type)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {WINDOW_META.map((w) => (
          <div key={w.key} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {w.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {(windowCounts[w.key].get(metric.key) ?? 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Daily trend — last 30 days
        </p>
        <div className="mt-4">
          <TrendChart days={daily.days} values={series} color={color} highlightFromIndex={null} />
        </div>
      </div>
    </div>
  );
}
