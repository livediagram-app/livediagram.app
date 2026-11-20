'use client';

import type { ReactNode } from 'react';
import { APP_SITES } from '@liveworkspace/sites';
import type { TelemetryApp, TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { useSiteAppearance } from '@/lib/appearance/appearance-hooks';
import { AppBrand, appName } from '../AppBrand';
import { forAppearance } from '../_shared/appearance-colours';
import {
  ActivityGlyph,
  PersonAddGlyph,
  PersonGlyph,
  ResetGlyph,
  SignInGlyph,
  SparkGlyph,
} from '../_shared/glyphs';
import type { Rising } from '../_shared/metric-series';
import { StatCard, StatValue } from '../_shared/StatCard';
import { TrendBadge } from '../_shared/TrendBadge';
import { TrendChart } from '../_shared/TrendChart';
import { previousSpanLabel, windowHighlightFrom, windowLabel } from '../_shared/windows';
import {
  addSeries,
  audienceSeries,
  formatAverage,
  formatShare,
  TOTAL,
  type Comparison,
} from './apps-compared';

// All Apps' Dashboard tab (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", All Apps): the
// same cards an app's Dashboard opens on. At a Glance is every app added up, six numbers each with its 30-day
// line; Apps is a card an app, under its logo, that opens the app's own dashboard. The tables and the charts that
// set the apps side by side are a Detail tab each.

// The hues an app's dashboard gives the same events: its Document sky for everything made, Participant red for
// visitors, Session slate for accounts.
const EVENTS = '#0ea5e9';
const VISITORS = '#dc2626';
const ACCOUNTS = '#64748b';

const GRID = 'mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3';
const GROUP_TITLE =
  'text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

type Glance = {
  title: string;
  subtitle: string;
  icon: ReactNode;
  color: string;
  value: string;
  now: number;
  before: number;
  blurb: string;
  series: number[];
  rising?: Rising;
};

export function Overview({
  summary,
  comparison,
  active,
  onPickApp,
}: {
  summary: TelemetrySummary;
  comparison: Comparison;
  active: TelemetryWindowKey;
  onPickApp: (app: TelemetryApp) => void;
}) {
  const { appearance } = useSiteAppearance();
  const daily = summary.daily;
  const against = previousSpanLabel(summary, active);
  const highlight = daily ? windowHighlightFrom(daily, active) : null;
  const total = comparison.total;
  const of = (key: Parameters<typeof audienceSeries>[2]) => audienceSeries(summary, TOTAL, key);
  const returning = addSeries(of('returningGuests'), of('returningSignedIn'));
  const count = (n: number) => n.toLocaleString('en-GB');

  const glance: Glance[] = [
    {
      title: 'Events',
      subtitle: 'Every App · Everything Counted',
      icon: <ActivityGlyph />,
      color: EVENTS,
      value: count(total.events),
      now: total.events,
      before: total.eventsBefore,
      blurb:
        'Every anonymous event every app sent, added up, with the few liveworkspace.app sends for no one app.',
      series: daily?.totals ?? [],
    },
    {
      title: 'Avg Daily Visitors',
      subtitle: 'Participant · Created + Returned',
      icon: <PersonGlyph />,
      color: VISITORS,
      value: formatAverage(total.avgDailyVisitors),
      now: total.avgDailyVisitors,
      before: total.avgDailyVisitorsBefore,
      blurb:
        'The browsers that opened an app on a typical day in the window: new and returning visits, over its days.',
      series: addSeries(of('newVisitors'), returning),
    },
    {
      title: 'New Visitors',
      subtitle: 'Participant · Created',
      icon: <PersonAddGlyph />,
      color: VISITORS,
      value: count(total.now.newVisitors),
      now: total.now.newVisitors,
      before: total.before.newVisitors,
      blurb: 'Browsers opening an app for the first time. One person trying two apps is new twice.',
      series: of('newVisitors'),
    },
    {
      title: 'Returning Visitors',
      subtitle: 'Participant · Returned',
      icon: <ResetGlyph />,
      color: VISITORS,
      value: count(total.now.returning),
      now: total.now.returning,
      before: total.before.returning,
      blurb:
        'Browsers that came back on a later day than their first visit, counted once a day, as a guest or signed in.',
      series: returning,
    },
    {
      title: 'Sign-Ups',
      subtitle: 'Session · Signed Up',
      icon: <SparkGlyph />,
      color: ACCOUNTS,
      value: count(total.now.signUps),
      now: total.now.signUps,
      before: total.before.signUps,
      blurb:
        'Accounts an app had never seen finishing sign-in. One person joining two apps is two sign-ups.',
      series: of('signUps'),
    },
    {
      title: 'Sign-Ins',
      subtitle: 'Session · Signed In',
      icon: <SignInGlyph />,
      color: ACCOUNTS,
      value: count(total.now.signIns),
      now: total.now.signIns,
      before: total.before.signIns,
      blurb: 'Every other finished sign-in, on any app. Never a token refresh.',
      series: of('signIns'),
    },
  ];

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Every app added up, then each app, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>. Each card&rsquo;s line is the
        last 30 days; the selected window is highlighted. The comparisons are on the Detail tabs.
      </p>
      <div className="mt-6 flex flex-col gap-8">
        <section>
          <h2 className={GROUP_TITLE}>At a Glance</h2>
          <div className={GRID}>
            {glance.map((g) => {
              const color = forAppearance(g.color, appearance);
              return (
                <StatCard
                  key={g.title}
                  icon={g.icon}
                  color={color}
                  title={g.title}
                  subtitle={g.subtitle}
                  blurb={g.blurb}
                  aside={
                    <>
                      {against ? (
                        <TrendBadge
                          now={g.now}
                          before={g.before}
                          rising={g.rising}
                          against={against}
                        />
                      ) : null}
                      <StatValue>{g.value}</StatValue>
                    </>
                  }
                >
                  {daily ? (
                    <TrendChart
                      days={daily.days}
                      values={g.series}
                      color={color}
                      highlightFromIndex={highlight}
                      heightClassName="h-20"
                      label={g.title}
                    />
                  ) : null}
                </StatCard>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className={GROUP_TITLE}>Apps</h2>
          <div className={GRID}>
            {comparison.apps.map((row) => {
              const site = APP_SITES.find((s) => s.id === row.key);
              const color = forAppearance(site?.accent ?? EVENTS, appearance);
              const name = appName(row.key);
              return (
                <StatCard
                  key={row.key}
                  title={<AppBrand app={row.key} />}
                  subtitle={`${formatShare(row.share)} of Events`}
                  aside={
                    <>
                      {against ? (
                        <TrendBadge now={row.events} before={row.eventsBefore} against={against} />
                      ) : null}
                      <StatValue>{count(row.events)}</StatValue>
                    </>
                  }
                  blurb={
                    <>
                      {site ? <p>{site.pitch}.</p> : null}
                      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
                        {(
                          [
                            ['New Visitors', row.now.newVisitors],
                            ['Returning', row.now.returning],
                            ['Sign-Ups', row.now.signUps],
                          ] as const
                        ).map(([label, n]) => (
                          <li key={label} className="flex items-center gap-1.5">
                            {label}
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {count(n)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  }
                  footer={
                    <button
                      type="button"
                      data-app={row.key}
                      onClick={() => onPickApp(row.key as TelemetryApp)}
                      aria-label={`Open ${name}'s dashboard`}
                      className="relative mt-4 -mb-1 flex cursor-pointer items-center gap-1 self-start rounded text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 touch-target-y dark:text-brand-300"
                    >
                      Open Dashboard <span aria-hidden>→</span>
                    </button>
                  }
                >
                  {daily ? (
                    <TrendChart
                      days={daily.days}
                      values={daily.byApp?.[row.key as TelemetryApp] ?? daily.days.map(() => 0)}
                      color={color}
                      highlightFromIndex={highlight}
                      heightClassName="h-20"
                      label={`${name} events`}
                    />
                  ) : null}
                </StatCard>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
