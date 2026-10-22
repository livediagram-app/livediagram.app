import { describe, expect, it } from 'vitest';
import {
  boxCentre,
  boxHoldsPoint,
  contentOrigin,
  containerContents,
  deriveContainers,
  isContainer,
  smallestHolder,
} from './containment';
import { createPinnedArrow, createShape } from './factories';
import type { Element, ShapeElement } from './index';

function box(
  kind: Parameters<typeof createShape>[0],
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  return { ...createShape(kind, x, y), id, width: w, height: h } satisfies ShapeElement;
}

function mind(id: string, parent?: string): ShapeElement {
  return { ...box('mind-node', id, 0, 0, 100, 40), ...(parent ? { mindParentId: parent } : {}) };
}

describe('boxCentre and boxHoldsPoint', () => {
  it('finds the centre and holds points on the edges', () => {
    const b = { x: 10, y: 20, width: 100, height: 40 };
    expect(boxCentre(b)).toEqual({ x: 60, y: 40 });
    expect(boxHoldsPoint(b, { x: 10, y: 20 })).toBe(true);
    expect(boxHoldsPoint(b, { x: 110, y: 60 })).toBe(true);
    expect(boxHoldsPoint(b, { x: 110.5, y: 60 })).toBe(false);
    expect(boxHoldsPoint(b, { x: 50, y: 19 })).toBe(false);
  });
});

describe('smallestHolder', () => {
  it('picks the smallest box holding the point, the earlier on a tie (E4)', () => {
    const big = { x: 0, y: 0, width: 100, height: 100 };
    const small = { x: 0, y: 0, width: 50, height: 50 };
    const twin = { x: 10, y: 10, width: 50, height: 50 };
    expect(smallestHolder({ x: 20, y: 20 }, [big, small, twin])).toBe(small);
    expect(smallestHolder({ x: 20, y: 20 }, [big, twin, small])).toBe(twin);
    expect(smallestHolder({ x: 200, y: 20 }, [big, small])).toBeNull();
  });
});

describe('deriveContainers (R11)', () => {
  it('nests an element under the smallest frame or lane holding its centre', () => {
    const outer = box('frame', 'outer', 0, 0, 1000, 1000);
    const lane = box('lane', 'lane', 0, 0, 500, 200);
    const node = box('square', 'node', 10, 10, 100, 50);
    const loose = box('square', 'loose', 2000, 0, 100, 50);
    const map = deriveContainers([outer, lane, node, loose]);
    expect(map.get('node')).toBe('lane');
    expect(map.get('lane')).toBe('outer');
    expect(map.get('outer')).toBeNull();
    expect(map.get('loose')).toBeNull();
  });

  it('never nests an element under a container no larger than it (E5)', () => {
    const frame = box('frame', 'f', 0, 0, 100, 100);
    const huge = box('square', 'huge', -100, -100, 300, 300);
    const twin = box('frame', 'twin', 0, 0, 100, 100);
    const map = deriveContainers([frame, huge, twin]);
    expect(map.get('huge')).toBeNull();
    expect(map.get('f')).toBeNull();
    expect(map.get('twin')).toBeNull();
  });

  it('ignores ordinary shapes as containers', () => {
    const square = box('square', 'sq', 0, 0, 500, 500);
    const node = box('square', 'n', 10, 10, 10, 10);
    expect(deriveContainers([square, node]).get('n')).toBeNull();
  });

  it('goes by the stored box of a rotated element (E6)', () => {
    const frame = box('frame', 'f', 0, 0, 100, 100);
    const node = { ...box('square', 'n', 40, 40, 20, 20), rotation: 45 };
    expect(deriveContainers([frame, node]).get('n')).toBe('f');
  });

  it('leaves arrows out', () => {
    const a = box('square', 'a', 0, 0, 10, 10);
    const arrow = { ...createPinnedArrow(a.id, 'e', a.id, 'w'), id: 'arr' };
    expect(deriveContainers([a, arrow]).has('arr')).toBe(false);
  });

  it('puts an element without geometry at the root (E13)', () => {
    const frame = box('frame', 'f', 0, 0, 100, 100);
    const odd = { id: 'odd', type: 'hologram' } as unknown as Element;
    const lopsided = { ...box('frame', 'g', 0, 0, 100, 100), width: Number.NaN };
    const map = deriveContainers([frame, odd, lopsided]);
    expect(map.get('odd')).toBeNull();
    expect(map.get('g')).toBeNull();
  });

  it('lets a mind map parent link win over geometry', () => {
    const frame = box('frame', 'f', -500, -500, 2000, 2000);
    const map = deriveContainers([
      frame,
      mind('root'),
      mind('child', 'root'),
      mind('leaf', 'child'),
    ]);
    expect(map.get('root')).toBe('f');
    expect(map.get('child')).toBe('root');
    expect(map.get('leaf')).toBe('child');
  });

  it('reads a dangling or non-mind parent as a root (E11)', () => {
    const square = box('square', 'sq', 0, 0, 10, 10);
    const map = deriveContainers([square, mind('a', 'gone'), mind('b', 'sq')]);
    expect(map.get('a')).toBeNull();
    expect(map.get('b')).toBeNull();
  });

  it('breaks a parent loop at its lowest array index (E11)', () => {
    const map = deriveContainers([
      mind('x', 'z'),
      mind('y', 'x'),
      mind('z', 'y'),
      mind('tail', 'z'),
    ]);
    expect(map.get('x')).toBeNull();
    expect(map.get('y')).toBe('x');
    expect(map.get('z')).toBe('y');
    expect(map.get('tail')).toBe('z');
  });

  it('breaks a self-parent and a loop reached from its tail', () => {
    const self = deriveContainers([mind('s', 's')]);
    expect(self.get('s')).toBeNull();
    const tailFirst = deriveContainers([mind('tail', 'b'), mind('a', 'b'), mind('b', 'a')]);
    expect(tailFirst.get('tail')).toBe('b');
    expect(tailFirst.get('a')).toBeNull();
    expect(tailFirst.get('b')).toBe('a');
  });
});

