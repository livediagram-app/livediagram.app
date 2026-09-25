'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { ASSIGNED_ACTIONS, NOTES, ORGANISATION } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Editing view (spec/22): the in-editor tools that organise work rather than
// draw it: notes, assigned actions, folders. AI usage and layers moved to
// the Dashboard as the AI Assistance and Layers Feature stacks; the AI opt-in
// is a setting, so it lives on the Settings tab.
//
// Every metric here was already being emitted, validated, and stored, and none
// of it was rendered anywhere: `AI·Used` had no card on any tab, and the whole
// `Layer` category (spec/74), plus Note, Folder and Action, appeared only in
// the vocabulary labeller the old Raw table used. Data arriving and nobody reading
// it is the same blind spot as data never sent, one step further along — the
// Palette catalogue drifting out of the dashboard is exactly how four element
// kinds came to count zero (spec/22, "How completeness is tested").
//
// Aggregates where the type split is arbitrary for this lens, specific where
// the type carries the meaning.
export const GROUPS: MetricGroup[] = [
  {
    title: 'Editing tools',
    metrics: [NOTES, ASSIGNED_ACTIONS, ORGANISATION],
  },
];

export function EditingView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The tools that organise the work rather than draw it, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>: notes, assigned actions, and
        folders. AI Assistance and Layers are stacks on the Dashboard; the AI opt-in is on Settings.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
