'use client';

import { memo, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { useTelemetryApp, type ViewProps } from './app';
import { DashboardView } from './DashboardView';
import { GroupsView } from './GroupsView';
import type { DetailKey, ViewKey } from './view-keys';

// The tab below the tab row (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", The tabs). Only
// the Dashboard shows on arrival, so only it ships with the page (and the tabs that are plain chart groups, which
// are its own cards). Every other view loads on its own, fetched while the browser is idle once the summary is in,
// so switching to one is still instant.
const VIEW_LOADERS = {
  editing: () => import('./EditingView').then((m) => m.EditingView),
  palette: () => import('./PaletteView').then((m) => m.PaletteView),
  modes: () => import('./ModesView').then((m) => m.ModesView),
  lookfeel: () => import('./LookAndFeelView').then((m) => m.LookAndFeelView),
  settings: () => import('./SettingsView').then((m) => m.SettingsView),
  community: () => import('./CommunityView').then((m) => m.CommunityView),
  pages: () => import('./PagesView').then((m) => m.PagesView),
  help: () => import('./HelpView').then((m) => m.HelpView),
  exceptions: () => import('./ExceptionsView').then((m) => m.ExceptionsView),
  timings: () => import('./TimingsView').then((m) => m.TimingsView),
  vitals: () => import('./TimingsView').then((m) => m.VitalsView),
  search: () => import('./MetricSearch').then((m) => m.MetricSearch),
};
type Loaded = Exclude<keyof typeof VIEW_LOADERS, 'search'>;
// Next needs each call's options written out in place.
const LOADED: Record<Loaded, ComponentType<ViewProps>> = {
  editing: dynamic(VIEW_LOADERS.editing, { ssr: false }),
  palette: dynamic(VIEW_LOADERS.palette, { ssr: false }),
  modes: dynamic(VIEW_LOADERS.modes, { ssr: false }),
  lookfeel: dynamic(VIEW_LOADERS.lookfeel, { ssr: false }),
  settings: dynamic(VIEW_LOADERS.settings, { ssr: false }),
  community: dynamic(VIEW_LOADERS.community, { ssr: false }),
  pages: dynamic(VIEW_LOADERS.pages, { ssr: false }),
  help: dynamic(VIEW_LOADERS.help, { ssr: false }),
  exceptions: dynamic(VIEW_LOADERS.exceptions, { ssr: false }),
  timings: dynamic(VIEW_LOADERS.timings, { ssr: false }),
  vitals: dynamic(VIEW_LOADERS.vitals, { ssr: false }),
};
const MetricSearch = dynamic(VIEW_LOADERS.search, { ssr: false });

// Fetch every other view's code once the page is idle (a timeout where requestIdleCallback is missing).
export function prefetchViews(): () => void {
  const run = () => {
    for (const load of Object.values(VIEW_LOADERS)) void load().catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(run, { timeout: 4000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 1000);
  return () => window.clearTimeout(id);
}

// Memoised so the page can hand it a DEFERRED window: a click on a timeframe re-renders the
// selector at once and leaves this tree alone, then React re-renders it in the background,
// interruptibly. Redrawing every card of a busy tab inside the click held the next paint for
// ~190 ms. Every prop must stay stable between window changes (`onOpenTab` is a useCallback) or
// the memo does nothing.
export const ActiveView = memo(function ActiveView({
  view,
  summary,
  active,
  onOpenTab,
}: {
  view: ViewKey;
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
  onOpenTab: (tab: DetailKey) => void;
}) {
  const app = useTelemetryApp();
  switch (view) {
    case 'dashboard':
      return <DashboardView summary={summary} active={active} onOpenTab={onOpenTab} />;
    // The tabs that are chart groups under one line: the app's own lists.
    case 'facilitation':
    case 'teamwork':
      return <GroupsView section={app.teamwork} summary={summary} active={active} />;
    case 'explorer':
      return app.explorer ? (
        <GroupsView section={app.explorer} summary={summary} active={active} />
      ) : null;
    case 'connections':
      return <GroupsView section={app.connections} summary={summary} active={active} />;
    case 'tours':
      return <GroupsView section={app.tours} summary={summary} active={active} />;
    case 'search':
      return summary.daily ? (
        <div className="mt-8">
          <MetricSearch windows={summary.windows} daily={summary.daily} active={active} />
        </div>
      ) : (
        <p className="mt-8 text-slate-500 dark:text-slate-400">
          Per-metric trends aren&rsquo;t available from this API version.
        </p>
      );
    default: {
      const View = LOADED[view];
      return <View summary={summary} active={active} />;
    }
  }
});