describe('contentOrigin', () => {
  it('is the rounded top-left of the boxed content', () => {
    const a = box('square', 'a', 40.4, 120.6, 10, 10);
    const b = box('square', 'b', 100, 20.2, 10, 10);
    const arrow = { ...createPinnedArrow(a.id, 'e', b.id, 'w'), id: 'arr' };
    expect(contentOrigin([a, b, arrow])).toEqual({ x: 40, y: 20 });
  });

  it('is 0,0 without boxed content', () => {
    expect(contentOrigin([])).toEqual({ x: 0, y: 0 });
  });
});

describe('isContainer', () => {
  it('is a frame or a lane', () => {
    expect(isContainer(box('frame', 'f', 0, 0, 10, 10))).toBe(true);
    expect(isContainer(box('lane', 'l', 0, 0, 10, 10))).toBe(true);
    expect(isContainer(box('square', 's', 0, 0, 10, 10))).toBe(false);
    expect(isContainer({ ...createPinnedArrow('a', 'e', 'b', 'w'), id: 'arr' })).toBe(false);
  });
});

describe('containerContents', () => {
  const frame = box('frame', 'frame', 100, 100, 200, 200);
  const inside = box('square', 'inside', 130, 130, 40, 40);
  const outside = box('square', 'outside', 480, 480, 40, 40);

  it('returns ids itself when no id is a container', () => {
    const ids = new Set(['inside']);
    expect(containerContents([frame, inside], ids)).toBe(ids);
  });

  it('carries what the container holds, not what lies outside', () => {
    expect([...containerContents([frame, inside, outside], new Set(['frame']))].sort()).toEqual([
      'frame',
      'inside',
    ]);
  });

  it('carries a box straddling the edge by its centre', () => {
    const centreIn = box('square', 'centre-in', 270, 130, 40, 40);
    const centreOut = box('square', 'centre-out', 290, 130, 40, 40);
    const out = containerContents([frame, centreIn, centreOut], new Set(['frame']));
    expect(out.has('centre-in')).toBe(true);
    expect(out.has('centre-out')).toBe(false);
  });

  it('carries a nested container with all it holds, never one that only overlaps', () => {
    const nested = box('frame', 'nested', 120, 120, 100, 100);
    const inNested = box('square', 'in-nested', 140, 140, 20, 20);
    const overlapping = box('frame', 'overlapping', 250, 250, 200, 200);
    const out = containerContents([frame, nested, inNested, overlapping], new Set(['frame']));
    expect([...out].sort()).toEqual(['frame', 'in-nested', 'nested']);
  });

  it('gives an element in overlapping containers to the smallest', () => {
    const big = box('frame', 'big', 0, 0, 400, 400);
    const small = box('lane', 'small', 100, 100, 150, 150);
    const el = box('square', 'el', 150, 150, 20, 20);
    // Dragging the smaller carries it; the bigger carries the smaller and so the element too.
    expect(containerContents([big, small, el], new Set(['small'])).has('el')).toBe(true);
    expect(containerContents([big, small, el], new Set(['big'])).has('el')).toBe(true);
    // Overlapping, not nested: the lane's centre (150,150) lies outside it, the element (170,170) in both.
    const lane = box('lane', 'lane', 100, 100, 100, 100);
    const sibling = box('frame', 'sibling', 155, 155, 300, 300);
    const shared = box('square', 'shared', 160, 160, 20, 20);
    expect(containerContents([sibling, lane, shared], new Set(['sibling'])).has('shared')).toBe(
      false,
    );
    expect(containerContents([sibling, lane, shared], new Set(['lane'])).has('shared')).toBe(true);
  });

  it('carries an arrow whose free ends all lie inside, not one reaching out or fully pinned', () => {
    const freeIn = {
      ...createPinnedArrow('x', 'e', 'y', 'w'),
      id: 'free-in',
      from: { kind: 'free' as const, x: 120, y: 120 },
      to: { kind: 'free' as const, x: 200, y: 200 },
    };
    const freeOut = { ...freeIn, id: 'free-out', to: { kind: 'free' as const, x: 480, y: 480 } };
    const halfPinned = {
      ...freeIn,
      id: 'half',
      to: { kind: 'pinned' as const, elementId: 'outside', anchor: 'n' as const },
    };
    const pinned = { ...createPinnedArrow('inside', 'e', 'outside', 'w'), id: 'pinned' };
    const out = containerContents(
      [frame, inside, outside, freeIn, freeOut, halfPinned, pinned],
      new Set(['frame']),
    );
    expect(out.has('free-in')).toBe(true);
    expect(out.has('half')).toBe(true);
    expect(out.has('free-out')).toBe(false);
    expect(out.has('pinned')).toBe(false);
  });

  it('carries a mind map child through its root in the container', () => {
    const map = deriveContainers;
    expect(map).toBeTypeOf('function');
    const root = { ...mind('root'), x: 130, y: 130, width: 40, height: 20 };
    const child = { ...mind('child', 'root'), x: 900, y: 900 };
    expect(containerContents([frame, root, child], new Set(['frame'])).has('child')).toBe(true);
  });
});
