'use client';

import type { TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { SETTINGS_STACKS } from './metric-catalogue';
import { MetricGroups, type MetricGroup } from './MetricCards';
import { windowLabel } from './windows';

// Settings view (spec/22): how often each setting in the editor's Settings
// dialog gets changed, one stack per Settings category, one chart per row.
export const GROUPS: MetricGroup[] = [{ title: 'By category', metrics: [...SETTINGS_STACKS] }];

export function SettingsView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        How often each setting in the editor&rsquo;s Settings dialog was changed, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>, either way. Which way it went is
        in Search.
      </p>
      <MetricGroups groups={GROUPS} summary={summary} active={active} />
    </div>
  );
}
