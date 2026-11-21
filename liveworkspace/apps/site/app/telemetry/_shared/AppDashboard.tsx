'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { SearchGlyph, SparkGlyph } from './glyphs';
import { WindowPanel } from './WindowPanel';
import { StickyWindowBar } from './StickyWindowBar';
import { ViewTabs } from './ViewTabs';
import { ActiveView, prefetchViews } from './ActiveView';
import { detailTabs } from './detail-tabs';
import type { DetailKey, ViewKey } from './view-keys';
import { TelemetryAppProvider, type TelemetryAppConfig } from './app';
import { dropRetiredEvents } from './retired-events';

// One app's own dashboard (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"), the same for every app,
// filled from the app's config: the key metrics first (Dashboard), then a Detail tab for each area the app has
// (detail-tabs.tsx), and Search, which finds any one event.
type View = { key: ViewKey; label: string; icon: ReactNode };
const DASHBOARD: View = { key: 'dashboard', label: 'Dashboard', icon: <SparkGlyph /> };
const SEARCH: View = { key: 'search', label: 'Search', icon: <SearchGlyph /> };

// What the page hands each app's Body, and the Body hands on: the summary, and the window, which the page holds so
// that switching app keeps it (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", The window).
export type AppBodyProps = {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
  onSelect: (key: TelemetryWindowKey) => void;
};

export function AppDashboard({
  app,
  summary: raw,
  active,
  onSelect: setActive,
}: AppBodyProps & { app: TelemetryAppConfig }) {
  const views = useMemo<View[]>(() => [DASHBOARD, ...detailTabs(app), SEARCH], [app]);
  // Retired features never render (see the app's retired-events.ts).
  const summary = useMemo(() => dropRetiredEvents(raw, app.isRetired), [raw, app]);
  const [view, setView] = useState<ViewKey>('dashboard');
  // A stack's See also names the tab that goes deeper: switch to it, and bring its top under the sticky bar (the
  // link sat somewhere down the Dashboard, and the new tab would open scrolled that far). The scroll waits for the
  // commit, in an effect keyed on the ask: by then the stack's modal has closed and given the page its scroll back.
  const tabRef = useRef<HTMLDivElement>(null);
  const [jump, setJump] = useState(0);
  const openTab = useCallback((tab: DetailKey) => {
    setView(tab);
    setJump((n) => n + 1);
  }, []);
  useEffect(() => {
    if (jump === 0) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    tabRef.current?.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
  }, [jump]);
  // The tab redraws for a new window in the background (see ActiveView), so the
  // click paints the selector straight away; the tab dims until it catches up.
  const shownWindow = useDeferredValue(active);
  // Watched by the StickyWindowBar: once this panel scrolls under the header,
  // the condensed timeframe selector fades in.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => prefetchViews(), []);

  return (
    <TelemetryAppProvider value={app}>
      {/* Global timeframe selector + 30-day trend line. Shared by every
          tab and always visible, so the window the cards pick drives
          the counts in every view below. */}
      <div ref={panelRef} className="mt-10">
        <WindowPanel
          totals={{
            today: summary.windows.today.total,
            last7: summary.windows.last7.total,
            last30: summary.windows.last30.total,
          }}
          daily={summary.daily}
          active={active}
          onSelect={setActive}
        />
      </div>
      <StickyWindowBar
        watchRef={panelRef}
        active={active}
        onSelect={setActive}
        views={views}
        view={view}
        onSelectView={(k) => setView(k as ViewKey)}
      />

      {/* View tabs — a single-line carousel; chevrons appear when the
          full set overflows the column (see ViewTabs). */}
      <ViewTabs views={views} leads={['dashboard', 'search']} view={view} onSelect={setView} />

      {/* Clipped sideways: a stack deals in from 20px to the right (timeline-motion.css), and on a
          phone that spill widened the page, which the fixed StickyWindowBar then held wide. Hover
          cards and the stack modal are portalled, so nothing real is cut. */}
      <div
        ref={tabRef}
        id="telemetry-tab"
        aria-busy={shownWindow !== active}
        // The scroll margin clears the sticky header and the timeframe bar fixed beneath it.
        className={
          'scroll-mt-40 overflow-x-clip transition-opacity duration-short ' +
          (shownWindow !== active ? 'opacity-60' : '')
        }
      >
        <ActiveView view={view} summary={summary} active={shownWindow} onOpenTab={openTab} />
      </div>
    </TelemetryAppProvider>
  );
}
