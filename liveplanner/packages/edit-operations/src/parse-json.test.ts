import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@liveplanner/api-schema';
import { validateEditOperations } from './parse-json';
import { EDIT_MAX_ERRORS } from './vocabulary';

const errorsOf = (input: unknown[]) => {
  const outcome = validateEditOperations(input);
  if (!('errors' in outcome)) throw new Error('expected errors');
  return outcome.errors;
};

describe('validateEditOperations', () => {
  it('reads every operation of the vocabulary in its JSON form', () => {
    const input = [
      { op: 'add', element: { id: 'g1', type: 'shape', shape: 'plan-view' } },
      { op: 'set', target: 'w1', fields: { label: 'Load', textSize: null }, all: true },
      { op: 'rm', target: 'm3', all: true },
      { op: 'test', target: 'w1', fields: { label: 'Load' } },
    ];
    expect(validateEditOperations(input)).toEqual({ operations: input });
  });

  it('reads a false flag as absent', () => {
    expect(validateEditOperations([{ op: 'rm', target: 'm3', all: false }])).toEqual({
      operations: [{ op: 'rm', target: 'm3' }],
    });
  });

  it('accepts an empty list', () => {
    expect(validateEditOperations([])).toEqual({ operations: [] });
  });

  it('refuses more than CHANGESET_MAX_OPERATIONS as too_large', () => {
    const input = Array.from({ length: CHANGESET_MAX_OPERATIONS + 1 }, () => ({
      op: 'rm',
      target: 'm1',
    }));
    expect(errorsOf(input)).toEqual([expect.objectContaining({ code: 'too_large' })]);
  });

  it('names the vocabulary for a word that is not an operation, the diagram ones included', () => {
    for (const op of ['paint', 'connect', 'move', 'wrap', 'layout']) {
      const [error] = errorsOf([{ op, target: 'm1' }]);
      expect(error).toMatchObject({ code: 'unknown_operation', operation: 1 });
      expect(error!.details[1]).toBe('operations: add set rm test');
    }
  });

  it('refuses an operation that is not an object, or has no op', () => {
    expect(errorsOf(['set w1', null, [], { target: 'm1' }]).map((e) => e.details[0])).toEqual([
      'expected an object with an "op" member',
      'expected an object with an "op" member',
      'expected an object with an "op" member',
      'member "op": expected a string',
    ]);
  });

  it('names an unknown member and the members the operation takes', () => {
    expect(errorsOf([{ op: 'rm', target: 'm1', keepArrows: true }])).toEqual([
      {
        code: 'parse_error',
        operation: 1,
        details: ['unknown member "keepArrows"; rm takes target, all'],
      },
    ]);
    expect(errorsOf([{ op: 'add', kind: 'square' }])[0]!.details).toEqual([
      'unknown member "kind"; add takes element',
    ]);
  });

  it('names a member of the wrong type and the type it expects', () => {
    expect(
      errorsOf([
        { op: 'set', target: '', fields: {} },
        { op: 'set', target: 'm1', fields: [] },
        { op: 'set', target: 'm1' },
        { op: 'rm', target: 'm1', all: 'yes' },
        { op: 'add', element: 'plan-view' },
        { op: 'add' },
      ]).map((e) => [e.operation, e.details[0]]),
    ).toEqual([
      [1, 'member "target": expected a non-empty string'],
      [2, 'member "fields": expected an object'],
      [3, 'member "fields": expected an object'],
      [4, 'member "all": expected true or false'],
      [5, 'member "element": expected an object'],
      [6, 'member "element": expected an object'],
    ]);
  });

  it('reports at most EDIT_MAX_ERRORS malformed operations', () => {
    const input = Array.from({ length: EDIT_MAX_ERRORS + 5 }, () => ({ op: 'nope' }));
    expect(errorsOf(input)).toHaveLength(EDIT_MAX_ERRORS);
  });
});
