'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import {
  ACCOUNT_ACTIVITY,
  DASHBOARD_PAGES,
  DIAGRAM_ACTIONS,
  EMAILS_SENT,
  HELP_PAGES,
  LIVE_PAGES,
  MARKETING_PAGES,
  NEW_VISITORS,
  RETURNING_VISITORS,
  TAB_ACTIONS,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import type { ViewKey } from './view-keys';
import { windowLabel } from './windows';

// The Highlights view (spec/22, default tab): the key product metrics we
// most want to watch. Being rebuilt one tab at a time: for now it carries
// only Visitors, as three chart stacks (All Visitors: New + Returning;
// Account Activity: Sign-Ups + Sign-Ins + Sign-Outs + Accounts Deleted; Page
// Views by App: views per app, moved here from the Pages tab), plus Emails
// Sent (moved from the removed Acquisition tab) and Diagram / Tab Actions
// (moved from the removed Content tab), each a
// combined chart that fans out into its members' cards. Charts come from the
// shared catalogue, so a stack only references them; more are added back
// from the other tabs as each one is reviewed.
//
// Deliberately a FIXED list, not "top by volume": a first-time visitor
// (`Participant·Created`) is low volume but high signal, so it must always be
// on screen. A metric with no events renders as zero with a flat line rather
// than disappearing, so the layout is stable day to day.

export const GROUPS: MetricGroup[] = [
  {
    title: 'Visitors',
    metrics: [
      {
        stack: true,
        title: 'All Visitors',
        blurb:
          'Every browser that opened the app: first-timers and those back on a later day, counted once per day each.',
        members: [NEW_VISITORS, RETURNING_VISITORS],
      },
      ACCOUNT_ACTIVITY,
      {
        stack: true,
        title: 'Page Views by App',
        blurb:
          'Every page viewed across the site, by full load or in-app navigation, split by the app that serves it.',
        members: [MARKETING_PAGES, LIVE_PAGES, HELP_PAGES, DASHBOARD_PAGES],
        seeAlso: { view: 'pages', label: 'See Every Page on the Pages Tab' },
      },
    ],
  },
  {
    title: 'Content',
    metrics: [DIAGRAM_ACTIONS, TAB_ACTIONS],
  },
  {
    // Written server-side by the api worker: nothing about a send reaches a
    // browser, so this is the only place it can be counted. The onboarding
    // series exists to bring people back, so read it against All Visitors.
    // Failures aren't here; they land on Exceptions as
    // Error·Api·Http*.SendEmail.
    title: 'Email',
    metrics: [EMAILS_SENT],
  },
];

export function HighlightsView({
  summary,
  active,
  onOpenView,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
  onOpenView: (view: ViewKey) => void;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The key metrics we watch, for <span className="font-medium">{windowLabel(active)}</span>.
        Each card&rsquo;s line is the last 30 days; the selected window is highlighted.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} onOpenView={onOpenView} />
    </div>
  );
}
