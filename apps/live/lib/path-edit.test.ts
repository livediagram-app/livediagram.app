import { describe, expect, it } from 'vitest';
import {
  createPath,
  createShape,
  cubicAt,
  pathSegments,
  type PathAnchor,
} from '@livediagram/document';
import {
  PATH_NODE_HIT_PX,
  bendAt,
  canJoin,
  deleteNodes,
  dragNodes,
  insertNodeAt,
  isPathEditing,
  moveHandle,
  moveNodes,
  nodesInBox,
  openPathAt,
  setNodeType,
  sharedNodeType,
  pathEditCursor,
  pathEditHit,
  snapNodeDelta,
  toLocal,
  toWorld,
  toggleSmooth,
  visibleHandles,
} from './path-edit';

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });
const smooth = (x: number, y: number, dx: number, dy = 0): PathAnchor => ({
  x,
  y,
  mode: 'mirrored',
  handleIn: { x: x - dx, y: y - dy },
  handleOut: { x: x + dx, y: y + dy },
});

const path = createPath([corner(0, 0), corner(50, 0)], false);

describe('isPathEditing', () => {
  it('is open only while a path is the element being edited', () => {
    const square = createShape('square', 0, 0);
    expect(isPathEditing([path, square], path.id)).toBe(true);
    expect(isPathEditing([path, square], square.id)).toBe(false);
    expect(isPathEditing([path], null)).toBe(false);
    expect(isPathEditing([], path.id)).toBe(false);
  });
});

describe('visibleHandles', () => {
  it('shows a selected node’s handles and its neighbours’ facing ones', () => {
    const anchors = [smooth(0, 0, 10), smooth(100, 0, 10), smooth(200, 0, 10), smooth(300, 0, 10)];
    expect(visibleHandles(anchors, false, new Set([1]))).toEqual([
      { node: 1, side: 'in' },
      { node: 1, side: 'out' },
      { node: 0, side: 'out' },
      { node: 2, side: 'in' },
    ]);
    // Closed: the first node's previous neighbour is the last.
    expect(visibleHandles(anchors, true, new Set([0]))).toContainEqual({ node: 3, side: 'out' });
    expect(visibleHandles(anchors, false, new Set())).toEqual([]);
  });
});

describe('pathEditHit', () => {
  const anchors = [corner(0, 0), smooth(100, 0, 30), corner(200, 0)];
  const hit = (x: number, y: number, selected = new Set<number>(), zoom = 1) =>
    pathEditHit(anchors, false, selected, { x, y }, zoom, 2);

  it('finds a node within 12 screen px (a 24 px target)', () => {
    expect(hit(PATH_NODE_HIT_PX - 1, 0)).toEqual({ kind: 'node', node: 0 });
    expect(hit(6, 0, new Set(), 2)).toEqual({ kind: 'node', node: 0 });
  });

  it('puts a visible handle before its node', () => {
    expect(hit(130, 0, new Set([1]))).toEqual({ kind: 'handle', node: 1, side: 'out' });
    // Hidden handles are not there to hit: it is the segment there.
    expect(hit(130, 0).kind).toBe('segment');
  });

  it('finds a segment near the line, and empty space beyond', () => {
    const seg = hit(50, 5);
    expect(seg).toMatchObject({ kind: 'segment', segment: 0 });
    expect(hit(50, 40)).toEqual({ kind: 'empty' });
  });
});

describe('moveNodes and moveHandle', () => {
  it('moves the selected nodes with their handles', () => {
    const out = moveNodes([corner(0, 0), smooth(100, 0, 10)], new Set([1]), 5, -5);
    expect(out[0]).toEqual(corner(0, 0));
    expect(out[1]).toEqual({
      x: 105,
      y: -5,
      mode: 'mirrored',
      handleIn: { x: 95, y: -5 },
      handleOut: { x: 115, y: -5 },
    });
  });

  it('drags a handle with its partner by mode, and breaks the pair with Alt', () => {
    const mirrored = moveHandle([smooth(0, 0, 10)], 0, 'out', { x: 0, y: 20 }, {});
    expect(mirrored[0]!.handleIn).toEqual({ x: 0, y: -20 });
    const aligned = moveHandle(
      [{ ...smooth(0, 0, 10), mode: 'aligned' }],
      0,
      'out',
      { x: 0, y: 20 },
      {},
    );
    expect(aligned[0]!.handleIn!.y).toBeCloseTo(-10);
    const broken = moveHandle([smooth(0, 0, 10)], 0, 'out', { x: 0, y: 20 }, { alt: true });
    expect(broken[0]).toMatchObject({ mode: 'corner', handleIn: { x: -10, y: 0 } });
  });
});

describe('toggleSmooth', () => {
  it('turns a corner smooth and a smooth node back into a corner', () => {
    const anchors = [corner(0, 0), corner(60, 30), corner(120, 0)];
    const s = toggleSmooth(anchors, 1, false);
    expect(s[1]).toMatchObject({ mode: 'mirrored', handleIn: { x: 40, y: 30 } });
    expect(toggleSmooth(s, 1, false)[1]).toEqual(corner(60, 30));
  });
});

