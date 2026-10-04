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

  it('reads every operation of the vocabulary', () => {
    const input = [
      {
        op: 'add',
        kind: 'square',
        id: 'verify',
        fields: { label: 'Verify' },
        place: { rel: 'below', ref: 'n3', gap: 40 },
      },
      { op: 'add', kind: 'text', place: { rel: 'at', x: 0, y: -20 } },
      { op: 'move', target: 'n4', place: { rel: 'inside', ref: 'f2' }, all: true },
      { op: 'move', target: 'type:sticky', by: [10, -5] },
      { op: 'connect', from: 'n3', to: 'verify', id: 'a9', fields: { label: 'ok' }, again: true },
      { op: 'rewire', target: 'a3', to: 'verify' },
      { op: 'insert', kind: 'diamond', between: ['n3', 'n4'], fields: { label: 'Valid?' } },
      { op: 'wrap', targets: ['n3', 'type:sticky'], in: 'lane', tidy: true, makeRoom: true },
      { op: 'unwrap', target: 'f2' },
      { op: 'order', target: 'n3', to: 'front' },
      { op: 'order', target: 'n3', below: 'n4' },
      { op: 'layout', target: 'in:f2', style: 'tree', direction: 'right' },
      { op: 'test', target: 'n3', fields: { label: 'Login' } },
    ];
    expect(validateEditOperations(input)).toEqual({ operations: input });
  });

  it('takes exactly one of each choice', () => {
    expect(
      errorsOf([
        { op: 'add' },
        { op: 'add', kind: 'square', element: {} },
        { op: 'move', target: 'n1' },
        { op: 'rewire', target: 'a1', from: 'n1', to: 'n2' },
        { op: 'order', target: 'n1', to: 'front', above: 'n2' },
        { op: 'wrap', targets: ['n1'], in: 'frame', absorb: true, makeRoom: true },
        { op: 'add', element: {}, id: 'x' },
      ]).map((e) => e.details[0]),
    ).toEqual([
      'add takes exactly one of "kind", "element"',
      'add takes exactly one of "kind", "element"',
      'move takes exactly one of "place", "by"',
      'rewire takes exactly one of "from", "to"',
      'order takes exactly one of "to", "above", "below"',
      'wrap takes at most one of "absorb", "makeRoom"',
      'add with "element" takes no "id": the element carries it',
    ]);
  });

  it('checks each placement', () => {
    expect(
      errorsOf([
        { op: 'add', kind: 'square', place: 'below n3' },
        { op: 'add', kind: 'square', place: { rel: 'at', x: 1, y: 2, ref: 'n3' } },
        { op: 'add', kind: 'square', place: { rel: 'at', x: 1 } },
        { op: 'add', kind: 'square', place: { rel: 'beside', ref: 'n3' } },
        { op: 'add', kind: 'square', place: { rel: 'below', ref: 'n3', x: 1 } },
        { op: 'add', kind: 'square', place: { rel: 'below' } },
        { op: 'add', kind: 'square', place: { rel: 'below', ref: 'n3', gap: -1 } },
        { op: 'add', kind: 'square', place: { rel: 'below', ref: 'n3', gap: 2.5 } },
      ]).map((e) => e.details[0]),
    ).toEqual([
      'member "place": expected { "rel", "ref" } or { "rel": "at", "x", "y" }',
      'member "place": expected no "ref" with "at"',
      'member "place": expected "x" and "y" numbers with "at"',
      'member "place": expected "rel" one of right-of, left-of, above, below, after, inside, align, at',
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
        details: ['unknown member "keep"; rm takes target, all, keepArrows'],
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
        { op: 'add', element: 'square' },
        { op: 'move', target: 'n1', by: [1] },
        { op: 'insert', kind: 'square', between: ['n1'] },
        { op: 'wrap', targets: [], in: 'frame' },
        { op: 'wrap', targets: ['n1'], in: 'box' },
        { op: 'order', target: 'n1', to: 'middle' },
      ]).map((e) => [e.operation, e.details[0]]),
    ).toEqual([
      [1, 'member "target": expected a non-empty string'],
      [2, 'member "fields": expected an object'],
      [3, 'member "fields": expected an object'],
      [4, 'member "all": expected true or false'],
      [5, 'member "element": expected an object'],
      [6, 'member "by": expected [dx, dy] numbers'],
      [7, 'member "between": expected [a, b] selectors'],
      [8, 'member "targets": expected a non-empty array of selectors'],
      [9, 'member "in": expected frame or lane'],
      [10, 'member "to": expected front or back'],
    ]);
    expect(
      errorsOf([
        { op: 'connect', from: 'n1', to: '' },
        { op: 'layout', target: 'n1', style: 'grid' },
        { op: 'layout', target: 'n1', direction: 'up' },
      ]).map((e) => e.details[0]),
    ).toEqual([
      'member "to": expected a non-empty string',
      'member "style": expected flow, tree, mindmap',
      'member "direction": expected down or right',
    ]);
  });

  it('reports at most EDIT_MAX_ERRORS malformed operations', () => {
    const input = Array.from({ length: EDIT_MAX_ERRORS + 5 }, () => ({ op: 'nope' }));
    expect(errorsOf(input)).toHaveLength(EDIT_MAX_ERRORS);
  });
});
