'use client';

import { typeLabel } from './event-vocab';
import type { Metric } from './metrics';

// The Search view's breadcrumb (docs/specs/017-telemetry/telemetry.md). It shows over the word cloud while
// drilling (All events › category › action) and stays over a charted metric,
// ending in the metric itself, so any crumb steps straight back to that level
// of the cloud to browse the metric's siblings.

// A cloud level: [] = categories, [category] = its actions,
// [category, action] = its types.
export type CloudPath = string[];

export type Crumb = { label: string; to: CloudPath | null }; // null = the current page

// The trail for a cloud level, or for a charted metric (which adds itself as
// the current crumb; an untyped metric ends at its action instead).
export function metricCrumbs(path: CloudPath, metric: Metric | null = null): Crumb[] {
  const [category, action] = metric ? [metric.category, metric.action] : path;
  const crumbs: Crumb[] = [{ label: 'All events', to: [] }];
  if (category !== undefined) crumbs.push({ label: category, to: [category] });
  if (action !== undefined) crumbs.push({ label: action, to: [category!, action] });
  if (metric?.type != null) crumbs.push({ label: typeLabel(metric.type), to: null });
  // The last crumb is always where you are, not a link.
  crumbs[crumbs.length - 1]!.to = null;
  return crumbs;
}

export function MetricBreadcrumb({
  crumbs,
  onNavigate,
}: {
  crumbs: Crumb[];
  onNavigate: (path: CloudPath) => void;
}) {
  return (
    <nav aria-label="Event levels" className="flex flex-wrap items-center gap-1.5 text-sm">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? (
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              ›
            </span>
          ) : null}
          {c.to === null ? (
            <span
              aria-current="page"
              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900"
            >
              {c.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(c.to!)}
              className="cursor-pointer rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:text-white"
            >
              {c.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
