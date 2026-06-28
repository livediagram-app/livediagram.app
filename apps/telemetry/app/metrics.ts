// The searchable metric universe for the Search view (spec/22): one entry
// per distinct event the api aggregated a 30-day series for. Shared by the
// MetricPicker (browse + search) and MetricSearch (the selected-metric
// visualisation) so they agree on what a "metric" is.

import type { TelemetryDaily } from '@livediagram/api-schema';
import { eventLabel } from './event-vocab';

export type Metric = {
  key: string; // metricKey: `category|action|type`
  category: string;
  action: string;
  type: string | null;
  label: string; // "Category · Action · Type"
  total30: number; // sum of the 30-day series, for default ranking
};

export function buildMetrics(daily: TelemetryDaily): Metric[] {
  // `?? {}` guards a summary from an older api revision that predates
  // byMetric: the search simply finds nothing rather than throwing.
  return Object.entries(daily.byMetric ?? {})
    .map(([key, series]) => {
      const [category = '', action = '', type = ''] = key.split('|');
      const typeOrNull = type === '' ? null : type;
      return {
        key,
        category,
        action,
        type: typeOrNull,
        label: `${category} · ${eventLabel({ action, type: typeOrNull })}`,
        total30: series.reduce((sum, n) => sum + n, 0),
      };
    })
    .sort((a, b) => b.total30 - a.total30);
}
