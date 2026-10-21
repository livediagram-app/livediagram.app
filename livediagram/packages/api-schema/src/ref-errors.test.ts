import { describe, expect, it } from 'vitest';
import { EDIT_REJECTION_CODES } from './changesets';
import { isRefErrorBody, TARGET_AMBIGUOUS_ERROR, TARGET_NOT_FOUND_ERROR } from './ref-errors';

describe('ref errors', () => {
  it('share the edit-operation rejection codes', () => {
    expect(EDIT_REJECTION_CODES).toContain(TARGET_NOT_FOUND_ERROR);
    expect(EDIT_REJECTION_CODES).toContain(TARGET_AMBIGUOUS_ERROR);
  });

  it('recognise a ref error body', () => {
    const body = {
      error: 'target_ambiguous',
      message: '"e4" matches 2 elements',
      input: 'e4',
      candidates: [
        { ref: 'e4a8', kind: 'square', label: 'Payments' },
        { ref: 'e4f1', kind: 'text', label: null },
      ],
      stale: false,
    };
    expect(isRefErrorBody(body)).toBe(true);
  });

  it('refuse anything else', () => {
    const good = {
      error: 'target_not_found',
      message: 'm',
      input: 'x',
      candidates: [],
      stale: false,
    };
    expect(isRefErrorBody(null)).toBe(false);
    expect(isRefErrorBody('target_not_found')).toBe(false);
    expect(isRefErrorBody({ ...good, error: 'invalid_value' })).toBe(false);
    expect(isRefErrorBody({ ...good, message: 1 })).toBe(false);
    expect(isRefErrorBody({ ...good, input: null })).toBe(false);
    expect(isRefErrorBody({ ...good, candidates: 'none' })).toBe(false);
    expect(isRefErrorBody({ ...good, candidates: [null] })).toBe(false);
    expect(isRefErrorBody({ ...good, candidates: [{ ref: 'a', kind: 'b', label: 3 }] })).toBe(
      false,
    );
    expect(isRefErrorBody({ ...good, candidates: [{ ref: 'a', kind: 2, label: null }] })).toBe(
      false,
    );
    expect(isRefErrorBody({ ...good, candidates: [{ ref: 1, kind: 'b', label: null }] })).toBe(
      false,
    );
    expect(isRefErrorBody({ ...good, stale: 'no' })).toBe(false);
  });
});
