'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import {
  DIAGRAMS_CREATED,
  DIAGRAMS_DELETED,
  DIAGRAMS_DUPLICATED,
  DIAGRAMS_LOADED,
  DIAGRAMS_RENAMED,
  TABS_CREATED,
  TABS_DELETED,
  TABS_DUPLICATED,
  TABS_LOADED,
  TABS_RENAMED,
} from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Content view (spec/22): the diagram + tab lifecycle side by side — how
// often they're opened (Loaded), made (Created), renamed, deleted and
// duplicated. Loaded is an opens/engagement signal (every open of an
// existing diagram / every tab whose content is fetched), distinct from
// the once-per-object Created. One chart stack per object type (spec/22),
// sharing the same MetricGroups renderer as Highlights / Acquisition.
export const GROUPS: MetricGroup[] = [
  {
    title: 'Lifecycle',
    metrics: [
      {
        stack: true,
        title: 'Diagram Actions',
        blurb: 'Diagrams opened, made, renamed, deleted and duplicated.',
        members: [
          DIAGRAMS_LOADED,
          DIAGRAMS_CREATED,
          DIAGRAMS_RENAMED,
          DIAGRAMS_DELETED,
          DIAGRAMS_DUPLICATED,
        ],
      },
      {
        stack: true,
        title: 'Tab Actions',
        blurb: 'Tabs opened, made, renamed, deleted and duplicated.',
        members: [TABS_LOADED, TABS_CREATED, TABS_RENAMED, TABS_DELETED, TABS_DUPLICATED],
      },
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
        one, including a new one&rsquo;s first open; Created counts the first time it&rsquo;s made.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
