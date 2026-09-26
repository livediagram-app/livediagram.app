'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { CardColumns } from './CardColumns';
import { ASSIGNED_ACTIONS, NOTES, ORGANISATION } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { RankCard, rank } from './RankCard';
import { rankTrend, windowLabel } from './windows';

// Editing view (docs/specs/017-telemetry/telemetry.md): the in-editor tools that organise work rather than
// draw it: notes, assigned actions, folders. AI usage and layers moved to
// the Dashboard as the AI Assistance and Layers Feature stacks; the AI opt-in
// is a setting, so it lives on the Settings tab.
//
// Every metric here was already being emitted, validated, and stored, and none
// of it was rendered anywhere: `AI·Used` had no card on any tab, and the whole
// `Layer` category (docs/specs/006-diagram/layers.md), plus Note, Folder and Action, appeared only in
// the vocabulary labeller the old Raw table used. Data arriving and nobody reading
// it is the same blind spot as data never sent, one step further along — the
// Palette catalogue drifting out of the dashboard is exactly how four element
// kinds came to count zero (docs/specs/017-telemetry/telemetry.md, "How completeness is tested").
//
// Aggregates where the type split is arbitrary for this lens, specific where
// the type carries the meaning.
//
// Below the stacks, the breakdowns the Dashboard's totals hide: which
// formatting controls people use (Element·Changed by control), which export
// formats they pick, and which dialogs they open. The Element Editing, Export
// & Import, and Dialogs & Panels stacks link here.
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
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const of = (category: string, action: string) =>
    rank(rows, (r) => r.category === category && r.action === action);
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The tools that organise the work rather than draw it, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>: notes, assigned actions, and
        folders, then which formatting controls, export formats and dialogs get used. AI Assistance
        and Layers are stacks on the Dashboard; the AI opt-in is on Settings.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
      <div className="mt-8">
        <CardColumns>
          <RankCard
            title="Formatting Controls"
            subtitle="What people change on an element, most to least: presets, arrow ends, text, colour and more"
            category="Element"
            action="Changed"
            items={of('Element', 'Changed')}
            daily={summary.daily}
            trend={trend}
            emptyLabel="No elements were changed in this window yet."
          />
          <RankCard
            title="Export Formats"
            subtitle="Which formats diagrams leave in: PNG, SVG, PDF, JSON, Mermaid, Markdown, Excalidraw"
            category="Diagram"
            action="Exported"
            items={of('Diagram', 'Exported')}
            daily={summary.daily}
            trend={trend}
            emptyLabel="Nothing was exported in this window yet."
          />
          <RankCard
            title="Dialogs Opened"
            subtitle="Which dialogs, panels and in-editor help articles people open"
            category="UI"
            action="Opened"
            items={of('UI', 'Opened')}
            daily={summary.daily}
            trend={trend}
            emptyLabel="No dialogs were opened in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
