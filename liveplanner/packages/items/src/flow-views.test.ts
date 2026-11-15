import { describe, expect, it } from 'vitest';
import {
  FLOW_VIEWS,
  PLAN_PALETTE_VISUALISATIONS,
  PLAN_VISUALISATION_LABELS,
  flowRangeOf,
  isFlowView,
  isPlanViewSettings,
  viewShownTypes,
} from './plan-views';
import { FLOW_RANGE_DEFAULT, isFlowRange } from './flow-metrics';
import { ITEM_TYPES } from './item-types';

// docs/specs/026-plan/plan-views.md "Flow charts": the three views, their range, and every card type feeding them.
describe('flow chart views', () => {
  it('are visualisations the palette offers, named as the spec names them', () => {
    for (const v of FLOW_VIEWS) expect(PLAN_PALETTE_VISUALISATIONS).toContain(v);
    expect(FLOW_VIEWS.map((v) => PLAN_VISUALISATION_LABELS[v])).toEqual([
      'Cycle Time',
      'Throughput',
      'Cumulative Flow',
    ]);
    expect(isFlowView('throughput')).toBe(true);
    expect(isFlowView('gantt')).toBe(false);
  });

  it('read their range, 30 days unless one of the others is stored', () => {
    expect(flowRangeOf({})).toBe(FLOW_RANGE_DEFAULT);
    expect(flowRangeOf({ rangeDays: 90 })).toBe(90);
    expect(flowRangeOf({ rangeDays: 45 })).toBe(30);
    expect(isFlowRange(180)).toBe(true);
    expect(isFlowRange('14')).toBe(false);
  });

  it('accept only the four ranges', () => {
    for (const days of [14, 30, 90, 180])
      expect(isPlanViewSettings({ view: 'cycle-time', rangeDays: days })).toBe(true);
    for (const days of [0, 7, 365, '30', null])
      expect(isPlanViewSettings({ view: 'cycle-time', rangeDays: days })).toBe(false);
  });

  it('take every card type until told otherwise', () => {
    expect(viewShownTypes('cumulative-flow', undefined, ITEM_TYPES)).toEqual(
      ITEM_TYPES.map((t) => t.id),
    );
    expect(viewShownTypes('throughput', { types: ['task'] }, ITEM_TYPES)).toEqual(['task']);
  });
});
