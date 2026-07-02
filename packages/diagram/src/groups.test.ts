import { describe, expect, it } from 'vitest';
import {
  boundsAnchorPoint,
  bringManyToFront,
  bringToFront,
  freezeDanglingGroupEnds,
  groupUnionBounds,
  joinGroups,
  selectionMembers,
  sendManyToBack,
  sendToBack,
  ungroup,
  unionBoxedBounds,
  unionElementBounds,
  type Element,
  type ShapeElement,
} from './index';

const box = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  ...overrides,
});

const arrow = (id: string): Element => ({
  id,
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 10, y: 10 },
});

const ids = (els: Element[]) => els.map((e) => e.id);
const groupOf = (els: Element[], id: string) =>
  (els.find((e) => e.id === id) as ShapeElement | undefined)?.groupId;

describe('layer order', () => {
  it('bringToFront moves the element to the end, keeping the rest in order', () => {
    expect(ids(bringToFront([box('a'), box('b'), box('c')], 'a'))).toEqual(['b', 'c', 'a']);
  });

  it('sendToBack moves the element to the start, keeping the rest in order', () => {
    expect(ids(sendToBack([box('a'), box('b'), box('c')], 'c'))).toEqual(['c', 'a', 'b']);
  });

  it('both leave the array unchanged for a missing id', () => {
    const els = [box('a'), box('b')];
    expect(ids(bringToFront(els, 'x'))).toEqual(['a', 'b']);
    expect(ids(sendToBack(els, 'x'))).toEqual(['a', 'b']);
  });

  it('bringManyToFront moves the set to the end, preserving their relative order', () => {
    const out = bringManyToFront([box('a'), box('b'), box('c'), box('d')], new Set(['a', 'c']));
    expect(ids(out)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('sendManyToBack moves the set to the start, preserving their relative order', () => {
    const out = sendManyToBack([box('a'), box('b'), box('c'), box('d')], new Set(['b', 'd']));
    expect(ids(out)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('selectionMembers', () => {
  it('returns every boxed member of the group when a grouped element is picked', () => {
    const els = [box('a', { groupId: 'g1' }), box('b', { groupId: 'g1' }), box('c')];
    expect(selectionMembers(els, 'a').sort()).toEqual(['a', 'b']);
  });

  it('returns just the element when it is ungrouped', () => {
    expect(selectionMembers([box('a'), box('b')], 'a')).toEqual(['a']);
  });

  it('returns just the element for a non-boxed (arrow) target', () => {
    expect(selectionMembers([arrow('ar'), box('b')], 'ar')).toEqual(['ar']);
  });

  it('returns empty for a missing id', () => {
    expect(selectionMembers([box('a')], 'x')).toEqual([]);
  });
});

describe('unionBoxedBounds', () => {
  it('computes the union bounding box across the selected boxed elements', () => {
    const els = [
      box('a', { x: 0, y: 0, width: 50, height: 50 }),
      box('b', { x: 100, y: 80, width: 40, height: 20 }),
    ];
    expect(unionBoxedBounds(els, new Set(['a', 'b']))).toEqual({
      x: 0,
      y: 0,
      width: 140,
      height: 100,
    });
  });

  it('ignores non-boxed elements and ids outside the set', () => {
    const els = [
      box('a', { x: 0, y: 0, width: 50, height: 50 }),
      arrow('ar'),
      box('b', { x: 200, y: 200, width: 10, height: 10 }),
    ];
    expect(unionBoxedBounds(els, new Set(['a', 'ar']))).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  it('returns null when the set contains no boxed elements', () => {
    expect(unionBoxedBounds([arrow('ar')], new Set(['ar']))).toBeNull();
    expect(unionBoxedBounds([box('a')], new Set(['x']))).toBeNull();
  });
});

describe('unionElementBounds', () => {
  it('spans arrows too (unlike unionBoxedBounds)', () => {
    // arrow('ar') runs (0,0)->(10,10); box 'b' sits at (100,80) 40x20.
    const els = [box('b', { x: 100, y: 80, width: 40, height: 20 }), arrow('ar')];
    expect(unionElementBounds(els, new Set(['ar', 'b']))).toEqual({
      x: 0,
      y: 0,
      width: 140,
      height: 100,
    });
  });

  it('covers an arrow-only selection where unionBoxedBounds is null', () => {
    const els = [arrow('ar')];
    expect(unionBoxedBounds(els, new Set(['ar']))).toBeNull();
    expect(unionElementBounds(els, new Set(['ar']))).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
  });

  it('returns null when no listed id matches', () => {
    expect(unionElementBounds([box('a')], new Set(['x']))).toBeNull();
  });
});

describe('joinGroups', () => {
  it('puts two ungrouped elements into one fresh shared group, leaving others alone', () => {
    const out = joinGroups([box('a'), box('b'), box('c')], 'a', 'b');
    expect(groupOf(out, 'a')).toBeTruthy();
    expect(groupOf(out, 'a')).toBe(groupOf(out, 'b'));
    expect(groupOf(out, 'c')).toBeUndefined();
  });

  it("reuses the source's existing group id when extending it (no id churn)", () => {
    const els = [box('a', { groupId: 'g1' }), box('b', { groupId: 'g1' }), box('c')];
    const out = joinGroups(els, 'a', 'c');
    for (const id of ['a', 'b', 'c']) expect(groupOf(out, id)).toBe('g1');
  });

  it('merges two distinct existing groups into the source group id', () => {
    const els = [
      box('a', { groupId: 'g1' }),
      box('b', { groupId: 'g1' }),
      box('c', { groupId: 'g2' }),
      box('d', { groupId: 'g2' }),
    ];
    const out = joinGroups(els, 'a', 'c');
    for (const id of ['a', 'b', 'c', 'd']) expect(groupOf(out, id)).toBe('g1');
  });

  it('returns the same array reference (no-op) when both are already in one group', () => {
    const els = [box('a', { groupId: 'g' }), box('b', { groupId: 'g' })];
    expect(joinGroups(els, 'a', 'b')).toBe(els);
  });

  it('no-ops (same reference) for same id, a missing id, or a non-boxed target', () => {
    const els = [box('a'), arrow('ar')];
    expect(joinGroups(els, 'a', 'a')).toBe(els);
    expect(joinGroups(els, 'a', 'x')).toBe(els);
    expect(joinGroups(els, 'a', 'ar')).toBe(els);
  });
});

describe('ungroup', () => {
  it('strips the groupId from members of the named group only', () => {
    const els = [
      box('a', { groupId: 'g1' }),
      box('b', { groupId: 'g1' }),
      box('c', { groupId: 'g2' }),
    ];
    const out = ungroup(els, 'g1');
    expect(groupOf(out, 'a')).toBeUndefined();
    expect(groupOf(out, 'b')).toBeUndefined();
    expect(groupOf(out, 'c')).toBe('g2');
  });
});

describe('pinned-group arrow endpoints (spec/09 group quick-connect)', () => {
  const groupArrow = (id: string, groupId: string): Element => ({
    id,
    type: 'arrow',
    from: { kind: 'pinned-group', groupId, anchor: 's' },
    to: { kind: 'free', x: 300, y: 300 },
  });
  const members = [box('a', { groupId: 'g' }), box('b', { x: 200, groupId: 'g' })];

  it('groupUnionBounds spans the members, null once the group is empty', () => {
    expect(groupUnionBounds(members, 'g')).toEqual({ x: 0, y: 0, width: 300, height: 100 });
    expect(groupUnionBounds([box('loose')], 'g')).toBeNull();
  });

  it('boundsAnchorPoint resolves side midpoints and corners', () => {
    const b = { x: 0, y: 0, width: 300, height: 100 };
    expect(boundsAnchorPoint(b, 's')).toEqual({ x: 150, y: 100 });
    expect(boundsAnchorPoint(b, 'e')).toEqual({ x: 300, y: 50 });
    expect(boundsAnchorPoint(b, 'nw')).toEqual({ x: 0, y: 0 });
  });

  it('ungroup freezes group-pinned ends at their last position', () => {
    const els = [...members, groupArrow('ar', 'g')];
    const out = ungroup(els, 'g');
    const ar = out.find((e) => e.id === 'ar');
    expect(ar && ar.type === 'arrow' ? ar.from : null).toEqual({ kind: 'free', x: 150, y: 100 });
    // Membership cleared too.
    expect(groupOf(out, 'a')).toBeUndefined();
  });

  it('joinGroups re-points group-pinned ends at the surviving group id', () => {
    const els = [
      box('a', { groupId: 'g1' }),
      box('b', { x: 200, groupId: 'g1' }),
      box('c', { x: 400, groupId: 'g2' }),
      box('d', { x: 600, groupId: 'g2' }),
      groupArrow('ar', 'g2'),
    ];
    const out = joinGroups(els, 'a', 'c');
    const merged = groupOf(out, 'a');
    expect(merged).toBe('g1'); // source id wins
    expect(groupOf(out, 'c')).toBe('g1');
    const ar = out.find((e) => e.id === 'ar');
    expect(
      ar && ar.type === 'arrow' && ar.from.kind === 'pinned-group' ? ar.from.groupId : null,
    ).toBe('g1');
  });

  it('freezeDanglingGroupEnds converts ends whose group lost its last member', () => {
    const before = [...members, groupArrow('ar', 'g')];
    const after = [groupArrow('ar', 'g')]; // both members deleted
    const out = freezeDanglingGroupEnds(before, after);
    const ar = out.find((e) => e.id === 'ar');
    expect(ar && ar.type === 'arrow' ? ar.from : null).toEqual({ kind: 'free', x: 150, y: 100 });
    // A group that still has members is left pinned.
    const partial = freezeDanglingGroupEnds(before, [members[0]!, groupArrow('ar', 'g')]);
    const still = partial.find((e) => e.id === 'ar');
    expect(still && still.type === 'arrow' ? still.from.kind : null).toBe('pinned-group');
  });
});
