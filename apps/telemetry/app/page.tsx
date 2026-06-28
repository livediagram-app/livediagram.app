'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Brand, EmptyState } from '@livediagram/ui';
import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { ActivityGlyph, ListGlyph, SearchGlyph, SparkGlyph } from './glyphs';
import { WindowPanel } from './WindowPanel';
import { HighlightsView } from './HighlightsView';
import { RawView } from './RawView';
import { MetricSearch } from './MetricSearch';

// Same origin as the editor + api under the router (livediagram.app).
// An origin-relative '/api' is correct even though this app is served
// under '/telemetry' (basePath doesn't rewrite absolute fetch paths).
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

// Three ways to read the same summary payload (spec/22). The timeframe
// window is global (the WindowPanel above the tabs), so it lives here
// alongside the active tab and is passed into whichever view renders.
type ViewKey = 'highlights' | 'raw' | 'search';
const VIEWS: { key: ViewKey; label: string; icon: ReactNode }[] = [
  { key: 'highlights', label: 'Highlights', icon: <SparkGlyph /> },
  { key: 'raw', label: 'Raw', icon: <ListGlyph /> },
  { key: 'search', label: 'Search', icon: <SearchGlyph /> },
];

export default function TelemetryDashboard() {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [view, setView] = useState<ViewKey>('highlights');
  const [active, setActive] = useState<TelemetryWindowKey>('last7');

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
    <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
      <div className="flex items-center justify-between gap-4">
        <Brand href="/" size="md" />
        <a href="/" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to livediagram
        </a>
      </div>

      <h1 className="mt-10 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
        Telemetry, in the open
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600">
        This is everything we measure. We record anonymous, first-party product events to learn
        which features actually help. There are no third-party analytics or tracking vendors, no
        user content (never a diagram name, your name, or anything you type), and the data is never
        sold or shared beyond this page.
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
          <div className="mt-10">
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

          {/* View tabs: Highlights (key metrics), Raw (full aggregate),
              Search (one metric). */}
          <div
            role="tablist"
            aria-label="Telemetry views"
            className="mt-8 inline-flex rounded-lg border border-slate-200 bg-white p-1"
          >
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={view === v.key}
                onClick={() => setView(v.key)}
                className={
                  'flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition ' +
                  (view === v.key ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-slate-100')
                }
              >
                <span aria-hidden className="[&_svg]:h-3.5 [&_svg]:w-3.5">
                  {v.icon}
                </span>
                {v.label}
              </button>
            ))}
          </div>

          {view === 'highlights' ? (
            <HighlightsView summary={summary} active={active} />
          ) : view === 'raw' ? (
            <RawView summary={summary} active={active} />
          ) : summary.daily ? (
            <div className="mt-8">
              <MetricSearch windows={summary.windows} daily={summary.daily} />
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
  );
}
