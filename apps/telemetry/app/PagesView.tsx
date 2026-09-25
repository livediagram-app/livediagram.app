'use client';

import {
  pageViewApp,
  type TelemetrySummary,
  type TelemetryWindowKey,
} from '@livediagram/api-schema';
import { RankCard } from './RankCard';
import { PAGE_VIEW_APPS, pageViewRows, per100 } from './page-insights';
import { PageInsightTile } from './PageInsights';
import { windowLabel } from './windows';

// Pages view (spec/150): which pages across the site get viewed, broken down
// by the app that serves them. Every frontend emits `Page·View·<path>` on
// each path change (full load or in-app navigation), with ids and query
// strings stripped in the browser. Top to bottom: a few derived insights,
// then the ten most-viewed pages overall and each app's own top ten.

// Each ranking card shows its top ten.
const TOP = 10;

const isLanding = (p: string) => p === '/';
const isNew = (p: string) => p === '/new';
const isExplorer = (p: string) => p === '/explorer' || p.startsWith('/explorer/');
const isDiagram = (p: string) => p === '/diagram';

export function PagesView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;

  const allPages = pageViewRows(rows, 'All');

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
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <PageInsightTile
            title="Landing to New Diagram"
            value={per100(rows, isLanding, isNew)}
            unit="per 100"
            detail="Views of /new for every 100 views of the landing page."
          />
          <PageInsightTile
            title="Explorer to Diagram"
            value={per100(rows, isExplorer, isDiagram)}
            unit="per 100"
            detail="Diagrams opened for every 100 views of an Explorer page."
          />
          <PageInsightTile
            title="Help per Diagram"
            value={per100(rows, isDiagram, (p) => pageViewApp(p) === 'Help')}
            unit="per 100"
            detail="Help-centre page views for every 100 diagram views."
          />
          <PageInsightTile
            title="Pages Viewed"
            value={allPages.length}
            detail="Distinct pages with at least one view in this window."
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Ratios compare page views, not people: nothing links one view to another.
        </p>
      </section>

      <section className="mt-8">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top pages</h3>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <RankCard
            title="Top 10 Pages"
            subtitle="The most-viewed pages across every app"
            category="Page"
            action="View"
            items={allPages.slice(0, TOP)}
            daily={summary.daily}
            emptyLabel="No page views in this window yet."
          />
          {PAGE_VIEW_APPS.map((app) => (
            <RankCard
              key={app}
              title={app}
              subtitle="Its ten most-viewed pages"
              category="Page"
              action="View"
              items={pageViewRows(rows, app).slice(0, TOP)}
              daily={summary.daily}
              emptyLabel={`No ${app} page views in this window yet.`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
