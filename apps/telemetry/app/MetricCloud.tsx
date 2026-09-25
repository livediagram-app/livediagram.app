'use client';

import { useMemo, useState } from 'react';
import { categoryColor, typeLabel } from './event-vocab';
import type { Metric } from './metrics';

// The Search view's word cloud (spec/22): what shows while no metric is
// picked. Every category as a word, sized by how many events it had in the
// selected window, so the busy parts of the product are visible at a glance
// and the quiet ones are still there to find. Clicking a word drills one
// level (category, then action, then type); clicking a last level picks that
// metric and charts it, exactly as picking it from the search box does.
//
// Sizes are on a log scale: counts here span several orders of magnitude
// (thousands of element adds beside a handful of sign-ups), and a linear
// scale shrinks everything but the top two words to the minimum. Words with
// no events in the window stay, dimmed, since "nothing this week" is itself
// worth seeing.

const MIN_PX = 13;
const MAX_PX = 40;

type Word = { key: string; label: string; count: number; color: string; activate: () => void };

export function MetricCloud({
  metrics,
  counts,
  onSelect,
}: {
  metrics: Metric[];
  counts: Map<string, number>; // selected-window count per metric key
  onSelect: (metric: Metric) => void;
}) {
  // [] = categories; [category] = its actions; [category, action] = its types.
  const [path, setPath] = useState<string[]>([]);
  const [category, action] = path;

  const words = useMemo<Word[]>(() => {
    const countOf = (m: Metric) => counts.get(m.key) ?? 0;
    const group = (items: Metric[], by: (m: Metric) => string) => {
      const map = new Map<string, Metric[]>();
      for (const m of items) map.set(by(m), [...(map.get(by(m)) ?? []), m]);
      return [...map.entries()];
    };
    const sum = (items: Metric[]) => items.reduce((n, m) => n + countOf(m), 0);
    if (category === undefined) {
      return group(metrics, (m) => m.category).map(([cat, items]) => ({
        key: cat,
        label: cat,
        count: sum(items),
        color: categoryColor(cat),
        activate: () => setPath([cat]),
      }));
    }
    const inCategory = metrics.filter((m) => m.category === category);
    const color = categoryColor(category);
    if (action === undefined) {
      return group(inCategory, (m) => m.action).map(([act, items]) => ({
        key: act,
        label: act,
        count: sum(items),
        color,
        // An action with one untyped metric has nothing further to drill.
        activate: () =>
          items.length === 1 && items[0]!.type === null
            ? onSelect(items[0]!)
            : setPath([category, act]),
      }));
    }
    return inCategory
      .filter((m) => m.action === action)
      .map((m) => ({
        key: m.key,
        label: m.type === null ? action : typeLabel(m.type),
        count: countOf(m),
        color,
        activate: () => onSelect(m),
      }));
  }, [metrics, counts, category, action, onSelect]);

  const sorted = [...words].sort((a, b) => a.label.localeCompare(b.label));
  const top = Math.max(1, ...words.map((w) => w.count));
  const size = (count: number) =>
    MIN_PX + (MAX_PX - MIN_PX) * (Math.log1p(count) / Math.log1p(top));

  const crumbs = [{ label: 'All events', to: [] as string[] }];
  if (category !== undefined) crumbs.push({ label: category, to: [category] });
  if (action !== undefined) crumbs.push({ label: action, to: [category!, action] });

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <nav aria-label="Event levels" className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <span key={c.label} className="flex items-center gap-1">
              {i > 0 ? <span className="text-slate-300 dark:text-slate-600">›</span> : null}
              {last ? (
                <span className="font-semibold text-slate-900 dark:text-slate-100">{c.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPath(c.to)}
                  className="cursor-pointer text-sky-600 hover:underline dark:text-sky-400"
                >
                  {c.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      <p className="mt-1 text-xs text-slate-400">
        {action !== undefined
          ? 'Pick one to chart it.'
          : 'Bigger words had more events in this window. Click one to look inside.'}
      </p>
      <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2">
        {sorted.map((w) => (
          <button
            key={w.key}
            type="button"
            onClick={w.activate}
            title={`${w.count.toLocaleString()} ${w.count === 1 ? 'event' : 'events'}`}
            style={{ fontSize: `${size(w.count)}px`, color: w.color }}
            className={`cursor-pointer font-semibold leading-tight transition hover:underline hover:opacity-80 ${
              w.count === 0 ? 'opacity-35' : ''
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}
