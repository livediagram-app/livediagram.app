'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { TextInput } from '@livediagram/ui';
import { categoryColor, eventLabel, titleCase } from './event-vocab';
import { SearchGlyph } from './glyphs';
import { EventIcon } from './telemetry-event-icon';
import type { Metric } from './metrics';

// The metric combobox for the Search view (spec/22). Two ways in, because
// you can't always name what you want:
//
//  - Type a query → flat token-AND matches across every metric's label.
//  - Leave it empty → BROWSE the hierarchy: categories → actions → the
//    specific (typed) metric, one level at a time. So a reader who only
//    knows "it's something about diagrams" can drill in and discover the
//    exact event without guessing its name.
//
// Both modes feed one `rows` list so keyboard nav (↑/↓, Enter) and the
// highlight styling are identical; ←/Backspace steps back up a level.

const MAX_MATCHES = 10;

// A single dropdown row, shared by browse + search so nav is uniform.
type Row = {
  id: string;
  leading: ReactNode;
  title: string;
  meta?: string; // muted middle note, e.g. "5 events"
  count: number;
  branch: boolean; // true → drills deeper (chevron); false → selects a metric
  activate: () => void;
};

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden
      className="text-slate-300 dark:text-slate-600"
    >
      <path
        d="M5 3 L9 7 L5 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CategorySwatch({ category }: { category: string }) {
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold text-white"
      style={{ backgroundColor: categoryColor(category) }}
    >
      {category.slice(0, 1)}
    </span>
  );
}

function EventChip({
  category,
  action,
  type,
}: {
  category: string;
  action: string;
  type: string | null;
}) {
  const color = categoryColor(category);
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <EventIcon category={category} action={action} type={type} />
    </span>
  );
}

export function MetricPicker({
  metrics,
  onSelect,
}: {
  metrics: Metric[];
  onSelect: (metric: Metric | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  // [] = category list; [category] = its actions; [category, action] = its types.
  const [path, setPath] = useState<string[]>([]);
  const listboxId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // category -> action -> metrics, for the browse levels.
  const tree = useMemo(() => {
    const byCat = new Map<string, Map<string, Metric[]>>();
    for (const m of metrics) {
      const byAct = byCat.get(m.category) ?? new Map<string, Metric[]>();
      const list = byAct.get(m.action) ?? [];
      list.push(m);
      byAct.set(m.action, list);
      byCat.set(m.category, byAct);
    }
    return byCat;
  }, [metrics]);

  const pick = (m: Metric) => {
    setQuery(m.label);
    setOpen(false);
    onSelect(m);
  };
  const drill = (next: string[]) => {
    setPath(next);
    setHighlight(0);
  };
  const back = () => {
    setPath((p) => p.slice(0, -1));
    setHighlight(0);
  };
  const reset = (q: string) => {
    setQuery(q);
    setPath([]);
    setHighlight(0);
    setOpen(true);
    onSelect(null);
  };

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const searching = tokens.length > 0;

  const rows = useMemo<Row[]>(() => {
    if (searching) {
      return metrics
        .filter((m) => {
          const hay = m.label.toLowerCase();
          return tokens.every((t) => hay.includes(t));
        })
        .slice(0, MAX_MATCHES)
        .map((m) => ({
          id: m.key,
          leading: <EventChip category={m.category} action={m.action} type={m.type} />,
          title: m.label,
          count: m.total30,
          branch: false,
          activate: () => pick(m),
        }));
    }

    const [cat, action] = path;
    // Level 2: the typed metrics under category + action.
    if (cat && action) {
      const ms = [...(tree.get(cat)?.get(action) ?? [])].sort((a, b) => b.total30 - a.total30);
      return ms.map((m) => ({
        id: m.key,
        leading: <EventChip category={m.category} action={m.action} type={m.type} />,
        title: titleCase(m.type ?? 'No type'),
        count: m.total30,
        branch: false,
        activate: () => pick(m),
      }));
    }
    // Level 1: the actions within a category.
    if (cat) {
      const byAct = tree.get(cat) ?? new Map<string, Metric[]>();
      return [...byAct.entries()]
        .map(([act, ms]) => ({ act, ms, total: ms.reduce((s, m) => s + m.total30, 0) }))
        .sort((a, b) => b.total - a.total)
        .map(({ act, ms, total }) => {
          if (ms.length === 1) {
            const m = ms[0]!;
            return {
              id: m.key,
              leading: <EventChip category={cat} action={act} type={m.type} />,
              title: eventLabel(m),
              count: m.total30,
              branch: false,
              activate: () => pick(m),
            };
          }
          return {
            id: `${cat}|${act}`,
            leading: <EventChip category={cat} action={act} type={null} />,
            title: titleCase(act),
            meta: `${ms.length} types`,
            count: total,
            branch: true,
            activate: () => drill([cat, act]),
          };
        });
    }
    // Level 0: the categories.
    return [...tree.entries()]
      .map(([category, byAct]) => {
        let total = 0;
        let metricCount = 0;
        for (const ms of byAct.values()) {
          metricCount += ms.length;
          for (const m of ms) total += m.total30;
        }
        return { category, total, metricCount };
      })
      .sort((a, b) => b.total - a.total)
      .map(({ category, total, metricCount }) => ({
        id: category,
        leading: <CategorySwatch category={category} />,
        title: category,
        meta: `${metricCount} metric${metricCount === 1 ? '' : 's'}`,
        count: total,
        branch: true,
        activate: () => drill([category]),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics, tree, query, path]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rows.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      rows[highlight]?.activate();
    } else if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowLeft' && !searching && path.length > 0) {
      back();
    } else if (e.key === 'Backspace' && query === '' && path.length > 0) {
      e.preventDefault();
      back();
    }
  };

  const header = searching
    ? `Matches (${rows.length})`
    : path.length === 0
      ? 'Browse by category'
      : null; // deeper levels render a breadcrumb back-button instead

  return (
    <div className="relative max-w-xl">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <SearchGlyph />
      </span>
      <TextInput
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className="!pl-9 !pr-9"
        placeholder="Search a metric, or browse — e.g. “element added”"
        value={query}
        onChange={(e) => reset(e.target.value)}
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
          onClick={() => reset('')}
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <span aria-hidden className="text-sm leading-none">
            ✕
          </span>
        </button>
      ) : null}

      {open ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-slate-700 dark:bg-slate-900">
          {header ? (
            <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800">
              {header}
            </p>
          ) : (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (blurTimer.current) clearTimeout(blurTimer.current);
                back();
              }}
              className="flex w-full cursor-pointer items-center gap-1.5 border-b border-slate-100 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700 dark:border-slate-800 dark:hover:text-slate-300"
            >
              <span aria-hidden className="text-sm leading-none">
                ‹
              </span>
              {path.join(' › ')}
            </button>
          )}

          {rows.length > 0 ? (
            <ul id={listboxId} role="listbox" className="max-h-80 overflow-auto p-1">
              {rows.map((row, i) => (
                <li
                  key={row.id}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    // Keep focus on the input (avoid the blur-close race).
                    e.preventDefault();
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    row.activate();
                  }}
                  className={
                    'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ' +
                    (i === highlight
                      ? 'bg-brand-50 dark:bg-brand-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/60')
                  }
                >
                  {row.leading}
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700 dark:text-slate-200">
                    {row.title}
                  </span>
                  {row.meta ? (
                    <span className="shrink-0 text-xs text-slate-400">{row.meta}</span>
                  ) : null}
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {row.count.toLocaleString()}
                  </span>
                  {row.branch ? <Chevron /> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              No metrics match &ldquo;{query}&rdquo;.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
