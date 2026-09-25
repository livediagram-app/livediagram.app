import { describe, expect, it } from 'vitest';
import { NEW_VISITORS, RETURNING_VISITORS } from './metric-catalogue';
import { groupMetrics, isStack, stackSeriesColor, type MetricGroup } from './metric-series';

describe('chart stacks', () => {
  const stack = {
    stack: true as const,
    title: 'All Visitors',
    blurb: '',
    members: [NEW_VISITORS, RETURNING_VISITORS],
  };

  it('opens stacks up so every chart a group shows is listed', () => {
    const group: MetricGroup = { title: 'Visitors', metrics: [stack, NEW_VISITORS] };
    expect(groupMetrics(group)).toEqual([NEW_VISITORS, RETURNING_VISITORS, NEW_VISITORS]);
  });

  it('references its charts rather than owning them', () => {
    // The same chart object can sit in a second stack, untouched by the first.
    const other = { ...stack, title: 'Returns', members: [RETURNING_VISITORS] };
    expect(other.members[0]).toBe(stack.members[1]);
    expect(isStack(stack)).toBe(true);
    expect(isStack(NEW_VISITORS)).toBe(false);
  });

  it('gives each member its own line colour', () => {
    expect(stackSeriesColor(0)).not.toBe(stackSeriesColor(1));
  });
});
