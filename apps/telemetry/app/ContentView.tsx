'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Content view (spec/22): the diagram + tab lifecycle side by side — how
// often they're opened (Loaded), made (Created), renamed, deleted and
// duplicated. Loaded is an opens/engagement signal (every open of an
// existing diagram / every tab whose content is fetched), distinct from
// the once-per-object Created. Two groups, one per object type, sharing
// the same MetricGroups renderer as Highlights / Acquisition.
const GROUPS: MetricGroup[] = [
  {
    title: 'Diagram',
    metrics: [
      {
        category: 'Diagram',
        action: 'Loaded',
        type: null,
        title: 'Diagrams Loaded',
        blurb:
          'An existing diagram was opened, counted on every open (including a page refresh), not just the first time.',
      },
      { category: 'Diagram', action: 'Created', type: null, title: 'Diagrams Created' },
      { category: 'Diagram', action: 'Renamed', type: null, title: 'Diagrams Renamed' },
      { category: 'Diagram', action: 'Deleted', type: null, title: 'Diagrams Deleted' },
      { category: 'Diagram', action: 'Duplicated', type: null, title: 'Diagrams Duplicated' },
    ],
  },
  {
    title: 'Tab',
    metrics: [
      {
        category: 'Tab',
        action: 'Loaded',
        type: null,
        title: 'Tabs Loaded',
        blurb:
          "A tab's content was fetched for viewing, counted each time (the first tab when a diagram opens, then each tab switched to).",
      },
      { category: 'Tab', action: 'Created', type: null, title: 'Tabs Created' },
      { category: 'Tab', action: 'Renamed', type: null, title: 'Tabs Renamed' },
      { category: 'Tab', action: 'Deleted', type: null, title: 'Tabs Deleted' },
      { category: 'Tab', action: 'Duplicated', type: null, title: 'Tabs Duplicated' },
    ],
  },
];

export function ContentView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The diagram and tab lifecycle, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>. Loaded counts every open of an
        existing one; Created counts the first time it&rsquo;s made.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
