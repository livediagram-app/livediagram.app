// Whole Plan by share role (docs/specs/026-plan/plan-tabs.md "Whole Plan"): an Editor of the whole plan on a plan
// saved to an account; never a Participant, a Viewer, a tab-scoped link or an offline plan.
import { describe, expect, it } from 'vitest';
import { wholePlanOffer } from './whole-plan-offer';

const base = { projectId: 'P1', ownerId: 'user_ada', isOffline: false, isStructureReadOnly: false };

describe('wholePlanOffer', () => {
  it('offers the plan to an Editor of the whole plan', () => {
    expect(wholePlanOffer(base)).toEqual({ projectId: 'P1', ownerId: 'user_ada' });
  });

  it('offers nothing to a Participant, a Viewer or a tab-scoped link (structure read-only)', () => {
    expect(wholePlanOffer({ ...base, isStructureReadOnly: true })).toBeUndefined();
  });

  it('offers nothing on an offline plan, or before the plan has an id', () => {
    expect(wholePlanOffer({ ...base, isOffline: true })).toBeUndefined();
    expect(wholePlanOffer({ ...base, projectId: null })).toBeUndefined();
  });
});
