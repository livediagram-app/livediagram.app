import { describe, expect, it } from 'vitest';
import {
  EDIT_OPERATION_NAMES,
  EDIT_REJECTION_CODES,
  applyEditOperations,
  formatRejections,
  formatResultFooter,
  formatResultLines,
  validateEditOperations,
} from './index';
import { fixedIds, sprintDashboard } from './fixtures/sprint-dashboard';
import { applied, refused } from './fixtures/outcomes';
import type { EditOperation } from './types';

// The path the api's changeset route takes: the JSON form validated, applied, and answered as text.
describe('the public surface', () => {
  it('validates, applies and answers a changeset', () => {
    const parsed = validateEditOperations([
      { op: 'set', target: 'w1', fields: { planView: { view: 'priority-matrix' } } },
      { op: 'rm', target: 'm3' },
    ]);
    expect(parsed).toHaveProperty('operations');
    const { operations } = parsed as { operations: EditOperation[] };
    const outcome = applied(
      applyEditOperations(sprintDashboard(), operations, { makeId: fixedIds() }),
    );
    const footer = formatResultFooter({ dryRun: true, rev: 41 });
    expect([...formatResultLines(outcome.results), footer]).toEqual([
      '~ w1  planView (changed)',
      '- m3  plan-view',
      'dry run · rev 41 · nothing written',
    ]);
  });

  // docs/specs/026-plan/plan-agents.md "Making a dashboard": a flow chart set by its view id and range.
  it("sets a flow chart's range, and refuses one outside the four naming them", () => {
    const set = (planView: { view: string; rangeDays: number }) =>
      applyEditOperations(sprintDashboard(), [{ op: 'set', target: 'w1', fields: { planView } }]);
    const outcome = applied(set({ view: 'cumulative-flow', rangeDays: 180 }));
    expect(formatResultLines(outcome.results)).toEqual(['~ w1  planView (changed)']);
    const rejection = refused(set({ view: 'cycle-time', rangeDays: 7 }));
    expect(rejection.code).toBe('invalid_result');
    expect(rejection.details.join(' ')).toContain('rangeDays (14, 30, 90 or 180)');
  });

  it('answers a refusal as text', () => {
    const rejection = refused(
      applyEditOperations(sprintDashboard(), [{ op: 'rm', target: 'm77' }]),
    );
    expect(formatRejections([rejection])[0]).toBe('error target_not_found · op 1 · rm m77');
    expect(formatRejections([rejection]).at(-1)).toBe('nothing was applied');
  });

  it('keeps the four operations a Plan tab takes, and the wire codes', () => {
    expect(EDIT_OPERATION_NAMES).toEqual(['add', 'set', 'rm', 'test']);
    expect(EDIT_REJECTION_CODES).toContain('element_locked');
    expect(EDIT_REJECTION_CODES).not.toContain('arrow_exists');
  });
});
