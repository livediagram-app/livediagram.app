import { describe, expect, it } from 'vitest';
import { CHANGESET_MAX_OPERATIONS } from '@livehuddle/api-schema';
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
      { op: 'rm', target: 'n7', all: true },
    ];
    expect(validateEditOperations(input)).toEqual({ operations: input });
  });

  it('reads a false flag as absent', () => {
    expect(validateEditOperations([{ op: 'rm', target: 'n7', all: false }])).toEqual({
      operations: [{ op: 'rm', target: 'n7' }],
    });
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

  // docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 3: nothing holds any more, so
  // `wrap` and `unwrap` went with the layout containers.
  it('reads wrap and unwrap as words that are not operations', () => {
    expect(
      errorsOf([
        { op: 'wrap', targets: ['n1'], in: 'boundary' },
        { op: 'unwrap', target: 'f2' },
      ]).map((e) => [e.code, e.details[0]]),
    ).toEqual([
      ['unknown_operation', '"wrap" is not an operation'],
      ['unknown_operation', '"unwrap" is not an operation'],
    ]);
  });

  // Part 4: no arrow is made or rewired any more, so `connect`, `rewire` and `insert` went with the arrows.
  it('reads connect, rewire and insert as words that are not operations', () => {
    expect(
      errorsOf([
        { op: 'connect', from: 'n3', to: 'n4' },
        { op: 'rewire', target: 'a3', to: 'n5' },
        { op: 'insert', kind: 'directory', between: ['n3', 'n4'] },
      ]).map((e) => [e.code, e.details[0]]),
    ).toEqual([
      ['unknown_operation', '"connect" is not an operation'],
      ['unknown_operation', '"rewire" is not an operation'],
      ['unknown_operation', '"insert" is not an operation'],
    ]);
  });

  it('reads every operation of the vocabulary', () => {
    const input = [
      {
        op: 'add',
        kind: 'sticky',
        id: 'verify',
        fields: { label: 'Verify' },
        place: { rel: 'below', ref: 'n3', gap: 40 },
      },
      { op: 'add', kind: 'text', place: { rel: 'at', x: 0, y: -20 } },
      { op: 'move', target: 'n4', place: { rel: 'align', ref: 'f2' }, all: true },
      { op: 'move', target: 'type:sticky', by: [10, -5] },
      { op: 'order', target: 'n3', to: 'front' },
      { op: 'order', target: 'n3', below: 'n4' },
      { op: 'layout', target: 'type:sticky' },
      { op: 'test', target: 'n3', fields: { label: 'Login' } },
    ];
    expect(validateEditOperations(input)).toEqual({ operations: input });
  });

  it('takes exactly one of each choice', () => {
    expect(
      errorsOf([
        { op: 'add' },
        { op: 'add', kind: 'sticky', element: {} },
        { op: 'move', target: 'n1' },
        { op: 'order', target: 'n1', to: 'front', above: 'n2' },
        { op: 'add', element: {}, id: 'x' },
      ]).map((e) => e.details[0]),
    ).toEqual([
      'add takes exactly one of "kind", "element" (in a line: add <kind> key=value…)',
      'add takes exactly one of "kind", "element" (in a line: add <kind> key=value…)',
      'move takes exactly one of "place", "by" (in a line: a placement such as below:n3 or right-of:n3, or by=dx,dy)',
      'order takes exactly one of "to", "above", "below" (in a line: front, back, above=<x> or below=<x>)',
      'add with "element" takes no "id": the element carries it',
    ]);
  });

  it('checks each placement', () => {
    expect(
      errorsOf([
        { op: 'add', kind: 'sticky', place: 'below n3' },
        { op: 'add', kind: 'sticky', place: { rel: 'at', x: 1, y: 2, ref: 'n3' } },
        { op: 'add', kind: 'sticky', place: { rel: 'at', x: 1 } },
        { op: 'add', kind: 'sticky', place: { rel: 'beside', ref: 'n3' } },
        { op: 'add', kind: 'sticky', place: { rel: 'below', ref: 'n3', x: 1 } },
        { op: 'add', kind: 'sticky', place: { rel: 'below' } },
        { op: 'add', kind: 'sticky', place: { rel: 'below', ref: 'n3', gap: -1 } },
        { op: 'add', kind: 'sticky', place: { rel: 'below', ref: 'n3', gap: 2.5 } },
      ]).map((e) => e.details[0]),
    ).toEqual([
      'member "place": expected { "rel", "ref" } or { "rel": "at", "x", "y" }',
      'member "place": expected no "ref" with "at"',
      'member "place": expected "x" and "y" numbers with "at"',
      'member "place": expected "rel" one of right-of, left-of, above, below, align, at',
      'member "place": expected no "x" with "below"',
      'member "place": expected "ref" a non-empty selector',
      'member "place": expected "gap" a whole number from 0 to 2000',
      'member "place": expected "gap" a whole number from 0 to 2000',
    ]);
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
        details: ['unknown member "keep"; rm takes target, all'],
      },
    ]);
  });

  it('names a member of the wrong type and the type it expects', () => {
    expect(
      errorsOf([
        { op: 'set', target: '', fields: {} },
        { op: 'set', target: 'n1', fields: [] },
        { op: 'set', target: 'n1' },
        { op: 'rm', target: 'n1', all: 'yes' },
        { op: 'add', element: 'sticky' },
        { op: 'move', target: 'n1', by: [1] },
        { op: 'order', target: 'n1', to: 'middle' },
      ]).map((e) => [e.operation, e.details[0]]),
    ).toEqual([
      [1, 'member "target": expected a non-empty string'],
      [2, 'member "fields": expected an object'],
      [3, 'member "fields": expected an object'],
      [4, 'member "all": expected true or false'],
      [5, 'member "element": expected an object'],
      [6, 'member "by": expected [dx, dy] numbers'],
      [7, 'member "to": expected front or back'],
    ]);
    expect(
      errorsOf([
        { op: 'order', target: 'n1', above: '' },
        { op: 'layout', target: 'n1', style: 'flow' },
        { op: 'layout', target: 'n1', direction: 'down' },
      ]).map((e) => e.details[0]),
    ).toEqual([
      'member "above": expected a non-empty string',
      // The layered layout went with the arrows (part 4): `layout` sweeps rows and takes no style or direction.
      'unknown member "style"; layout takes target',
      'unknown member "direction"; layout takes target',
    ]);
  });

  it('reports at most EDIT_MAX_ERRORS malformed operations', () => {
    const input = Array.from({ length: EDIT_MAX_ERRORS + 5 }, () => ({ op: 'nope' }));
    expect(errorsOf(input)).toHaveLength(EDIT_MAX_ERRORS);
  });
});
