'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { categoryColor, typeLabel } from './event-vocab';
import type { Metric } from './metrics';

// The Search view's word cloud (spec/22): what shows while no metric is
// picked. Every category as a word, sized by how many events it had in the
// selected window, so the busy parts of the product are visible at a glance
// and the quiet ones are still there to find. Clicking a word drills one
// level (category, then action, then type); clicking a last level picks that
// metric and charts it, exactly as picking it from the search box does.
//
// How it reads:
//  - Biggest in the middle. Words are laid out centre-out (the busiest at the
//    centre, alternating outward), so the cloud has a heart instead of an
//    alphabetical ramp.
//  - Size, weight and opacity all follow the count, on a log scale: counts
//    span several orders of magnitude, and a linear scale shrank everything
//    but the top two words to the minimum. Words with no events in the window
//    stay, faint, since "nothing this week" is worth seeing.
//  - In dark mode the words are brightened: several category hues (the
//    deeper blues and purples) sink into a dark card otherwise.
//  - Pointing at a word lifts it and shows its count while the rest fade
//    back; each level floats in with a short stagger (`cloud-word-in`, off
//    under reduced motion).

const MIN_PX = 14;
const MAX_PX = 48;
const STAGGER_MS = 22;
const STAGGER_CAP_MS = 500;

type Word = { key: string; label: string; count: number; color: string; activate: () => void };

// Busiest first, then placed alternately either side of the middle, so the
// largest words sit at the centre of each wrapped line and the cloud tapers.
export function centreOut<T>(items: T[], weight: (item: T) => number): T[] {
  const sorted = [...items].sort((a, b) => weight(b) - weight(a));
  const out: T[] = [];
  sorted.forEach((item, i) => (i % 2 === 0 ? out.push(item) : out.unshift(item)));
  return out;
}

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

  const laidOut = centreOut(words, (w) => w.count);
  const top = Math.max(1, ...words.map((w) => w.count));
  const total = words.reduce((n, w) => n + w.count, 0);
  // 0..1 along the log scale: drives size, weight and opacity together.
  const scale = (count: number) => Math.log1p(count) / Math.log1p(top);
  const levelNoun =
    action !== undefined ? 'types' : category !== undefined ? 'actions' : 'categories';
  // The level's own hue for the backdrop glow: brand at the top, the
  // category's colour once inside one.
  const glow = category === undefined ? '#0ea5e9' : categoryColor(category);

  const crumbs = [{ label: 'All events', to: [] as string[] }];
  if (category !== undefined) crumbs.push({ label: category, to: [category] });
  if (action !== undefined) crumbs.push({ label: action, to: [category!, action] });

  return (
    <div className="relative mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      {/* A soft glow behind the heart of the cloud, in the level's hue. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-40"
        style={{
          background: `radial-gradient(60% 55% at 50% 58%, ${glow}1f, transparent 70%)`,
        }}
      />
      <div className="relative px-6 pb-8 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Event levels" className="flex flex-wrap items-center gap-1.5 text-sm">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <span key={c.label} className="flex items-center gap-1.5">
                  {i > 0 ? (
                    <span aria-hidden className="text-slate-300 dark:text-slate-600">
                      ›
                    </span>
                  ) : null}
                  {last ? (
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">
                      {c.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPath(c.to)}
                      className="cursor-pointer rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
                    >
                      {c.label}
                    </button>
                  )}
                </span>
              );
            })}
          </nav>
          <p className="text-xs tabular-nums text-slate-400">
            {total.toLocaleString()} {total === 1 ? 'event' : 'events'} across {words.length}{' '}
            {levelNoun}
          </p>
        </div>

        {/* Keyed by the level so each drill remounts the words and replays
            their float-in. Hovering the cloud fades every word back; the one
            under the pointer comes forward. */}
        <div
          key={path.join('|')}
          className="group/cloud mx-auto mt-6 flex min-h-56 max-w-4xl flex-wrap content-center items-center justify-center gap-x-5 gap-y-3"
        >
          {laidOut.map((w, i) => {
            const t = scale(w.count);
            const style: CSSProperties & Record<'--o', number> = {
              fontSize: `${MIN_PX + (MAX_PX - MIN_PX) * t}px`,
              fontWeight: Math.round(500 + 300 * t),
              color: w.color,
              '--o': w.count === 0 ? 0.3 : 0.6 + 0.4 * t,
              animationDelay: `${Math.min(i * STAGGER_MS, STAGGER_CAP_MS)}ms`,
            };
            return (
              <button
                key={w.key}
                type="button"
                onClick={w.activate}
                aria-label={`${w.label}, ${w.count.toLocaleString()} ${w.count === 1 ? 'event' : 'events'}`}
                style={style}
                className="cloud-word group/word relative cursor-pointer leading-none tracking-tight dark:brightness-[1.35] opacity-[var(--o)] transition duration-200 hover:-translate-y-0.5 hover:!opacity-100 focus-visible:!opacity-100 focus-visible:outline-none group-hover/cloud:opacity-40"
              >
                {w.label}
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white opacity-0 shadow transition group-hover/word:opacity-100 group-focus-visible/word:opacity-100 dark:bg-white dark:text-slate-900"
                >
                  {w.count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          {action !== undefined
            ? 'Pick one to chart it.'
            : 'Bigger words had more events in this window. Click one to look inside.'}
        </p>
      </div>
    </div>
  );
}
