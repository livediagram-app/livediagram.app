import { describe, expect, it } from 'vitest';
import {
  baseOf,
  describeSuggestion,
  ghostsOf,
  liveOnlyChange,
  opsMismatch,
  restoreOp,
  planAccept,
  staleTargets,
  suggestionOpsBetween,
} from './plan';
import { el, model, suggestion, type El } from './test/fixtures';

const fp = model.fingerprint;

describe('baseOf and staleTargets', () => {
  const canvas = [el('a'), el('b')];
  const ops = [
    { kind: 'update' as const, element: el('a', 9) },
    { kind: 'remove' as const, id: 'b' },
    { kind: 'add' as const, element: el('c'), at: 2 },
  ];
  it('records each target as found', () => {
    expect(baseOf(canvas, ops, fp)).toEqual({ a: fp(el('a')), b: fp(el('b')), c: null });
  });
  it('finds nothing stale on the canvas it was made on', () => {
    expect(staleTargets(canvas, { ops, base: baseOf(canvas, ops, fp) }, fp)).toEqual([]);
  });
  it('flags a changed target, a gone one and an add whose id is now taken', () => {
    const base = baseOf(canvas, ops, fp);
    expect(staleTargets([el('a', 1), el('c')], { ops, base }, fp)).toEqual(['a', 'b', 'c']);
  });
  it('reads a missing base as changed', () => {
    expect(staleTargets(canvas, { ops: [ops[0]!], base: {} }, fp)).toEqual(['a']);
  });
});

describe('opsMismatch', () => {
  it('names a missing target or a taken id', () => {
    expect(opsMismatch([el('a')], [{ kind: 'update', element: el('z') }])).toBe('missing_target');
    expect(opsMismatch([el('a')], [{ kind: 'remove', id: 'z' }])).toBe('missing_target');
    expect(opsMismatch([el('a')], [{ kind: 'add', element: el('a'), at: 0 }])).toBe('id_taken');
    expect(opsMismatch([el('a')], [{ kind: 'add', element: el('b'), at: 0 }])).toBeNull();
  });
});

describe('planAccept', () => {
  const canvas = [el('a'), el('b')];
  const move = suggestion('sg_bbbbbbbbbb', [{ kind: 'update', element: el('a', 5) }], {
    a: fp(el('a')),
  });
  const moveAgain = suggestion(
    'sg_aaaaaaaaaa',
    [{ kind: 'update', element: el('a', 7) }],
    { a: fp(el('a')) },
    { createdAt: 1 },
  );
  const add = suggestion(
    'sg_cccccccccc',
    [{ kind: 'add', element: el('c'), at: 1 }],
    { c: null },
    {
      createdAt: 0,
    },
  );
  it('applies in the order made and flags one an earlier one made stale', () => {
    const plan = planAccept(canvas, [move, moveAgain, add], model);
    // add (t0), then the two at t1 by id: moveAgain (sg_a…) lands, move (sg_b…) is stale.
    expect(plan.accepted).toEqual(['sg_cccccccccc', 'sg_aaaaaaaaaa']);
    expect(plan.conflicts).toEqual([{ id: 'sg_bbbbbbbbbb', elements: ['a'] }]);
    expect(plan.elements).toEqual([el('a', 7), el('c'), el('b')]);
  });
  it('sorts ties by id either way', () => {
    const plan = planAccept(canvas, [moveAgain, move], model);
    expect(plan.accepted).toEqual(['sg_aaaaaaaaaa']);
    const same = planAccept(canvas, [move, { ...move }], model);
    expect(same.accepted).toEqual(['sg_bbbbbbbbbb']);
  });
});

describe('ghostsOf', () => {
  it('draws adds, changes and removals in the author colour, skipping gone targets', () => {
    const s = suggestion(
      'sg_aaaaaaaaaa',
      [
        { kind: 'add', element: el('n'), at: 0 },
        { kind: 'update', element: el('a', 3) },
        { kind: 'remove', id: 'b' },
        { kind: 'update', element: el('gone') },
      ],
      {},
      { conflict: ['a'] },
    );
    const plain = suggestion('sg_bbbbbbbbbb', [{ kind: 'remove', id: 'a' }], {});
    const ghosts = ghostsOf([el('a'), el('b')], [s, plain]);
    expect(
      ghosts.map((g) => [g.kind, g.id, g.before?.x ?? null, g.after?.x ?? null, g.conflict]),
    ).toEqual([
      ['add', 'n', null, 0, true],
      ['update', 'a', 0, 3, true],
      ['remove', 'b', 0, null, true],
      ['remove', 'a', 0, null, false],
    ]);
    expect(ghosts[0]!.color).toBe('#ff0000');
  });
});

describe('describeSuggestion', () => {
  it('says what a suggestion does, never its words', () => {
    const add = { kind: 'add' as const, element: el('a'), at: 0 };
    const upd = { kind: 'update' as const, element: el('b') };
    const rem = { kind: 'remove' as const, id: 'c' };
    expect(describeSuggestion([add])).toBe('Add 1 element');
    expect(describeSuggestion([upd, upd])).toBe('Change 2 elements');
    expect(describeSuggestion([rem])).toBe('Remove 1 element');
    expect(describeSuggestion([add, upd, rem])).toBe('Add 1, change 1, remove 1');
    expect(describeSuggestion([])).toBe('No change');
  });
});

describe('liveOnlyChange and restoreOp', () => {
  const fpNoText = (e: El) => JSON.stringify({ ...e, text: undefined });
  it('tells a live-field change from a real one', () => {
    const before = [el('a'), el('b')];
    expect(liveOnlyChange(before, before, fp)).toBe(true);
    expect(liveOnlyChange(before, [el('a', 0, { text: 'c' }), before[1]!], fpNoText)).toBe(true);
    expect(liveOnlyChange(before, [el('a', 1), before[1]!], fpNoText)).toBe(false);
    expect(liveOnlyChange(before, [el('a'), el('c')], fp)).toBe(false);
    expect(liveOnlyChange(before, [el('a')], fp)).toBe(false);
  });
  it('puts an element back as it was', () => {
    const before = [el('a'), el('b')];
    expect(restoreOp(before, [el('a', 3), el('b')], 'a')).toEqual({
      kind: 'update',
      element: el('a'),
    });
    expect(restoreOp(before, [el('a')], 'b')).toEqual({ kind: 'add', element: el('b'), at: 1 });
    expect(restoreOp(before, [...before, el('n')], 'n')).toEqual({ kind: 'remove', id: 'n' });
  });
});

describe('suggestionOpsBetween', () => {
  it('finds removals, then adds and changes in order', () => {
    const before: El[] = [el('a'), el('b'), el('c')];
    const same = before[2]!;
    const after: El[] = [el('n'), el('a', 1), same, { ...el('b') }];
    expect(suggestionOpsBetween(before, after)).toEqual([
      { kind: 'add', element: el('n'), at: 0 },
      { kind: 'update', element: el('a', 1) },
    ]);
    expect(suggestionOpsBetween(before, [before[0]!])).toEqual([
      { kind: 'remove', id: 'b' },
      { kind: 'remove', id: 'c' },
    ]);
  });
});
