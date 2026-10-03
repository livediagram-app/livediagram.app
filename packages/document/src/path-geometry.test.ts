import { describe, expect, it } from 'vitest';
import {
  bendSegment,
  constrain45,
  cubicAt,
  isCommittablePath,
  nearestOnPath,
  partnerHandle,
  pathBounds,
  pathD,
  pathSegments,
  samplePath,
  smoothHandles,
  splitSegment,
  type PathAnchor,
} from './path-geometry';

const corner = (x: number, y: number): PathAnchor => ({ x, y, mode: 'corner' });
const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

// A curve from (0,0) to (100,0) bulging up to y = -75 at its middle.
const arch: PathAnchor[] = [
  { x: 0, y: 0, mode: 'corner', handleOut: { x: 0, y: -100 } },
  { x: 100, y: 0, mode: 'corner', handleIn: { x: 100, y: -100 } },
];

describe('pathSegments', () => {
  it('joins consecutive nodes, and the last to the first when closed', () => {
    const tri = [corner(0, 0), corner(10, 0), corner(0, 10)];
    expect(pathSegments(tri, false).map((s) => [s.from, s.to])).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(pathSegments(tri, true).map((s) => [s.from, s.to])).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
  });

  it('marks a segment with neither facing handle straight and uses the nodes as controls', () => {
    const [seg] = pathSegments([corner(0, 0), corner(10, 0)], false);
    expect(seg!.straight).toBe(true);
    expect(seg!.c1).toEqual({ x: 0, y: 0 });
    expect(seg!.c2).toEqual({ x: 10, y: 0 });
  });

  it('curves through the facing handles', () => {
    const [seg] = pathSegments(arch, false);
    expect(seg!.straight).toBe(false);
    expect(seg!.c1).toEqual({ x: 0, y: -100 });
    expect(seg!.c2).toEqual({ x: 100, y: -100 });
  });
});

describe('pathD', () => {
  it('draws lines for straight segments and cubics for curves, closing with Z', () => {
    expect(pathD([corner(0, 0), corner(10, 0), corner(0, 10)], true)).toBe(
      'M 0 0 L 10 0 L 0 10 L 0 0 Z',
    );
    expect(pathD(arch, false)).toBe('M 0 0 C 0 -100 100 -100 100 0');
  });

  it('formats numbers through the given function and is empty for no nodes', () => {
    expect(pathD([corner(0.123, 0), corner(1, 1)], false, (n) => Math.round(n))).toBe(
      'M 0 0 L 1 1',
    );
    expect(pathD([], false)).toBe('');
  });
});

describe('pathBounds', () => {
  it('wraps the drawn curve, not its handles', () => {
    const b = pathBounds(arch, false);
    close(b.x, 0);
    close(b.width, 100);
    close(b.y, -75);
    close(b.height, 75);
  });

  it('includes the closing segment of a closed path', () => {
    const b = pathBounds(
      [corner(0, 0), { x: 100, y: 0, mode: 'corner', handleOut: { x: 100, y: 100 } }],
      true,
    );
    expect(b.height).toBeGreaterThan(20);
  });
});

describe('splitSegment', () => {
  it('keeps the curve exactly (de Casteljau)', () => {
    const [seg] = pathSegments(arch, false);
    const [a, b] = splitSegment(seg!, 0.3);
    for (const t of [0, 0.25, 0.5, 1]) {
      const onA = cubicAt(a, t);
      const orig = cubicAt(seg!, 0.3 * t);
      close(onA.x, orig.x);
      close(onA.y, orig.y);
      const onB = cubicAt(b, t);
      const origB = cubicAt(seg!, 0.3 + 0.7 * t);
      close(onB.x, origB.x);
      close(onB.y, origB.y);
    }
  });
});

describe('nearestOnPath', () => {
  it('finds the closest point and its parameter', () => {
    const hit = nearestOnPath(arch, false, { x: 50, y: -80 })!;
    expect(hit.segment).toBe(0);
    close(hit.t, 0.5);
    close(hit.point.y, -75);
    close(hit.distance, 5);
  });

  it('is null for fewer than two nodes', () => {
    expect(nearestOnPath([corner(0, 0)], false, { x: 0, y: 0 })).toBeNull();
  });
});

