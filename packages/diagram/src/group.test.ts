import { describe, expect, it } from 'vitest';
import {
  joinGroups,
  selectionMembers,
  ungroup,
  unionBoxedBounds,
  type ShapeElement,
} from './index';

// Helper: shape with optional group + size overrides. id doubles as label
// for readability inside fixtures.
const shape = (id: string, overrides: Partial<ShapeElement> = {}): ShapeElement => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 100,
  height: 80,
  ...overrides,
});

describe('selectionMembers', () => {
  it('returns just the element when it is not in a group', () => {
    const a = shape('a');
    expect(selectionMembers([a], 'a')).toEqual(['a']);
  });

  it('expands to every element sharing the group id', () => {
    const a = shape('a', { groupId: 'g1' });
    const b = shape('b', { groupId: 'g1' });
    const c = shape('c', { groupId: 'g2' });
    expect(new Set(selectionMembers([a, b, c], 'a'))).toEqual(new Set(['a', 'b']));
  });

  it('returns an empty array when the id is missing', () => {
    expect(selectionMembers([shape('a')], 'missing')).toEqual([]);
  });
});

describe('unionBoxedBounds', () => {
  it('returns null when no element ids match', () => {
    expect(unionBoxedBounds([shape('a')], new Set(['missing']))).toBeNull();
  });

  it('returns the AABB of a single matched element', () => {
    const a = shape('a', { x: 10, y: 20, width: 50, height: 30 });
    expect(unionBoxedBounds([a], new Set(['a']))).toEqual({
      x: 10,
      y: 20,
      width: 50,
      height: 30,
    });
  });

  it('returns the union AABB of multiple matched elements', () => {
    const a = shape('a', { x: 0, y: 0, width: 50, height: 50 });
    const b = shape('b', { x: 80, y: 60, width: 40, height: 30 });
    expect(unionBoxedBounds([a, b], new Set(['a', 'b']))).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 90,
    });
  });
});

describe('joinGroups', () => {
  it('returns the elements unchanged when source and target are the same id', () => {
    const list = [shape('a')];
    expect(joinGroups(list, 'a', 'a')).toBe(list);
  });

  it('returns the elements unchanged when either id is missing', () => {
    const list = [shape('a')];
    expect(joinGroups(list, 'a', 'missing')).toBe(list);
  });

  it('assigns a fresh group id when neither element was grouped', () => {
    const list = [shape('a'), shape('b')];
    const next = joinGroups(list, 'a', 'b');
    const ga = (next.find((el) => el.id === 'a') as ShapeElement).groupId;
    const gb = (next.find((el) => el.id === 'b') as ShapeElement).groupId;
    expect(ga).toBeDefined();
    expect(ga).toBe(gb);
  });

  it('preserves the source group id when the source is already grouped', () => {
    const list = [shape('a', { groupId: 'g-src' }), shape('b')];
    const next = joinGroups(list, 'a', 'b');
    const gb = (next.find((el) => el.id === 'b') as ShapeElement).groupId;
    expect(gb).toBe('g-src');
  });

  it('joins every element of the source group with every element of the target group', () => {
    const list = [
      shape('a', { groupId: 'g-src' }),
      shape('b', { groupId: 'g-src' }),
      shape('c', { groupId: 'g-dst' }),
      shape('d', { groupId: 'g-dst' }),
      shape('e'), // unrelated, untouched
    ];
    const next = joinGroups(list, 'a', 'c');
    const groupOf = (id: string) => (next.find((el) => el.id === id) as ShapeElement).groupId;
    expect(groupOf('a')).toBe(groupOf('b'));
    expect(groupOf('a')).toBe(groupOf('c'));
    expect(groupOf('a')).toBe(groupOf('d'));
    expect(groupOf('e')).toBeUndefined();
  });

  it('no-ops when both elements are already in the same group', () => {
    const list = [shape('a', { groupId: 'same' }), shape('b', { groupId: 'same' })];
    expect(joinGroups(list, 'a', 'b')).toBe(list);
  });
});

describe('ungroup', () => {
  it('strips groupId from every element in the named group', () => {
    const list = [
      shape('a', { groupId: 'g1' }),
      shape('b', { groupId: 'g1' }),
      shape('c', { groupId: 'g2' }),
    ];
    const next = ungroup(list, 'g1');
    expect((next.find((el) => el.id === 'a') as ShapeElement).groupId).toBeUndefined();
    expect((next.find((el) => el.id === 'b') as ShapeElement).groupId).toBeUndefined();
    // 'c' belongs to a different group — must stay grouped.
    expect((next.find((el) => el.id === 'c') as ShapeElement).groupId).toBe('g2');
  });

  it('leaves non-grouped elements alone', () => {
    const list = [shape('a'), shape('b', { groupId: 'g1' })];
    const next = ungroup(list, 'g1');
    const ungrouped = next.find((el) => el.id === 'b') as ShapeElement;
    expect(ungrouped.groupId).toBeUndefined();
    expect(next.find((el) => el.id === 'a')).toEqual(shape('a'));
  });
});
