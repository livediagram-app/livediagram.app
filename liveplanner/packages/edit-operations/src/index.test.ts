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

  it('answers a refusal as text', () => {
    const rejection = refused(
      applyEditOperations(sprintDashboard(), [{ op: 'rm', target: 'm77' }]),
    );
    expect(formatRejections([rejection])[0]).toBe('error target_not_found · op 1');
    expect(formatRejections([rejection]).at(-1)).toBe('nothing was applied');
  });

  it('keeps the four operations a Plan tab takes, and the wire codes', () => {
    expect(EDIT_OPERATION_NAMES).toEqual(['add', 'set', 'rm', 'test']);
    expect(EDIT_REJECTION_CODES).toContain('element_locked');
    expect(EDIT_REJECTION_CODES).not.toContain('arrow_exists');
  });
});