describe('bendSegment', () => {
  it('moves both controls so the curve passes through the target at t', () => {
    const [seg] = pathSegments([corner(0, 0), corner(100, 0)], false);
    const { c1, c2 } = bendSegment(seg!, 0.5, { x: 50, y: 40 });
    const bent = { ...seg!, c1, c2, straight: false };
    const at = cubicAt(bent, 0.5);
    close(at.x, 50);
    close(at.y, 40);
  });
});

describe('smoothHandles', () => {
  it('lays equal handles along the line between the neighbours', () => {
    const nodes = [corner(0, 0), corner(60, 30), corner(120, 0)];
    const h = smoothHandles(nodes, 1, false);
    expect(h.handleOut).toEqual({ x: 80, y: 30 });
    expect(h.handleIn).toEqual({ x: 40, y: 30 });
  });

  it('points an open end a third of the way to its one neighbour', () => {
    const nodes = [corner(0, 0), corner(90, 0)];
    expect(smoothHandles(nodes, 0, false)).toEqual({
      handleOut: { x: 30, y: 0 },
      handleIn: { x: -30, y: 0 },
    });
    expect(smoothHandles(nodes, 1, false)).toEqual({
      handleIn: { x: 60, y: 0 },
      handleOut: { x: 120, y: 0 },
    });
  });

  it('wraps round a closed path', () => {
    const nodes = [corner(0, 0), corner(60, 0), corner(60, 60)];
    const h = smoothHandles(nodes, 0, true);
    expect(h.handleOut).toEqual({ x: 0, y: -10 });
  });
});

describe('constrain45', () => {
  it('snaps the direction to the nearest 45° and keeps the length', () => {
    const p = constrain45({ x: 0, y: 0 }, { x: 10, y: 1 });
    close(p.x, Math.hypot(10, 1));
    close(p.y, 0);
    const d = constrain45({ x: 0, y: 0 }, { x: 10, y: 9 });
    close(d.x, d.y);
  });
});

describe('partnerHandle', () => {
  const node = { x: 0, y: 0 };
  it('mirrors in length and angle for a mirrored node', () => {
    expect(partnerHandle(node, { x: 10, y: 5 }, { x: -1, y: 0 }, 'mirrored')).toEqual({
      x: -10,
      y: -5,
    });
  });

  it('keeps its own length for an aligned node', () => {
    const p = partnerHandle(node, { x: 0, y: 10 }, { x: -4, y: 0 }, 'aligned')!;
    close(p.x, 0);
    close(p.y, -4);
  });

  it('stays put for a corner', () => {
    expect(partnerHandle(node, { x: 0, y: 10 }, { x: -4, y: 0 }, 'corner')).toEqual({
      x: -4,
      y: 0,
    });
  });
});

describe('isCommittablePath', () => {
  it('needs two nodes, and three to close unless a handle bends the two', () => {
    expect(isCommittablePath([corner(0, 0)], false)).toBe(false);
    expect(isCommittablePath([corner(0, 0), corner(1, 1)], false)).toBe(true);
    expect(isCommittablePath([corner(0, 0), corner(1, 1)], true)).toBe(false);
    expect(isCommittablePath(arch, true)).toBe(true);
    expect(isCommittablePath([corner(0, 0), corner(1, 1), corner(2, 0)], true)).toBe(true);
  });
});

describe('samplePath', () => {
  it('samples curves and keeps straight segments to their ends', () => {
    expect(samplePath([corner(0, 0), corner(10, 0)], false)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    const pts = samplePath(arch, false, 4);
    expect(pts).toHaveLength(5);
    close(pts[2]!.y, -75);
  });

  it('returns to the start when closed', () => {
    const pts = samplePath([corner(0, 0), corner(10, 0), corner(0, 10)], true);
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: 0 });
  });
});
