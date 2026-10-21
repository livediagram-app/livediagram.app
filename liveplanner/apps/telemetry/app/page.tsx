'use client';

import { useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react';
import { EmptyState, SiteFooter, SiteHeader } from '@liveplanner/ui';
import type { TelemetrySummary, TelemetryWindowKey } from '@liveplanner/api-schema';
import {
  ActivityGlyph,
  AlertGlyph,
  LayersGlyph,
  SearchGlyph,
  SparkGlyph,
  WindowGlyph,
} from './glyphs';
import { WindowPanel } from './WindowPanel';
import { StickyWindowBar } from './StickyWindowBar';
import { ViewTabs } from './ViewTabs';
import { ActiveView, prefetchViews } from './ActiveView';
import { SECTION_TAB, type SectionKey, type ViewKey } from './view-keys';
import type { SectionFocus } from './SectionedView';
import { dropRetiredEvents } from './retired-events';

// Same origin as the editor + api under the router (liveplanner.app).
// An origin-relative '/api' is correct even though this app is served
// under '/telemetry' (basePath doesn't rewrite absolute fetch paths).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// Ways to read the same summary payload (docs/specs/017-telemetry/telemetry.md). The timeframe
// window is global (the WindowPanel above the tabs), so it lives here
// alongside the active tab and is passed into whichever view renders.
// The key metrics first, then the three Detail tabs (each gathering what were
// separate tabs until October 2026 as sections): what people build with
// (Features), how they find their way (Pages & Help), and whether it all works
// and is fast (Health). Search is the power-user lens.
const VIEWS: { key: ViewKey; label: string; icon: ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <SparkGlyph /> },
  { key: 'features', label: 'Features', icon: <LayersGlyph /> },
  { key: 'pages', label: 'Pages & Help', icon: <WindowGlyph /> },
  { key: 'health', label: 'Health', icon: <AlertGlyph /> },
  { key: 'search', label: 'Search', icon: <SearchGlyph /> },
];

export default function TelemetryDashboard() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [view, setView] = useState<ViewKey>('dashboard');
  // A link into a section of another tab (a stack's See also): switch to its
  // tab, and the tab scrolls the section in once it renders (SectionedView).
  const [focus, setFocus] = useState<SectionFocus | null>(null);
  const openSection = useCallback((section: SectionKey) => {
    setView(SECTION_TAB[section]);
    setFocus((prev) => ({ section, n: (prev?.n ?? 0) + 1 }));
  }, []);
  // Picking a tab by hand starts at its top, never at a section asked for earlier.
  const selectView = (next: ViewKey) => {
    setFocus(null);
    setView(next);
  };
  const [active, setActive] = useState<TelemetryWindowKey>('last7');
  // The tab redraws for a new window in the background (see ActiveView), so the
  // click paints the selector straight away; the tab dims until it catches up.
  const shownWindow = useDeferredValue(active);
  // Watched by the StickyWindowBar: once this panel scrolls under the header,
  // the condensed timeframe selector fades in.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/telemetry/summary`)
      .then((r) => {
        if (!r.ok) throw new Error(`telemetry summary: HTTP ${r.status}`);
        return r.json() as Promise<TelemetrySummary>;
      })
      .then((data) => {
        if (cancelled) return;
        // Retired features never render (see retired-events.ts).
        setSummary(dropRetiredEvents(data));
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => (status === 'ready' ? prefetchViews() : undefined), [status]);

  return (
    <>
      {/* Same header + footer as the marketing landing page (shared SiteHeader /
          SiteFooter), with the apps-menu dropdown enabled next to the logo so
          telemetry reads as part of the product. */}
      <SiteHeader productNav="telemetry" ctaSurface="Dashboard" />
      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
          Telemetry, in the open
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
          This is everything we measure. We record anonymous, first-party product events to learn
          which features actually help. There are no third-party analytics or tracking vendors, no
          user content (never a document name, your name, or anything you type), and the data is
          never sold or shared beyond this page.
        </p>

        {status === 'loading' ? (
          <p className="mt-12 text-slate-500 dark:text-slate-400">Loading…</p>
        ) : status === 'error' ? (
          <div className="mt-12">
            <EmptyState
              icon={<ActivityGlyph />}
              title="Couldn’t load the numbers"
              description="The telemetry API didn’t answer just now. Give it a moment and refresh: nothing’s broken on your end."
            />
          </div>
        ) : !summary?.enabled ? (
          <div className="mt-12">
            <EmptyState
              icon={<ActivityGlyph />}
              title="Telemetry isn’t enabled here"
              description="This deployment hasn’t turned telemetry on, so there’s nothing to show yet. Self-hosters opt in with a single env var."
            />
          </div>
        ) : (
          <>
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
              views={VIEWS}
              view={view}
              onSelectView={(k) => selectView(k as ViewKey)}
            />

            {/* View tabs — a single-line carousel; chevrons appear when the
              full set overflows the column (see ViewTabs). */}
            <ViewTabs
              views={VIEWS}
              leads={['dashboard', 'search']}
              view={view}
              onSelect={selectView}
            />

            <div
              aria-busy={shownWindow !== active}
              className={
                'transition-opacity duration-short ' + (shownWindow !== active ? 'opacity-60' : '')
              }
            >
              <ActiveView
                view={view}
                summary={summary}
                active={shownWindow}
                focus={focus}
                onOpenSection={openSection}
              />
            </div>

            {summary.generatedAt ? (
              <p className="mt-10 text-xs text-slate-500 dark:text-slate-400">
                Anonymous, first-party, no vendors. Updated a few minutes at a time.
              </p>
            ) : null}
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
