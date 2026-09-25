'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { PAGE_INSIGHTS } from './page-insight-defs';
import { PAGE_VIEW_APPS, pageViewRows, readInsight } from './page-insights';
import { CardColumns } from './CardColumns';
import { InsightTile } from './PageInsights';
import { RankCard } from './RankCard';
import { WINDOW_META, windowHighlightFrom, windowLabel } from './windows';

// Pages view (spec/150): which pages across the site get viewed, broken down
// by the app that serves them. Every frontend emits `Page·View·<path>` on
// each path change (full load or in-app navigation), with ids and query
// strings stripped in the browser. Top to bottom: insights (one count over
// another, each with its change and trend), then the ten most-viewed pages
// overall and each app's own top ten.

// Each ranking card shows its top ten.
const TOP = 10;

export function PagesView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;

  const windowDays = WINDOW_META.find((w) => w.key === active)?.days ?? 30;
  const highlightFromIndex = summary.daily ? windowHighlightFrom(summary.daily, active) : null;
  // The span each insight's change is measured against: the same number of
  // days just before the window. The 30 days of series can't reach behind the
  // 30-day window itself, so that one shows no change.
  const previousLabel =
    windowDays * 2 <= (summary.daily?.days.length ?? 0)
      ? windowDays === 1
        ? 'the day before'
        : `the ${windowDays} days before`
      : null;

  // The ranking cards, for CardColumns to balance: apps serve very different
  // numbers of pages (Live has many, Help and Dashboard few).
  const rankings = [
    {
      key: 'all',
      title: 'Top 10 Pages',
      subtitle: 'The most-viewed pages across every app',
      items: pageViewRows(rows, 'All').slice(0, TOP),
      emptyLabel: 'No page views in this window yet.',
    },
    ...PAGE_VIEW_APPS.map((app) => ({
      key: app,
      title: app,
      subtitle: 'Its ten most-viewed pages',
      items: pageViewRows(rows, app).slice(0, TOP),
      emptyLabel: `No ${app} page views in this window yet.`,
    })),
  ];

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Which pages people view, for <span className="font-medium">{windowLabel(active)}</span>, by
        the app that serves them. Ids and query strings never leave the browser, so every diagram
        counts as one page, <code>/diagram</code>. Views per app are the Page Views by App stack on
        Highlights.
      </p>
      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Insights</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PAGE_INSIGHTS.map((def) => (
            <InsightTile
              key={def.id}
              def={def}
              reading={readInsight(def, rows, summary.daily, windowDays)}
              highlightFromIndex={highlightFromIndex}
              previousLabel={previousLabel}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Ratios compare page views, not people: nothing links one view to another.
        </p>
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top pages</h3>
        <div className="mt-3">
          <CardColumns>
            {rankings.map((r) => (
              <RankCard
                key={r.key}
                title={r.title}
                subtitle={r.subtitle}
                category="Page"
                action="View"
                items={r.items}
                daily={summary.daily}
                emptyLabel={r.emptyLabel}
              />
            ))}
          </CardColumns>
        </div>
      </section>
    </div>
  );
}
