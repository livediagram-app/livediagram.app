import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@livediagram/api-schema';
import { validateEditOperations } from './parse-json';
import { EDIT_MAX_ERRORS } from './vocabulary';

const errorsOf = (input: unknown[]) => {
  const outcome = validateEditOperations(input);
  if (!('errors' in outcome)) throw new Error('expected errors');
  return outcome.errors;
};

describe('validateEditOperations', () => {
  it('reads add, set and rm in their JSON form', () => {
    const input = [
      { op: 'add', element: { id: 'x', type: 'sticky', x: 0, y: 0, width: 10, height: 10 } },
      { op: 'set', target: 'n3', fields: { label: 'Sign in', note: null }, all: true },
      { op: 'rm', target: 'n7', keepArrows: true },
    ];
    expect(validateEditOperations(input)).toEqual({ operations: input });
  });

  it('reads a false flag as absent', () => {
    expect(
      validateEditOperations([{ op: 'rm', target: 'n7', all: false, keepArrows: false }]),
    ).toEqual({ operations: [{ op: 'rm', target: 'n7' }] });
  });

  it('accepts an empty list', () => {
    expect(validateEditOperations([])).toEqual({ operations: [] });
  });

  it('refuses more than CHANGESET_MAX_OPERATIONS as too_large', () => {
    const input = Array.from({ length: CHANGESET_MAX_OPERATIONS + 1 }, () => ({
      op: 'rm',
      target: 'n1',
    }));
    expect(errorsOf(input)).toEqual([expect.objectContaining({ code: 'too_large' })]);
  });

  it('names the vocabulary for a word that is not an operation', () => {
    const [error] = errorsOf([{ op: 'paint', target: 'n1' }]);
    expect(error).toMatchObject({ code: 'unknown_operation', operation: 1 });
    expect(error!.details[1]).toContain('add set rm move');
  });

  it('names what this build applies for the rest of the vocabulary', () => {
    const [error] = errorsOf([{ op: 'move', target: 'n1' }]);
    expect(error).toMatchObject({ code: 'unknown_operation', operation: 1 });
    expect(error!.details[0]).toContain('it applies add set rm');
  });

  it('refuses an operation that is not an object, or has no op', () => {
    expect(errorsOf(['set n3', null, [], { target: 'n1' }]).map((e) => e.details[0])).toEqual([
      'expected an object with an "op" member',
      'expected an object with an "op" member',
      'expected an object with an "op" member',
      'member "op": expected a string',
    ]);
  });

  it('names an unknown member and the members the operation takes', () => {
    expect(errorsOf([{ op: 'rm', target: 'n1', keep: true }])).toEqual([
      {
        code: 'parse_error',
        operation: 1,
        details: ['unknown member "keep"; rm takes target, all, keepArrows'],
      },
    ]);
  });

  it('says add with a kind arrives with the full engine', () => {
    expect(errorsOf([{ op: 'add', kind: 'square' }])[0]!.details[0]).toBe(
      'add with a kind arrives with the full engine; this build takes add with an element',
    );
  });

  it('names a member of the wrong type and the type it expects', () => {
    expect(
      errorsOf([
        { op: 'set', target: '', fields: {} },
        { op: 'set', target: 'n1', fields: [] },
        { op: 'set', target: 'n1' },
        { op: 'rm', target: 'n1', all: 'yes' },
        { op: 'add', element: 'square' },
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
