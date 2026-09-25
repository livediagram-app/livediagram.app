'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { AI_TURNED_ON, ASSIGNED_ACTIONS, NOTES, ORGANISATION } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Editing view (spec/22): the in-editor tools that organise work rather than
// draw it: the AI opt-in, notes, folders, assigned actions. AI usage and
// layers moved to Highlights as the AI Assistance and Layers Feature stacks.
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
// the type carries the meaning (the AI opt-in is On vs Off, and only On is
// the signal).
export const GROUPS: MetricGroup[] = [
  {
    title: 'Editing tools',
    metrics: [AI_TURNED_ON, NOTES, ASSIGNED_ACTIONS, ORGANISATION],
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
        <span className="font-medium">{windowLabel(active)}</span>: the AI opt-in, notes, assigned
        actions, and folders. AI Assistance and Layers are stacks on Highlights.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
