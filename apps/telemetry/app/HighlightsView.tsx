'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { NEW_VISITORS, RETURNING_VISITORS } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// The Highlights view (spec/22, default tab): the key product metrics we
// most want to watch, grouped into the questions they answer — Visitors,
// Creation, Collaboration, Output. Each metric is a card with the
// selected-window count and a 30-day mini trend line. Deliberately a
// FIXED list, not "top by volume" — a first-time visitor
// (`Participant·Created`) is low volume but high signal, so it must
// always be on screen. A metric with no events renders as zero with a
// flat line rather than disappearing, so the layout is stable day to day.
//
// A highlight is either a single typed event, or an AGGREGATE over every
// type of a `category·action` (`allTypes`) — used where the type split is
// arbitrary for this lens (any shape added, any export format) rather
// than meaningful (Edit vs View share links; the Dark UI toggle, which
// shares `UI·Toggled` with unrelated setting flips).
//
// New + Returning Visitors are one chart stack (spec/22): a combined chart that
// fans out into the two cards. Both charts come from the shared catalogue, so
// the stack only references them.

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
      { category: 'Session', action: 'SignedUp', type: null, title: 'Sign-Ups' },
      { category: 'Session', action: 'SignedIn', type: null, title: 'Sign-Ins' },
    ],
  },
  {
    title: 'Creation',
    metrics: [
      {
        category: 'Diagram',
        action: 'Created',
        allTypes: true,
        title: 'Diagrams Created',
        blurb:
          'New diagrams from the New Diagram wizard, stored in the cloud or offline in this browser.',
      },
      { category: 'Tab', action: 'Created', type: null, title: 'Tabs Created' },
      {
        category: 'Element',
        action: 'Added',
        allTypes: true,
        title: 'Elements Added',
        blurb:
          'Every shape, text, sticky, arrow, or image put on a canvas, across all kinds. Copies count too: a duplicate or paste adds one per element it creates.',
      },
    ],
  },
  {
    title: 'Collaboration',
    metrics: [
      { category: 'Diagram', action: 'Shared', type: 'Edit', title: 'Edit Links Shared' },
      {
        category: 'Diagram',
        action: 'Joined',
        type: 'Edit',
        title: 'Collaborators Joined',
        blurb:
          'People who came into a diagram through an edit link. Counted once per person per diagram, not on every revisit.',
      },
      { category: 'Comment', action: 'Added', type: null, title: 'Comments Added' },
    ],
  },
  {
    title: 'Output & Preferences',
    metrics: [
      {
        category: 'Diagram',
        action: 'Exported',
        allTypes: true,
        title: 'Exports',
        blurb:
          'A tab or selection exported, across every format (PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw). For the text formats, copying to the clipboard counts as an export too.',
      },
      {
        category: 'UI',
        action: 'Toggled',
        type: 'Dark',
        title: 'Dark-Mode Switches',
        blurb: 'Someone set the editor appearance to Dark, from the header toggle or Settings.',
      },
    ],
  },
];

export function HighlightsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The key metrics we watch, for <span className="font-medium">{windowLabel(active)}</span>.
        Each card&rsquo;s line is the last 30 days; the selected window is highlighted.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
