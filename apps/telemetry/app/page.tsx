'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EmptyState, SiteFooter, SiteHeader } from '@livediagram/ui';
import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import {
  ActivityGlyph,
  BrushGlyph,
  DiagramGlyph,
  FileGlyph,
  LinkGlyph,
  ListGlyph,
  PaletteGlyph,
  PersonAddGlyph,
  SearchGlyph,
  ShareGlyph,
  SparkGlyph,
} from './glyphs';
import { WindowPanel } from './WindowPanel';
import { StickyWindowBar } from './StickyWindowBar';
import { ViewTabs } from './ViewTabs';
import { HighlightsView } from './HighlightsView';
import { AcquisitionView } from './AcquisitionView';
import { ContentView } from './ContentView';
import { RawView } from './RawView';
import { LookAndFeelView } from './LookAndFeelView';
import { PaletteView } from './PaletteView';
import { HelpView } from './HelpView';
import { ExternalConnectionsView } from './ExternalConnectionsView';
import { CollaborationView } from './CollaborationView';
import { MetricSearch } from './MetricSearch';

// Same origin as the editor + api under the router (livediagram.app).
// An origin-relative '/api' is correct even though this app is served
// under '/telemetry' (basePath doesn't rewrite absolute fetch paths).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// Three ways to read the same summary payload (spec/22). The timeframe
// window is global (the WindowPanel above the tabs), so it lives here
// alongside the active tab and is passed into whichever view renders.
// Tab order follows the product funnel: who arrives (Acquisition), what they
// open + make (Content), what they build (Palette / Look & Feel), how they work
// together (Collaboration), how they get unstuck (Help), how machines connect
// (External Connections), then the power-user lenses (Search / Raw).
type ViewKey =
  | 'highlights'
  | 'acquisition'
  | 'content'
  | 'palette'
  | 'lookfeel'
  | 'help'
  | 'external'
  | 'collaboration'
  | 'search'
  | 'raw';
const VIEWS: { key: ViewKey; label: string; icon: ReactNode }[] = [
  { key: 'highlights', label: 'Highlights', icon: <SparkGlyph /> },
  { key: 'acquisition', label: 'Acquisition', icon: <PersonAddGlyph /> },
  { key: 'content', label: 'Content', icon: <DiagramGlyph /> },
  { key: 'palette', label: 'Palette', icon: <PaletteGlyph /> },
  { key: 'lookfeel', label: 'Look & Feel', icon: <BrushGlyph /> },
  { key: 'help', label: 'Help', icon: <FileGlyph /> },
  { key: 'external', label: 'External Connections', icon: <LinkGlyph /> },
  { key: 'collaboration', label: 'Collaboration', icon: <ShareGlyph /> },
  { key: 'search', label: 'Search', icon: <SearchGlyph /> },
  { key: 'raw', label: 'Raw', icon: <ListGlyph /> },
];

export default function TelemetryDashboard() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [view, setView] = useState<ViewKey>('highlights');
  const [active, setActive] = useState<TelemetryWindowKey>('last7');
  // Watched by the StickyWindowBar: once this panel scrolls under the header,
  // the condensed timeframe selector fades in.
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/telemetry/summary`)
      .then((r) => (r.ok ? (r.json() as Promise<TelemetrySummary>) : Promise.reject(r.status)))
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {/* Same header + footer as the marketing landing page (shared SiteHeader /
          SiteFooter), with the apps-menu dropdown enabled next to the logo so
          telemetry reads as part of the product. */}
      <SiteHeader productNav="telemetry" />
      <main className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Telemetry, in the open
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
          This is everything we measure. We record anonymous, first-party product events to learn
          which features actually help. There are no third-party analytics or tracking vendors, no
          user content (never a diagram name, your name, or anything you type), and the data is
          never sold or shared beyond this page.
        </p>

        {status === 'loading' ? (
          <p className="mt-12 text-slate-500">Loading…</p>
        ) : status === 'error' ? (
          <div className="mt-12">
            <EmptyState
              icon={<ActivityGlyph />}
              title="Couldn’t load the numbers"
              description="The telemetry API didn’t answer just now. Give it a moment and refresh — nothing’s broken on your end."
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
              the counts in Highlights / Raw / Search below. */}
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
              onSelectView={(k) => setView(k as ViewKey)}
            />

            {/* View tabs — a single-line carousel; chevrons appear when the
              full set overflows the column (see ViewTabs). */}
            <ViewTabs views={VIEWS} view={view} onSelect={setView} />

            {view === 'highlights' ? (
              <HighlightsView summary={summary} active={active} />
            ) : view === 'acquisition' ? (
              <AcquisitionView summary={summary} active={active} />
            ) : view === 'content' ? (
              <ContentView summary={summary} active={active} />
            ) : view === 'palette' ? (
              <PaletteView summary={summary} active={active} />
            ) : view === 'lookfeel' ? (
              <LookAndFeelView summary={summary} active={active} />
            ) : view === 'help' ? (
              <HelpView summary={summary} active={active} />
            ) : view === 'external' ? (
              <ExternalConnectionsView summary={summary} active={active} />
            ) : view === 'collaboration' ? (
              <CollaborationView summary={summary} active={active} />
            ) : view === 'raw' ? (
              <RawView summary={summary} active={active} />
            ) : summary.daily ? (
              <div className="mt-8">
                <MetricSearch windows={summary.windows} daily={summary.daily} active={active} />
              </div>
            ) : (
              <p className="mt-8 text-slate-500">
                Per-metric trends aren&rsquo;t available from this API version.
              </p>
            )}

            {summary.generatedAt ? (
              <p className="mt-10 text-xs text-slate-400">
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
