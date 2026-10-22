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
import { checkoutFlow, fixedIds } from './fixtures/checkout-flow';
import { applied, refused } from './fixtures/outcomes';
import type { EditOperation } from './types';

// The path the api's changeset route takes: the JSON form validated, applied, and answered as text.
describe('the public surface', () => {
  it('validates, applies and answers a changeset', () => {
    const parsed = validateEditOperations([
      { op: 'set', target: 'n3', fields: { label: 'Sign in' } },
      { op: 'rm', target: 'n7' },
    ]);
    expect(parsed).toHaveProperty('operations');
    const { operations } = parsed as { operations: EditOperation[] };
    const outcome = applied(
      applyEditOperations(checkoutFlow(), operations, { makeId: fixedIds() }),
    );
    const footer = formatResultFooter({ dryRun: true, rev: 41, lint: 'lint unavailable' });
    expect([...formatResultLines(outcome.results), footer]).toEqual([
      '~ n3  label "Login"→"Sign in"',
      '- n7  square "Charge card"',
      '- a6  arrow n6→n7 "yes" (pinned to n7)',
      '- a7  arrow n7→n8 (pinned to n7)',
      'dry run · rev 41 · lint unavailable · nothing written',
    ]);
  });

  it('answers a refusal as text', () => {
    const rejection = refused(applyEditOperations(checkoutFlow(), [{ op: 'rm', target: 'n77' }]));
    expect(formatRejections([rejection])[0]).toBe('error target_not_found · op 1');
    expect(formatRejections([rejection]).at(-1)).toBe('nothing was applied');
  });

  it('keeps the whole vocabulary and the wire codes', () => {
    expect(EDIT_OPERATION_NAMES).toHaveLength(12);
    expect(EDIT_REJECTION_CODES).toContain('element_locked');
  });
});