describe('insertNodeAt', () => {
  it('splits a curve without changing its shape', () => {
    const anchors = [smooth(0, 0, 40, -40), smooth(200, 0, 40, 40)];
    const before = pathSegments(anchors, false)[0]!;
    const { anchors: out, index } = insertNodeAt(anchors, false, 0, 0.4);
    expect(index).toBe(1);
    expect(out).toHaveLength(3);
    const [a, b] = pathSegments(out, false);
    const onA = cubicAt(a!, 0.5);
    const orig = cubicAt(before, 0.2);
    expect(onA.x).toBeCloseTo(orig.x);
    expect(onA.y).toBeCloseTo(orig.y);
    expect(cubicAt(b!, 1).x).toBeCloseTo(200);
    expect(out[1]!.mode).toBe('aligned');
  });

  it('adds a corner on a straight segment, and on the closing one at the end', () => {
    const tri = [corner(0, 0), corner(100, 0), corner(0, 100)];
    const { anchors: out, index } = insertNodeAt(tri, true, 2, 0.5);
    expect(index).toBe(3);
    expect(out[3]).toEqual(corner(0, 50));
  });
});

describe('bendAt', () => {
  it('bends a straight segment through the pointer, giving its ends handles', () => {
    const out = bendAt([corner(0, 0), corner(100, 0)], false, 0, 0.5, { x: 50, y: 30 });
    const [seg] = pathSegments(out, false);
    const mid = cubicAt(seg!, 0.5);
    expect(mid.y).toBeCloseTo(30);
    expect(out[0]!.handleOut).toBeDefined();
    expect(out[1]!.handleIn).toBeDefined();
  });

  it('keeps a smooth end smooth', () => {
    const out = bendAt([smooth(0, 0, 20), corner(100, 0)], false, 0, 0.5, { x: 50, y: 30 });
    const a = out[0]!;
    expect(a.handleIn!.x - a.x).toBeCloseTo(-(a.handleOut!.x - a.x));
    expect(a.handleIn!.y - a.y).toBeCloseTo(-(a.handleOut!.y - a.y));
  });
});

describe('deleteNodes and canJoin', () => {
  it('removes the selected nodes and joins their neighbours', () => {
    const out = deleteNodes([corner(0, 0), corner(1, 1), corner(2, 2)], new Set([1]));
    expect(out).toEqual([corner(0, 0), corner(2, 2)]);
  });

  it('joins an open path only with both ends selected', () => {
    const three = [corner(0, 0), corner(1, 1), corner(2, 0)];
    expect(canJoin(three, false, new Set([0, 2]))).toBe(true);
    expect(canJoin(three, false, new Set([0]))).toBe(false);
    expect(canJoin(three, true, new Set([0, 2]))).toBe(false);
  });
});

describe('nodesInBox', () => {
  it('names the nodes inside the box', () => {
    const pts = [corner(0, 0), corner(50, 50), corner(100, 100)];
    expect(nodesInBox(pts, { x: 40, y: 40, width: 100, height: 100 })).toEqual([1, 2]);
  });
});

describe('snapNodeDelta', () => {
  const anchors = [corner(0, 0), corner(100, 60), corner(200, 0)];
  it('lines a dragged node up with another node on either axis', () => {
    // Node 1 from (100, 60) dragged by (12, -57): within 8 px of y = 0, clear of x = 100.
    const s = snapNodeDelta(anchors, new Set([1]), 1, 12, -57, 8);
    expect(s).toEqual({ dx: 12, dy: -60, guides: { y: 0 } });
  });

  it('snaps back to its own original position', () => {
    const s = snapNodeDelta(anchors, new Set([1]), 1, 4, 40, 8);
    expect(s.dx).toBe(0);
    expect(s.guides.x).toBe(100);
  });

  it('leaves a drag alone out of reach', () => {
    expect(snapNodeDelta(anchors, new Set([1]), 1, 30, 30, 8)).toEqual({
      dx: 30,
      dy: 30,
      guides: {},
    });
  });
});

