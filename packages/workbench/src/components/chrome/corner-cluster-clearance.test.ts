import { describe, expect, it } from 'vitest';
import { UI_SCALE_MAX } from '../../lib/ui-scale';
import {
  CORNER_CLUSTER_CLEARANCE,
  CORNER_CLUSTER_CLEARANCE_PX,
  CORNER_CLUSTER_GAP_PX,
  CORNER_CLUSTER_PX,
  TAB_BAR_PX,
} from './corner-cluster-clearance';

describe('corner cluster clearance', () => {
  it('the class says the same number as the computed clearance', () => {
    expect(CORNER_CLUSTER_CLEARANCE).toBe(`bottom-[${CORNER_CLUSTER_CLEARANCE_PX}px]`);
  });

  it('clears the cluster at 100% (110px measured) and at the largest UI scale, with a gap', () => {
    expect(TAB_BAR_PX + CORNER_CLUSTER_PX).toBe(110);
    expect(CORNER_CLUSTER_CLEARANCE_PX).toBeGreaterThanOrEqual(
      TAB_BAR_PX + CORNER_CLUSTER_PX * UI_SCALE_MAX + CORNER_CLUSTER_GAP_PX,
    );
  });
});
