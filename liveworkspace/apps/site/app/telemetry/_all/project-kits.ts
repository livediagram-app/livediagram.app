// Project Kits' figures (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard"): liveworkspace.app's own
// kit events (PLATFORM_OWN_TELEMETRY_EVENTS), every kit together, as each step's total in a window and the span
// before it, and as a 30-day daily series.

import {
  KIT_TELEMETRY_ACTIONS,
  KIT_TELEMETRY_TYPES,
  metricKey,
  type KitTelemetryAction,
  type TelemetrySummary,
  type TelemetryWindow,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';

export const KIT_CATEGORY = 'Kit';

export type KitStepFigures = Record<KitTelemetryAction, { now: number; before: number }>;

export type KitFigures = {
  steps: KitStepFigures;
  // Each step's count a day, oldest first, every kit added up.
  daily: Record<KitTelemetryAction, number[]>;
  // Completed as a share of Started in the window, or null with nothing started.
  completedShare: number | null;
  // Anything at all in the 30 days.
  counted: boolean;
};

function windowCounts(window: TelemetryWindow | undefined): Record<KitTelemetryAction, number> {
  const out = Object.fromEntries(KIT_TELEMETRY_ACTIONS.map((a) => [a, 0])) as Record<
    KitTelemetryAction,
    number
  >;
  for (const row of window?.rows ?? []) {
    if (row.category !== KIT_CATEGORY) continue;
    const action = row.action as KitTelemetryAction;
    if (action in out) out[action] += row.count;
  }
  return out;
}

export function kitFigures(summary: TelemetrySummary, active: TelemetryWindowKey): KitFigures {
  const now = windowCounts(summary.windows[active]);
  const before = windowCounts(summary.previousWindows?.[active]);
  const days = summary.daily?.days.length ?? 0;
  const byMetric = summary.daily?.byMetric ?? {};
  const daily = Object.fromEntries(
    KIT_TELEMETRY_ACTIONS.map((action) => {
      const sum = Array.from({ length: days }, () => 0);
      for (const type of KIT_TELEMETRY_TYPES) {
        const series = byMetric[metricKey(KIT_CATEGORY, action, type)];
        series?.forEach((count, i) => {
          sum[i] = (sum[i] ?? 0) + count;
        });
      }
      return [action, sum];
    }),
  ) as Record<KitTelemetryAction, number[]>;
  const steps = Object.fromEntries(
    KIT_TELEMETRY_ACTIONS.map((a) => [a, { now: now[a], before: before[a] }]),
  ) as KitStepFigures;
  return {
    steps,
    daily,
    completedShare: now.Started > 0 ? now.Completed / now.Started : null,
    counted: KIT_TELEMETRY_ACTIONS.some((a) => daily[a].some((n) => n > 0)),
  };
}
