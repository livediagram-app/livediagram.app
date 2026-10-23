'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livedocuments/api-schema';
import {
  ACCOUNT_ACTIVITY,
  AGENT_VIEWED,
  JOINING,
  ALL_VISITORS,
  CANVAS_MODES,
  CLI_COMMANDS_STACK,
  DOCUMENT_ACTIONS,
  DOCUMENTS_CREATED,
  ELEMENT_EDITING,
  ELEMENTS_ADDED,
  EMAILS_SENT,
  EXCEPTIONS,
  FAILED_REQUESTS,
  HELP_CENTRE,
  LIVE_TOGETHER,
  LOOK_AND_FEEL,
  MCP_TOOL_CALLS,
  MULTIPLAYER_SESSIONS,
  NEW_VISITORS,
  OFFLINE_MODE,
  ONBOARDING_TOURS,
  PAGE_VIEWS_BY_APP,
  PAGE_WORK,
  PALETTE_USE,
  PANELS_OPENED,
  PRESENTATIONS,
  RETURNING_VISITORS,
  SHARE_LINKS_MADE,
  SHARING_AND_EMBEDS,
  SIGN_IN_PROMPTS,
  SIGN_UPS,
  TAB_ACTIONS,
  TIMELINE_AND_ACTIVITY,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import type { SectionKey } from './view-keys';
import { windowLabel } from './windows';

// The Dashboard view (docs/specs/017-telemetry/telemetry.md, default tab): the key metrics, most
// important first. At a Glance answers "is it working?" in six plain cards, then chart stacks
// grouped by the question they answer, each a combined chart that opens into its members' cards.
// Charts come from the shared catalogue, so a stack or card only references them.
//
// Groups run as a funnel: who arrives, what they make, which features carry the work, how they
// work together, how machines connect, then health. Until October 2026 this charted every event
// (63 stacks, ten of them tours); everything else now sits in the Detail tab that goes deeper,
// and every emitted event still lands in some chart there (metric-emitters.test). A stack that
// goes deeper than it can links to its section.
//
// Deliberately a FIXED list, not "top by volume": a first-time visitor
// (`Participant·Created`) is low volume but high signal, so it must always be
// on screen. A metric with no events renders as zero with a flat line rather
// than disappearing, so the layout is stable day to day.

export const GROUPS: MetricGroup[] = [
  {
    title: 'At a glance',
    metrics: [
      NEW_VISITORS,
      RETURNING_VISITORS,
      SIGN_UPS,
      DOCUMENTS_CREATED,
      MULTIPLAYER_SESSIONS,
      FAILED_REQUESTS,
    ],
  },
  {
    title: 'Visitors',
    metrics: [ALL_VISITORS, ACCOUNT_ACTIVITY, PAGE_VIEWS_BY_APP, SIGN_IN_PROMPTS, ONBOARDING_TOURS],
  },
  {
    title: 'Content',
    metrics: [DOCUMENT_ACTIONS, TAB_ACTIONS, ELEMENTS_ADDED, ELEMENT_EDITING],
  },
  {
    title: 'Features',
    metrics: [PAGE_WORK, PALETTE_USE, CANVAS_MODES, LOOK_AND_FEEL, PANELS_OPENED, OFFLINE_MODE],
  },
  // Live Together is the only stack that counts two people on one canvas at
  // the same moment; the rest of Collaboration counts the ways in and keeping
  // up, so read them against it.
  {
    title: 'Collaboration',
    metrics: [
      LIVE_TOGETHER,
      JOINING,
      SHARE_LINKS_MADE,
      SHARING_AND_EMBEDS,
      TIMELINE_AND_ACTIVITY,
      PRESENTATIONS,
    ],
  },
  {
    title: 'Connections',
    metrics: [MCP_TOOL_CALLS, CLI_COMMANDS_STACK, AGENT_VIEWED],
  },
  // Emails Sent is written server-side by the api worker: nothing about a send
  // reaches a browser, so this is the only place it can be counted. The
  // onboarding series exists to bring people back, so read it against All
  // Visitors. Failures land on Exceptions as Error·Api·Http*.SendEmail.
  {
    title: 'Health & support',
    metrics: [EXCEPTIONS, HELP_CENTRE, EMAILS_SENT],
  },
];

export function DashboardView({
  summary,
  active,
  onOpenSection,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
  onOpenSection: (section: SectionKey) => void;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The key metrics we watch, for <span className="font-medium">{windowLabel(active)}</span>.
        Each card&rsquo;s line is the last 30 days; the selected window is highlighted. Every other
        event is on the Detail tabs.
      </p>
      <MetricGroups
        groups={GROUPS}
        summary={summary}
        active={active}
        onOpenSection={onOpenSection}
      />
    </div>
  );
}
