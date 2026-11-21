'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import type { TelemetryApp, TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import {
  ChartGlyph,
  KitGlyph,
  PersonGlyph,
  RankGlyph,
  ShieldGlyph,
  SparkGlyph,
} from './_shared/glyphs';
import { StickyWindowBar } from './_shared/StickyWindowBar';
import { ViewTabs } from './_shared/ViewTabs';
import { WindowPanel } from './_shared/WindowPanel';
import { previousSpanLabel, windowLabel } from './_shared/windows';
import { compareApps } from './_all/apps-compared';
import { Overview } from './_all/Overview';

// Only the Dashboard shows on arrival, so only it ships with the page: each Detail tab's code loads on its own,
// fetched while the browser is idle, so switching to one is still instant (as an app's tabs do, ActiveView).
const LOADERS = {
  events: () => import('./_all/EventsByApp').then((m) => m.EventsByApp),
  visitors: () => import('./_all/VisitorsAndAccounts').then((m) => m.VisitorsAndAccounts),
  kits: () => import('./_all/ProjectKits').then((m) => m.ProjectKits),
  forum: () => import('./_all/ForumChecks').then((m) => m.ForumChecks),
};
// Next needs each call's options written out in place.
const EventsByApp = dynamic(LOADERS.events, { ssr: false });
const VisitorsAndAccounts = dynamic(LOADERS.visitors, { ssr: false });
const ProjectKits = dynamic(LOADERS.kits, { ssr: false });
const ForumChecks = dynamic(LOADERS.forum, { ssr: false });

function prefetchTabs(): () => void {
  const run = () => {
    for (const load of Object.values(LOADERS)) void load().catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 1000);
  return () => window.clearTimeout(id);
}

// How many of the busiest events its tab lists.
const TOP_EVENTS = 25;

// All Apps' views, laid out as an app's are: the Dashboard, then a Detail tab an area.
type AllView = 'dashboard' | 'events-by-app' | 'visitors' | 'kits' | 'forum' | 'busiest';
const VIEWS: { key: AllView; label: string; icon: ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <SparkGlyph /> },
  { key: 'events-by-app', label: 'Events by App', icon: <ChartGlyph /> },
  { key: 'visitors', label: 'Visitors & Accounts', icon: <PersonGlyph /> },
  { key: 'kits', label: 'Project Kits', icon: <KitGlyph /> },
  { key: 'forum', label: 'Forum Checks', icon: <ShieldGlyph /> },
  { key: 'busiest', label: 'Busiest Events', icon: <RankGlyph /> },
];

const INTRO = 'mt-8 text-sm text-slate-500 dark:text-slate-400';

// "All Apps" (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): every app's events summed, in
// the shape of an app's own dashboard. The window panel, then the same tab row: the Dashboard (every app added up,
// then a card an app), and a Detail tab for each closer look, which keep to what every app shares: how the apps
// compare on events (Events by App) and on visitors and sign-ups (Visitors & Accounts), liveworkspace.app's own
// Project Kits and Forum Checks, and the busiest events. Picking an app opens its full dashboard. The window is the
// page's, so it stays when an app is picked.
export function AllApps({
  summary,
  onPickApp,
  active,
  onSelect,
}: {
  summary: TelemetrySummary;
  onPickApp: (app: TelemetryApp) => void;
  active: TelemetryWindowKey;
  onSelect: (key: TelemetryWindowKey) => void;
}) {
  const [view, setView] = useState<AllView>('dashboard');
  const window = summary.windows[active];
  const comparison = useMemo(() => compareApps(summary, active), [summary, active]);
  const against = previousSpanLabel(summary, active);
  // Watched by the StickyWindowBar: once this panel scrolls under the header, the condensed selector fades in.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => prefetchTabs(), []);
  const compared = (
    <p className={INTRO}>
      Each app in the {windowLabel(active).toLowerCase()}
      {against ? `, against ${against}` : ''}. The window above sets the span.
    </p>
  );

  return (
    <>
      <div ref={panelRef} className="mt-10">
        <WindowPanel
          totals={{
            today: summary.windows.today.total,
            last7: summary.windows.last7.total,
            last30: summary.windows.last30.total,
          }}
          daily={summary.daily}
          active={active}
          onSelect={onSelect}
        />
      </div>
      <StickyWindowBar
        watchRef={panelRef}
        active={active}
        onSelect={onSelect}
        views={VIEWS}
        view={view}
        onSelectView={(k) => setView(k as AllView)}
      />
      <ViewTabs views={VIEWS} leads={['dashboard']} view={view} onSelect={setView} />

      {view === 'dashboard' ? (
        <Overview summary={summary} comparison={comparison} active={active} onPickApp={onPickApp} />
      ) : view === 'events-by-app' ? (
        <>
          {compared}
          <EventsByApp
            summary={summary}
            comparison={comparison}
            active={active}
            onPickApp={onPickApp}
          />
        </>
      ) : view === 'visitors' ? (
        <>
          {compared}
          <VisitorsAndAccounts summary={summary} comparison={comparison} active={active} />
        </>
      ) : view === 'kits' ? (
        <ProjectKits summary={summary} active={active} />
      ) : view === 'forum' ? (
        <ForumChecks />
      ) : (
        <>
          <p className={INTRO}>
            The {TOP_EVENTS} events sent most in the {windowLabel(active).toLowerCase()}. The same
            event from several apps counts once here, added up.
          </p>
          {window.rows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              No events in this window yet.
            </p>
          ) : (
            <ol className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-900">
              {window.rows.slice(0, TOP_EVENTS).map((row) => (
                <li
                  key={`${row.category}|${row.action}|${row.type ?? ''}`}
                  className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm"
                >
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-300">
                    {row.category} · {row.action}
                    {row.type ? (
                      <span className="text-slate-500 dark:text-slate-400"> · {row.type}</span>
                    ) : null}
                  </span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-100">
                    {row.count.toLocaleString('en-GB')}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </>
  );
}
