'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@liveworkspace/telemetry';
import { CardColumns } from './CardColumns';
import { useTelemetryApp } from './app';
import { RankCard, rank } from './RankCard';
import { rankTrend, windowLabel } from './windows';

// Modes section of the Features tab (docs/specs/017-telemetry/telemetry.md): the canvas selection modes picked from the
// palette (`Canvas·Used·<mode>`, restricted to SELECTION_MODES), and the
// options people set inside them (`UI·Changed·<Mode><Option>`). Split from the
// Palette tab, which ranks the elements people add: a mode is a way of working
// on the canvas, not a thing put on it. Which modes and options are the app's
// own (its config's `modes`); FeaturesView shows this only for an app that has them.

export function ModesView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const config = useTelemetryApp().modes;
  if (!config) return null;
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const modes = rank(
    rows,
    (r) =>
      r.category === 'Canvas' && r.action === 'Used' && config.selection.includes(r.type ?? ''),
  );
  const options = rank(
    rows,
    (r) => r.category === 'UI' && r.action === 'Changed' && config.option.test(r.type ?? ''),
  );

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The canvas modes people switch into, and the options they set inside them, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>, most to least used.
      </p>
      <div className="mt-6">
        <CardColumns>
          <RankCard
            trend={trend}
            title="Selection Modes"
            subtitle={config.selectionSubtitle}
            category="Canvas"
            action="Used"
            items={modes}
            daily={summary.daily}
            emptyLabel="No selection modes were used in this window yet."
          />
          <RankCard
            trend={trend}
            title="Mode Options"
            subtitle={config.optionsSubtitle}
            category="UI"
            action="Changed"
            items={options}
            daily={summary.daily}
            emptyLabel="No mode options were changed in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
