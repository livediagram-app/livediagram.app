'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { CardColumns } from './CardColumns';
import { SELECTION_MODES } from './palette-types';
import { RankCard, rank } from './RankCard';
import { rankTrend, windowLabel } from './windows';

// Canvas Modes view (spec/22): the canvas selection modes picked from the
// palette (`Canvas·Used·<mode>`, restricted to SELECTION_MODES), and the
// options people set inside them (`UI·Changed·<Mode><Option>`). Split from the
// Palette tab, which ranks the elements people add: a mode is a way of working
// on the canvas, not a thing put on it.

const MODE_OPTION = /^(Eraser|Laser|Spotlight|Format)/;

export function ModesView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const modes = rank(
    rows,
    (r) => r.category === 'Canvas' && r.action === 'Used' && SELECTION_MODES.includes(r.type ?? ''),
  );
  const options = rank(
    rows,
    (r) => r.category === 'UI' && r.action === 'Changed' && MODE_OPTION.test(r.type ?? ''),
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
            subtitle="Laser, spotlight, eraser, highlighter, format painter, isometric, avatar"
            category="Canvas"
            action="Used"
            items={modes}
            daily={summary.daily}
            emptyLabel="No selection modes were used in this window yet."
          />
          <RankCard
            trend={trend}
            title="Mode Options"
            subtitle="Settings inside a mode: eraser size and target, laser colour and trail, spotlight shape, format painter copies"
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
