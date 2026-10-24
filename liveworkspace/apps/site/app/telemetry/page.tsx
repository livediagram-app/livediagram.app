'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { Brand as LivediagramBrand, EmptyState } from '@livediagram/ui';
import { Brand as LiveplannerBrand } from '@liveplanner/ui';
import { Brand as LivedocumentsBrand } from '@livedocuments/ui';
import { Brand as LivedesignBrand } from '@livedesign/ui';
import {
  type TelemetryAppFilter,
  type TelemetryDisabled,
  type TelemetrySummary,
} from '@liveworkspace/telemetry';
import { Footer } from '@/components/Footer';
import { AppLogo } from '@/components/landing/AppLogo';
import { listedApps } from '@/lib/apps';
import { Header } from '@/components/Header';
import { AllApps } from './AllApps';
import {
  APP_CHOICES,
  appFilterServerSnapshot,
  appFilterSnapshot,
  setAppFilter,
  subscribeAppFilter,
  summaryUrl,
} from './apps';
import { ActivityGlyph } from './_shared/glyphs';

// Each app's own dashboard loads only when it is picked, so "All apps" ships none of the apps'
// catalogues of event names and explanations.
const LivediagramBody = dynamic(() => import('./livediagram/Body').then((m) => m.Body), {
  ssr: false,
});
const LiveplannerBody = dynamic(() => import('./liveplanner/Body').then((m) => m.Body), {
  ssr: false,
});
const LivedocumentsBody = dynamic(() => import('./livedocuments/Body').then((m) => m.Body), {
  ssr: false,
});
const LivedesignBody = dynamic(() => import('./livedesign/Body').then((m) => m.Body), {
  ssr: false,
});

type Loaded = TelemetrySummary | TelemetryDisabled;

// Each app's chip shows its logo as its own site's header does: the prism and the wordmark with
// "live" in the app's accent. The chip's own `data-app` scopes the accent to it, whichever app is
// picked around it.
const APP_LOGOS: Partial<Record<TelemetryAppFilter, typeof LivediagramBrand>> = {
  'livediagram.app': LivediagramBrand,
  'liveplanner.app': LiveplannerBrand,
  'livedocuments.app': LivedocumentsBrand,
  'livedesign.app': LivedesignBrand,
};

// The liveworkspace telemetry dashboard (liveworkspace/docs/telemetry.md "The dashboard"): every app's
// anonymous events, all together or one app at a time.
export default function TelemetryDashboard() {
  // The filter rides in the URL (`?app=…`), so a link opens on it.
  const app = useSyncExternalStore(subscribeAppFilter, appFilterSnapshot, appFilterServerSnapshot);
  const pick = setAppFilter;
  // Each filter's summary, once fetched: switching back is instant, and the service caches for
  // minutes anyway.
  const [summaries, setSummaries] = useState<Partial<Record<TelemetryAppFilter, Loaded>>>({});
  // The filters whose last fetch failed; a later success clears it.
  const [failed, setFailed] = useState<ReadonlySet<TelemetryAppFilter>>(new Set());

  const loaded = summaries[app];
  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    fetch(summaryUrl(app))
      .then((r) => {
        if (!r.ok) throw new Error(`telemetry summary: HTTP ${r.status}`);
        return r.json() as Promise<Loaded>;
      })
      .then((data) => {
        if (cancelled) return;
        setSummaries((prev) => ({ ...prev, [app]: data }));
        setFailed((prev) => {
          const next = new Set(prev);
          next.delete(app);
          return next;
        });
      })
      .catch(() => {
        if (!cancelled) setFailed((prev) => new Set(prev).add(app));
      });
    return () => {
      cancelled = true;
    };
  }, [app, loaded]);

  return (
    <>
      <Header />
      <div data-app={app}>
        <main className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-slate-100">
            Telemetry, in the open
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            This is everything we measure, across every liveworkspace app. We record anonymous,
            first-party product events to learn which features actually help. There are no
            third-party analytics or tracking vendors, no user content (never a document name, your
            name, or anything you type), and the data is never sold or shared beyond this page.
          </p>

          <div role="radiogroup" aria-label="App" className="mt-8 flex flex-wrap gap-2">
            {APP_CHOICES.map((choice) => (
              <button
                key={choice.key}
                type="button"
                role="radio"
                aria-label={choice.label}
                aria-checked={app === choice.key}
                onClick={() => pick(choice.key)}
                className={
                  'flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ' +
                  (app === choice.key
                    ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600')
                }
              >
                {(() => {
                  const Logo = APP_LOGOS[choice.key];
                  if (Logo)
                    return (
                      <span data-app={choice.key} className="flex">
                        <Logo size="sm" />
                      </span>
                    );
                  // An app whose UI package isn't in this repo yet: the shared prism in its accent.
                  const listed = listedApps().find((a) => a.id === choice.key);
                  return listed ? <AppLogo app={listed} size="sm" /> : choice.label;
                })()}
              </button>
            ))}
          </div>

          {failed.has(app) && !loaded ? (
            <div className="mt-12">
              <EmptyState
                icon={<ActivityGlyph />}
                title="Couldn’t load the numbers"
                description="The telemetry service didn’t answer just now. Give it a moment and refresh: nothing’s broken on your end."
              />
            </div>
          ) : !loaded ? (
            <p className="mt-12 text-slate-500 dark:text-slate-400">Loading…</p>
          ) : !loaded.enabled ? (
            <div className="mt-12">
              <EmptyState
                icon={<ActivityGlyph />}
                title="Telemetry isn’t enabled here"
                description="This deployment hasn’t turned telemetry on, so there’s nothing to show yet."
              />
            </div>
          ) : app === 'livediagram.app' ? (
            <LivediagramBody summary={loaded} />
          ) : app === 'liveplanner.app' ? (
            <LiveplannerBody summary={loaded} />
          ) : app === 'livedocuments.app' ? (
            <LivedocumentsBody summary={loaded} />
          ) : app === 'livedesign.app' ? (
            <LivedesignBody summary={loaded} />
          ) : (
            <AllApps summary={loaded} onPickApp={pick} />
          )}

          <p className="mt-10 text-xs text-slate-500 dark:text-slate-400">
            Anonymous, first-party, no vendors. Updated a few minutes at a time.
          </p>
        </main>
      </div>
      <Footer />
    </>
  );
}
