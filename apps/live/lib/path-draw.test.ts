import { describe, expect, it } from 'vitest';
import { createPath, type PathAnchor, type PathElement } from '@livediagram/document';
import {
  PATH_CLOSE_PX,
  PATH_DOUBLE_PRESS_MS,
  classifyPathPress,
  continueDraft,
  cuspLast,
  openPathEnds,
  placeNode,
  removeLastPlaced,
  rubberBand,
  shapeHandles,
  type PathDraft,
} from './path-draw';

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });
const draftOf = (anchors: PathAnchor[], lastPlacedAt = 0, placed = anchors.length): PathDraft => ({
  anchors,
  placed,
  continuing: null,
  lastPlacedAt,
});
const opts = (over: Partial<Parameters<typeof classifyPathPress>[2]> = {}) => ({
  zoom: 1,
  now: 10_000,
  ends: [],
  ...over,
});

describe('classifyPathPress', () => {
  it('places a node on empty canvas', () => {
    expect(classifyPathPress(null, { x: 5, y: 5 }, opts())).toEqual({ kind: 'place' });
  });

  it('finishes on a second press on the node just placed (a double-click)', () => {
    const draft = draftOf([corner(0, 0), corner(100, 0)], 10_000 - 200);
    expect(classifyPathPress(draft, { x: 101, y: 1 }, opts())).toEqual({ kind: 'finish' });
  });

  it('turns the last node into a cusp when pressed again later', () => {
    const draft = draftOf([corner(0, 0), corner(100, 0)], 10_000 - PATH_DOUBLE_PRESS_MS - 1);
    expect(classifyPathPress(draft, { x: 100, y: 2 }, opts())).toEqual({ kind: 'cusp' });
  });

  it('closes on the first node once there are two, within the screen radius', () => {
    const draft = draftOf([corner(0, 0), corner(100, 0)]);
    expect(classifyPathPress(draft, { x: 3, y: 3 }, opts())).toEqual({ kind: 'close' });
    // At 200% the same canvas distance is twice as far on screen.
    const far = PATH_CLOSE_PX * 0.75;
    expect(classifyPathPress(draft, { x: far, y: 0 }, opts({ zoom: 2 }))).toEqual({
      kind: 'place',
    });
    expect(classifyPathPress(draftOf([corner(0, 0)]), { x: 1, y: 0 }, opts())).toEqual({
      kind: 'cusp',
    });
  });

  it('continues an open path from an end node when nothing is being drawn', () => {
    const end = { id: 'p', end: 'start' as const, point: { x: 50, y: 50 } };
    expect(classifyPathPress(null, { x: 52, y: 49 }, opts({ ends: [end] }))).toEqual({
      kind: 'continue',
      end,
    });
    // Mid-draft the ends are no longer offered.
    expect(
      classifyPathPress(draftOf([corner(0, 0)]), { x: 52, y: 49 }, opts({ ends: [end] })),
    ).toEqual({ kind: 'place' });
  });
});

describe('placeNode', () => {
  it('starts a draft and appends corner nodes', () => {
    const one = placeNode(null, { x: 0, y: 0 }, 5, false);
    expect(one).toEqual({ anchors: [corner(0, 0)], placed: 1, continuing: null, lastPlacedAt: 5 });
    const two = placeNode(one, { x: 10, y: 1 }, 9, false);
    expect(two.anchors).toEqual([corner(0, 0), corner(10, 1)]);
    expect(two.placed).toBe(2);
  });

  it('constrains the new segment to 45° with Shift', () => {
    const two = placeNode(draftOf([corner(0, 0)]), { x: 10, y: 1 }, 9, true);
    expect(two.anchors[1]!.y).toBeCloseTo(0);
    expect(two.anchors[1]!.x).toBeCloseTo(Math.hypot(10, 1));
  });
});

describe('shapeHandles', () => {
  const node = corner(10, 10);

  it('pulls out a mirrored pair', () => {
    expect(shapeHandles(node, { x: 20, y: 10 }, { alt: false, shift: false })).toEqual({
      ...node,
      mode: 'mirrored',
      handleOut: { x: 20, y: 10 },
      handleIn: { x: 0, y: 10 },
    });
  });

  it('breaks the mirror with Alt: the incoming handle stays', () => {
    const smooth = shapeHandles(node, { x: 20, y: 10 }, { alt: false, shift: false });
    const broken = shapeHandles(smooth, { x: 10, y: 30 }, { alt: true, shift: false });
    expect(broken.mode).toBe('corner');
    expect(broken.handleIn).toEqual({ x: 0, y: 10 });
    expect(broken.handleOut).toEqual({ x: 10, y: 30 });
  });

  it('constrains the handle to 45° with Shift', () => {
    const h = shapeHandles(node, { x: 20, y: 11 }, { alt: false, shift: true });
    expect(h.handleOut!.y).toBeCloseTo(10);
  });
});

