import { describe, expect, it } from 'vitest';
import {
  continuedPath,
  createPath,
  pathAnchors,
  pathGeometry,
  pathWorldAnchors,
  reshapePath,
  reversePath,
} from './path-element';
import { elementSupportsText, isBoxed } from './index';
import type { PathAnchor } from './path-geometry';

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });

function worldOf(el: ReturnType<typeof createPath>) {
  // Each node where it shows on screen: rotated about the box centre.
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  const r = ((el.rotation ?? 0) * Math.PI) / 180;
  return pathAnchors(el).map((a) => ({
    x: cx + (a.x - cx) * Math.cos(r) - (a.y - cy) * Math.sin(r),
    y: cy + (a.x - cx) * Math.sin(r) + (a.y - cy) * Math.cos(r),
  }));
}

describe('pathGeometry', () => {
  it('boxes the drawn curve and normalises nodes and handles against it', () => {
    const g = pathGeometry(
      [
        { x: 10, y: 20, mode: 'corner', handleOut: { x: 10, y: -80 } },
        { x: 110, y: 20, mode: 'corner', handleIn: { x: 110, y: -80 } },
      ],
      false,
    );
    expect(g.x).toBeCloseTo(10);
    expect(g.width).toBeCloseTo(100);
    expect(g.y).toBeCloseTo(-55);
    expect(g.height).toBeCloseTo(75);
    expect(g.nodes[0]!.ny).toBeCloseTo(1);
    // The handle reaches beyond the curve, so beyond the box.
    expect(g.nodes[0]!.handleOut!.ny).toBeLessThan(0);
  });

  it('gives a straight horizontal path a box 1 px tall about its line', () => {
    const g = pathGeometry([corner(0, 50), corner(80, 50)], false);
    expect(g.height).toBe(1);
    expect(g.y).toBe(49.5);
    expect(g.nodes.map((n) => n.ny)).toEqual([0.5, 0.5]);
  });
});

describe('pathAnchors', () => {
  it('round-trips the anchors through the element', () => {
    const anchors: PathAnchor[] = [
      corner(0, 0),
      { x: 50, y: 40, mode: 'mirrored', handleIn: { x: 30, y: 40 }, handleOut: { x: 70, y: 40 } },
      corner(100, 0),
    ];
    const back = pathAnchors(createPath(anchors, false));
    back.forEach((a, i) => {
      expect(a.x).toBeCloseTo(anchors[i]!.x);
      expect(a.y).toBeCloseTo(anchors[i]!.y);
      expect(a.mode).toBe(anchors[i]!.mode);
    });
    expect(back[1]!.handleOut!.x).toBeCloseTo(70);
    expect(back[0]!.handleIn).toBeUndefined();
  });

  it('offsets by an origin', () => {
    const el = createPath([corner(10, 10), corner(20, 30)], false);
    expect(pathAnchors(el, { x: 0, y: 0 })[0]).toEqual({ x: 0, y: 0, mode: 'corner' });
  });
});

describe('createPath', () => {
  it('mints an unpainted path element', () => {
    const el = createPath([corner(0, 0), corner(10, 10), corner(0, 10)], true);
    expect(el.type).toBe('path');
    expect(el.closed).toBe(true);
    expect(el.nodes).toHaveLength(3);
    expect(el.strokeColor).toBeUndefined();
    expect(el.fillColor).toBeUndefined();
  });
});

describe('reshapePath', () => {
  it('keeps every other field and refits the box', () => {
    const el = { ...createPath([corner(0, 0), corner(10, 10)], false), strokeColor: '#f00' };
    const next = reshapePath(el, [corner(0, 0), corner(10, 10), corner(40, 0)], false);
    expect(next.id).toBe(el.id);
    expect(next.strokeColor).toBe('#f00');
    expect(next.width).toBeCloseTo(40);
    expect(next.nodes).toHaveLength(3);
  });

  it('keeps unmoved nodes where they show on a rotated path', () => {
    const el = {
      ...createPath([corner(0, 0), corner(100, 0), corner(100, 50)], false),
      rotation: 30,
    };
    const before = worldOf(el);
    const moved = pathAnchors(el).map((a, i) => (i === 2 ? { ...a, x: a.x + 80, y: a.y + 60 } : a));
    const after = worldOf(reshapePath(el, moved, false));
    for (const i of [0, 1]) {
      expect(after[i]!.x).toBeCloseTo(before[i]!.x);
      expect(after[i]!.y).toBeCloseTo(before[i]!.y);
    }
  });
});

describe('a path in the element vocabulary', () => {
  it('is boxed and takes no text', () => {
    const el = createPath([corner(0, 0), corner(10, 10)], false);
    expect(isBoxed(el)).toBe(true);
    expect(elementSupportsText(el)).toBe(false);
  });
});

describe('pathWorldAnchors', () => {
  it('turns nodes and handles with the element', () => {
    const el = {
      ...createPath(
        [
          { x: 0, y: 0, mode: 'corner', handleOut: { x: 50, y: 0 } },
          { x: 100, y: 0, mode: 'corner' },
        ],
        false,
      ),
      rotation: 90,
    };
    // A 100 x 1 box centred on (50, 0): a quarter turn stands it upright.
    const [a, b] = pathWorldAnchors(el);
    expect(a!.x).toBeCloseTo(50);
    expect(a!.y).toBeCloseTo(-50);
    expect(b!.y).toBeCloseTo(50);
    expect(a!.handleOut!.x).toBeCloseTo(50);
    expect(a!.handleOut!.y).toBeCloseTo(0);
  });

  it('is pathAnchors for an unrotated path', () => {
    const el = createPath([corner(0, 0), corner(10, 10)], false);
    expect(pathWorldAnchors(el)).toEqual(pathAnchors(el));
  });
});

describe('continuedPath', () => {
  it('takes the new anchors unrotated and keeps the style', () => {
    const el = {
      ...createPath([corner(0, 0), corner(10, 10)], false),
      rotation: 30,
      strokeColor: '#0f0',
    };
    const next = continuedPath(el, [corner(0, 0), corner(10, 10), corner(30, 0)], true);
    expect(next.id).toBe(el.id);
    expect(next.strokeColor).toBe('#0f0');
    expect(next).not.toHaveProperty('rotation');
    expect(next.closed).toBe(true);
    expect(next.nodes).toHaveLength(3);
  });
});

describe('reversePath', () => {
  it('runs the other way, each node trading its handles', () => {
    const rev = reversePath([
      { x: 0, y: 0, mode: 'corner', handleOut: { x: 5, y: 0 } },
      { x: 10, y: 0, mode: 'mirrored', handleIn: { x: 8, y: 0 }, handleOut: { x: 12, y: 0 } },
    ]);
    expect(rev.map((a) => a.x)).toEqual([10, 0]);
    expect(rev[0]!.handleOut).toEqual({ x: 8, y: 0 });
    expect(rev[1]!.handleIn).toEqual({ x: 5, y: 0 });
    expect(rev[1]!.handleOut).toBeUndefined();
  });
});
