'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
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

const GROUPS: MetricGroup[] = [
  {
    title: 'Visitors',
    metrics: [
      { category: 'Participant', action: 'Created', type: null, title: 'New Visitors' },
      {
        category: 'Participant',
        action: 'Returned',
        allTypes: true,
        title: 'Returning Visitors',
        blurb:
          'Browsers that came back on a later day than their first visit, counted once per day. Sum of guests and signed-in users.',
      },
      { category: 'Session', action: 'SignedUp', type: null, title: 'Sign-Ups' },
      { category: 'Session', action: 'SignedIn', type: null, title: 'Sign-Ins' },
    ],
  },
  {
    title: 'Creation',
    metrics: [
      { category: 'Diagram', action: 'Created', type: null, title: 'Diagrams Created' },
      { category: 'Tab', action: 'Created', type: null, title: 'Tabs Created' },
      {
        category: 'Element',
        action: 'Added',
        allTypes: true,
        title: 'Elements Added',
        blurb:
          'Every shape, text, sticky, arrow, or image dropped onto a canvas, across all kinds.',
      },
    ],
  },
  {
    title: 'Collaboration',
    metrics: [
      { category: 'Diagram', action: 'Shared', type: 'Edit', title: 'Edit Links Shared' },
      { category: 'Diagram', action: 'Joined', type: 'Edit', title: 'Collaborators Joined' },
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
        blurb: 'Tabs exported to a file, across every format (PNG, SVG, JSON, …).',
      },
      { category: 'UI', action: 'Toggled', type: 'Dark', title: 'Dark-Mode Switches' },
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
