'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { CardColumns } from './CardColumns';
import { SETTINGS_STACKS } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { isSettingsCategory } from './opened-types';
import { RankCard, rank } from './RankCard';
import { rankTrend, windowLabel } from './windows';

// Settings view (docs/specs/017-telemetry/telemetry.md): how often each setting in the editor's Settings
// dialog gets changed, one stack per Settings category, one chart per row.
// Below them, which categories people open inside the dialog
// (`UI·Opened·Settings<Category>`), the signal for whether the dialog's
// layout puts the right ones first.
export const GROUPS: MetricGroup[] = [{ title: 'By category', metrics: [...SETTINGS_STACKS] }];

export function SettingsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const categories = rank(
    rows,
    (r) => r.category === 'UI' && r.action === 'Opened' && isSettingsCategory(r.type),
  );
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How often each setting in the editor&rsquo;s Settings dialog was changed, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>, either way. Which way it went is
        in Search. Below, which categories people open inside the dialog.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
      <div className="mt-8">
        <CardColumns>
          <RankCard
            trend={rankTrend(summary, active)}
            title="Categories Opened"
            subtitle="Which Settings categories people open once the dialog is up, most to least"
            category="UI"
            action="Opened"
            items={categories}
            daily={summary.daily}
            emptyLabel="No Settings categories were opened in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
