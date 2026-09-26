'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import {
  ACCOUNT_ACTIVITY,
  CANVAS_MODES,
  AI_ASSISTANCE,
  ALL_VISITORS,
  API_TOKEN_ACTIVITY,
  COUNTDOWNS,
  DIAGRAM_ACTIONS,
  DISCUSSION,
  EDITOR_CHROME,
  EDITOR_SEARCH,
  ELEMENT_EDITING,
  ELEMENTS_ADDED,
  EMAILS_SENT,
  EXCEPTIONS,
  EXPORT_AND_IMPORT,
  HELP_CENTRE,
  LAYERS_FEATURE,
  LIVE_TOGETHER,
  LOOK_AND_FEEL,
  MCP_TOOL_CALLS,
  OFFLINE_MODE,
  PAGE_VIEWS_BY_APP,
  PALETTE_USE,
  PANELS_OPENED,
  PHOTO_IMPORT,
  POLLS,
  PRESENTATIONS,
  SETTINGS_CHANGED,
  SHARING_AND_JOINING,
  SIGN_IN_PROMPTS,
  STOPWATCHES,
  TAB_ACTIONS,
  TABLES,
  TEAM_ACTIVITY,
  TIMELINE_AND_ACTIVITY,
  UNDO_AND_REVERT,
  VOTING,
  WELCOME_TOUR,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import type { ViewKey } from './view-keys';
import { windowLabel } from './windows';

// The Dashboard view (spec/22, default tab): every event the product sends,
// as chart stacks grouped by the question they answer, each a combined chart
// that opens into its members' cards. Charts come from the shared catalogue,
// so a stack only references them. Every emitted event lands in some chart
// (metric-emitters.test), so nothing is visible only in Search.
//
// Groups run as a funnel: who arrives, what they make, which features carry
// the work, how they work together, how machines connect, then health and
// the email behind it all. A stack that goes deeper than it can links to its
// Detail tab.
//
// Deliberately a FIXED list, not "top by volume": a first-time visitor
// (`Participant·Created`) is low volume but high signal, so it must always be
// on screen. A metric with no events renders as zero with a flat line rather
// than disappearing, so the layout is stable day to day.

export const GROUPS: MetricGroup[] = [
  {
    title: 'Visitors',
    metrics: [ALL_VISITORS, ACCOUNT_ACTIVITY, PAGE_VIEWS_BY_APP, SIGN_IN_PROMPTS, WELCOME_TOUR],
  },
  {
    title: 'Content',
    metrics: [
      DIAGRAM_ACTIONS,
      TAB_ACTIONS,
      ELEMENTS_ADDED,
      ELEMENT_EDITING,
      TABLES,
      UNDO_AND_REVERT,
      EXPORT_AND_IMPORT,
    ],
  },
  {
    title: 'Features',
    metrics: [
      AI_ASSISTANCE,
      PHOTO_IMPORT,
      OFFLINE_MODE,
      LAYERS_FEATURE,
      PALETTE_USE,
      CANVAS_MODES,
      LOOK_AND_FEEL,
      EDITOR_SEARCH,
      PANELS_OPENED,
      EDITOR_CHROME,
      SETTINGS_CHANGED,
    ],
  },
  // Live Together is the only stack that counts two people on one canvas at
  // the same moment; the rest of Collaboration counts invitations to be there,
  // so read them against it.
  {
    title: 'Collaboration',
    metrics: [LIVE_TOGETHER, SHARING_AND_JOINING, DISCUSSION, TIMELINE_AND_ACTIVITY],
  },
  {
    title: 'Teams & facilitation',
    metrics: [TEAM_ACTIVITY, VOTING, POLLS, COUNTDOWNS, STOPWATCHES, PRESENTATIONS],
  },
  {
    title: 'Connections',
    metrics: [API_TOKEN_ACTIVITY, MCP_TOOL_CALLS],
  },
  {
    title: 'Health & support',
    metrics: [EXCEPTIONS, HELP_CENTRE],
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

export function DashboardView({
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
