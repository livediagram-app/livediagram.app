'use client';

import { useState } from 'react';
import {
  pageViewApp,
  type PageViewApp,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// Pages view (spec/150): which pages across the whole site get viewed. Every
// frontend emits `Page·View·<path>` on each path change, full load or in-app
// navigation, with ids and query strings stripped in the browser. A headline
// total, then the ranking, filterable by the app that serves the page (the
// split the router routes by, shared from api-schema).
const GROUPS: MetricGroup[] = [
  {
    title: 'Page views',
    metrics: [
      {
        category: 'Page',
        action: 'View',
        allTypes: true,
        title: 'Page Views',
        blurb: 'Pages viewed across the site, by full load or in-app navigation.',
      },
    ],
  },
];

type AppFilter = 'All' | PageViewApp;
const FILTERS: AppFilter[] = ['All', 'Marketing', 'Editor', 'Help', 'Dashboard'];

export function PagesView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const [app, setApp] = useState<AppFilter>('All');
  const pages = rank(
    summary.windows[active].rows,
    (r) =>
      r.category === 'Page' &&
      r.action === 'View' &&
      (app === 'All' || (r.type !== null && pageViewApp(r.type) === app)),
  );

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Which pages people view, for <span className="font-medium">{windowLabel(active)}</span>. Ids
        and query strings never leave the browser, so every diagram counts as one page.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by app">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setApp(f)}
            aria-pressed={app === f}
            className={
              'cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition ' +
              (app === f
                ? 'bg-brand-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <RankCard
          title="Most-viewed pages"
          subtitle="Pages by views, most to least"
          category="Page"
          action="View"
          items={pages}
          daily={summary.daily}
          emptyLabel="No page views in this window yet."
        />
      </div>
    </div>
  );
}