describe('toLocal', () => {
  it('undoes the element rotation about its centre', () => {
    const el = { ...createPath([corner(0, 0), corner(100, 0)], false), rotation: 90 };
    // A quarter turn put the start node at (50, -50); in the path's own frame it is (0, 0).
    const p = toLocal(el, { x: 50, y: -50 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });
});

describe('handles that lie on their node', () => {
  it('never hide the node from a press', () => {
    const anchors = [
      { x: 0, y: 0, mode: 'corner' as const, handleOut: { x: 0, y: 0 } },
      corner(100, 0),
    ];
    expect(pathEditHit(anchors, false, new Set([1]), { x: 0, y: 0 }, 1, 2)).toEqual({
      kind: 'node',
      node: 0,
    });
  });

  it('are never made by a split next to a node without one', () => {
    const anchors = [corner(0, 0), smooth(200, 0, 40, 40)];
    const { anchors: out } = insertNodeAt(anchors, false, 0, 0.5);
    expect(out[0]!.handleOut).toBeUndefined();
  });
});

describe('setNodeType and sharedNodeType (the edit toolbar)', () => {
  // A node at the origin whose handles point out at different angles and lengths.
  const skew: PathAnchor = {
    x: 0,
    y: 0,
    mode: 'corner',
    handleIn: { x: -10, y: 0 },
    handleOut: { x: 0, y: 30 },
  };
  const three = [corner(-100, 0), skew, corner(100, 0)];

  it('Corner removes the handles', () => {
    expect(setNodeType(three, new Set([1]), 'corner', false)[1]).toEqual(corner(0, 0));
  });

  it('Mirrored averages the handles in angle and length', () => {
    const n = setNodeType(three, new Set([1]), 'mirrored', false)[1]!;
    expect(n.mode).toBe('mirrored');
    // Directions (1, 0) and (0, 1) average to 45°; lengths 10 and 30 to 20.
    const s = 20 / Math.SQRT2;
    expect(n.handleOut!.x).toBeCloseTo(s);
    expect(n.handleOut!.y).toBeCloseTo(s);
    expect(n.handleIn!.x).toBeCloseTo(-s);
    expect(n.handleIn!.y).toBeCloseTo(-s);
  });

  it('Aligned lines the handles up, each keeping its length', () => {
    const n = setNodeType(three, new Set([1]), 'aligned', false)[1]!;
    expect(n.mode).toBe('aligned');
    expect(Math.hypot(n.handleIn!.x, n.handleIn!.y)).toBeCloseTo(10);
    expect(Math.hypot(n.handleOut!.x, n.handleOut!.y)).toBeCloseTo(30);
    expect(n.handleOut!.x / n.handleOut!.y).toBeCloseTo(n.handleIn!.x / n.handleIn!.y);
  });

  it('gives a node without handles auto ones, and mirrors a lone handle', () => {
    const auto = setNodeType(
      [corner(0, 0), corner(60, 30), corner(120, 0)],
      new Set([1]),
      'mirrored',
      false,
    )[1]!;
    expect(auto.handleIn).toEqual({ x: 40, y: 30 });
    const lone = setNodeType(
      [{ x: 0, y: 0, mode: 'corner', handleOut: { x: 5, y: 5 } }, corner(50, 0)],
      new Set([0]),
      'mirrored',
      false,
    )[0]!;
    expect(lone.handleIn).toEqual({ x: -5, y: -5 });
  });

  it('names the type every selected node shares, else none', () => {
    const mixed = [corner(0, 0), smooth(50, 0, 10), smooth(100, 0, 10)];
    expect(sharedNodeType(mixed, new Set([1, 2]))).toBe('mirrored');
    expect(sharedNodeType(mixed, new Set([0, 1]))).toBeNull();
    expect(sharedNodeType(mixed, new Set())).toBeNull();
  });
});

describe('openPathAt', () => {
  it('cuts a closed path at a node, which becomes both ends', () => {
    const square = [smooth(0, 0, 10), corner(100, 0), corner(100, 100), corner(0, 100)];
    const open = openPathAt(square, 0);
    expect(open.map((a) => [a.x, a.y])).toEqual([
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ]);
    expect(open[0]).toEqual({ x: 0, y: 0, mode: 'corner', handleOut: { x: 10, y: 0 } });
    expect(open[4]).toEqual({ x: 0, y: 0, mode: 'corner', handleIn: { x: -10, y: 0 } });
    expect(openPathAt(square, 2).map((a) => a.x)).toEqual([100, 0, 0, 100, 100]);
  });
});

describe('toWorld', () => {
  it('turns a point of the path’s own frame back to where it shows', () => {
    const el = { ...createPath([corner(0, 0), corner(100, 0)], false), rotation: 90 };
    const p = toWorld(el, { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(-50);
    const back = toLocal(el, p);
    expect(back.x).toBeCloseTo(0);
  });
});

describe('dragNodes', () => {
  const anchors = [corner(0, 0), corner(100, 60), corner(200, 0)];
  it('moves the nodes by the drag, snapped, with the guides', () => {
    expect(dragNodes(anchors, new Set([1]), 1, { x: 12, y: -57 }, false, 8)).toEqual({
      anchors: [corner(0, 0), corner(112, 0), corner(200, 0)],
      guides: { y: 0 },
    });
  });

  it('holds the drag to 45° with Shift, and shows no guide', () => {
    const out = dragNodes(anchors, new Set([1]), 1, { x: 30, y: 2 }, true, 8);
    expect(out.anchors[1]!.y).toBeCloseTo(60);
    expect(out.guides).toBeNull();
  });
});

describe('pathEditCursor (docs/specs/023-whiteboard/path-tool.md "Cursors in edit mode")', () => {
  it('moves over nodes and handles, adds over segments, points elsewhere, never a text cursor', () => {
    expect(pathEditCursor({ kind: 'node', node: 0 })).toBe('move');
    expect(pathEditCursor({ kind: 'handle', node: 0, side: 'in' })).toBe('move');
    expect(pathEditCursor({ kind: 'segment', segment: 0, t: 0.5 })).toMatch(
      /^url\(.+\) \d+ \d+, copy$/,
    );
    expect(pathEditCursor({ kind: 'empty' })).toBe('default');
  });
});
