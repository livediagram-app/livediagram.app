import { describe, expect, it } from 'vitest';
import { createText } from '@livediagram/document';
import { createTab } from '@/app/document/[id]/editor-page-helpers';
import { planHoldsTab } from './useLeavePlan';

// docs/specs/026-plan/plan-mode.md "Plan keeps its own tabs".
describe('planHoldsTab', () => {
  const empty = createTab('Empty');
  const full = { ...createTab('Board'), elements: [createText(0, 0)] };

  it('keeps a Plan tab with anything on it in Plan', () => {
    expect(planHoldsTab('plan', 'diagram', full)).toBe(true);
    expect(planHoldsTab('plan', 'draw', full)).toBe(true);
  });

  it('lets an empty Plan tab, and every other mode, switch', () => {
    expect(planHoldsTab('plan', 'diagram', empty)).toBe(false);
    expect(planHoldsTab('plan', 'plan', full)).toBe(false);
    expect(planHoldsTab('diagram', 'draw', full)).toBe(false);
    expect(planHoldsTab('plan', 'diagram', undefined)).toBe(false);
  });
});