describe('cuspLast and removeLastPlaced', () => {
  it('drops the last node’s outgoing handle', () => {
    const smooth = shapeHandles(corner(10, 0), { x: 20, y: 0 }, { alt: false, shift: false });
    const draft = cuspLast(draftOf([corner(0, 0), smooth]));
    expect(draft.anchors[1]!.handleOut).toBeUndefined();
    expect(draft.anchors[1]!.handleIn).toEqual({ x: 0, y: 0 });
  });

  it('removes only nodes this draft placed, and cancels with none left', () => {
    const d = removeLastPlaced(draftOf([corner(0, 0), corner(5, 5)]))!;
    expect(d.anchors).toHaveLength(1);
    expect(removeLastPlaced(d)).toBeNull();
    const continued = { ...draftOf([corner(0, 0), corner(5, 5)], 0, 0), continuing: { id: 'p' } };
    expect(removeLastPlaced(continued)).toBeNull();
  });
});

describe('rubberBand', () => {
  it('runs from the last node to the pointer, curved by its outgoing handle', () => {
    const smooth = shapeHandles(corner(10, 0), { x: 20, y: -10 }, { alt: false, shift: false });
    expect(rubberBand(draftOf([corner(0, 0), smooth]), { x: 50, y: 0 }, false)).toEqual({
      p0: { x: 10, y: 0 },
      c1: { x: 20, y: -10 },
      c2: { x: 50, y: 0 },
      p3: { x: 50, y: 0 },
    });
    expect(rubberBand(null, { x: 1, y: 1 }, false)).toBeNull();
  });
});

describe('open path ends and continuing', () => {
  const open = createPath(
    [corner(0, 0), { x: 50, y: 0, mode: 'corner', handleIn: { x: 40, y: -10 } }, corner(100, 0)],
    false,
  );
  const closed: PathElement = { ...open, id: 'c', closed: true };

  it('offers the two ends of every open, unlocked, reachable path', () => {
    const ends = openPathEnds([open, closed, { ...open, id: 'l', locked: true }], new Set());
    expect(ends.map((e) => [e.id, e.end])).toEqual([
      [open.id, 'start'],
      [open.id, 'end'],
    ]);
    expect(ends[1]!.point.x).toBeCloseTo(100);
    expect(openPathEnds([open], new Set([open.id]))).toEqual([]);
  });

  it('resumes from the end pressed, so new nodes always append', () => {
    const fromEnd = continueDraft(open, 'end');
    expect(fromEnd.anchors[2]!.x).toBeCloseTo(100);
    expect(fromEnd).toMatchObject({ placed: 0, continuing: { id: open.id } });
    const fromStart = continueDraft(open, 'start');
    expect(fromStart.anchors[2]!.x).toBeCloseTo(0);
    // Reversed: the middle node's incoming handle now leaves it.
    expect(fromStart.anchors[1]!.handleOut!.x).toBeCloseTo(40);
  });
});

describe('pressing placed nodes while drawing (docs/specs/023-whiteboard/path-tool.md "Editing while drawing")', () => {
  const draft = draftOf([corner(0, 0), corner(100, 0), corner(100, 100)], 0);

  it('takes a placed node that is neither the first nor the last', () => {
    expect(classifyPathPress(draft, { x: 101, y: 2 }, opts())).toEqual({ kind: 'node', index: 1 });
  });

  it('takes the last node to move or cusp, unless it is a double-click', () => {
    expect(classifyPathPress(draft, { x: 100, y: 99 }, opts())).toEqual({ kind: 'cusp' });
  });

  it('reaches 16 screen px for a finger', () => {
    expect(classifyPathPress(draft, { x: 12, y: 0 }, opts())).toEqual({ kind: 'place' });
    expect(classifyPathPress(draft, { x: 12, y: 0 }, opts({ radiusPx: 16 }))).toEqual({
      kind: 'close',
    });
  });
});
