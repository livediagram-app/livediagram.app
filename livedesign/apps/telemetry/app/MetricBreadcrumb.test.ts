import { describe, expect, it } from 'vitest';
import { metricCrumbs } from './MetricBreadcrumb';
import type { Metric } from './metrics';

const metric = (type: string | null): Metric => ({
  key: `Timeline|Opened|${type ?? ''}`,
  category: 'Timeline',
  action: 'Opened',
  type,
  label: 'Timeline · Opened',
  total30: 0,
});

describe('metricCrumbs', () => {
  it('ends a cloud level on itself, not a link', () => {
    expect(metricCrumbs([])).toEqual([{ label: 'All events', to: null }]);
    expect(metricCrumbs(['Timeline', 'Opened'])).toEqual([
      { label: 'All events', to: [] },
      { label: 'Timeline', to: ['Timeline'] },
      { label: 'Opened', to: null },
    ]);
  });

  it('keeps the full trail over a charted metric, ending in the metric', () => {
    // The path is ignored: a metric picked from the search box gets the same
    // trail as one reached through the cloud.
    expect(metricCrumbs([], metric('Landing'))).toEqual([
      { label: 'All events', to: [] },
      { label: 'Timeline', to: ['Timeline'] },
      { label: 'Opened', to: ['Timeline', 'Opened'] },
      { label: 'Landing', to: null },
    ]);
  });

  it('ends an untyped metric at its action', () => {
    expect(metricCrumbs([], metric(null)).map((c) => c.to)).toEqual([[], ['Timeline'], null]);
  });
});
