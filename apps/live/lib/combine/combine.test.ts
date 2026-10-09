import { describe, expect, it } from 'vitest';
import {
  packFreehandPoints,
  type BoxedElement,
  type FreehandElement,
  type PathElement,
  type ShapeElement,
} from '@livediagram/document';
import { combineElements, multiPolygonToPath, type CombineOp } from './combine';
import { elementRings, isCombinable } from './outline';
import { simplifyRing } from './simplify';

// docs/specs/007-editor/logo-pages.md "Combine".
const sq = (id: string, x: number, y: number, s: number, extra: Partial<ShapeElement> = {}) =>
  ({
    id,
    type: 'shape',
    shape: 'square',
    x,
    y,
    width: s,
    height: s,
    borderRadius: 'none',
    ...extra,
  }) as ShapeElement;
const disc = (id: string, x: number, y: number, d: number) =>
  ({ id, type: 'shape', shape: 'circle', x, y, width: d, height: d }) as ShapeElement;

const area = (p: PathElement) => {
  // Even-odd area: the shoelace over every contour, holes subtracting by their nesting.
  const ring = (nodes: PathElement['nodes']) => {
    let a = 0;
    for (let i = 0; i < nodes.length; i++) {
      const p1 = nodes[i]!;
      const p2 = nodes[(i + 1) % nodes.length]!;
      a +=
        (p1.nx * p.width + p.x) * (p2.ny * p.height + p.y) -
        (p2.nx * p.width + p.x) * (p1.ny * p.height + p.y);
    }
    return Math.abs(a) / 2;
  };
  const [outer, ...holes] = [p.nodes, ...(p.subpaths ?? [])].map(ring);
  return outer! - holes.reduce((n, h) => n + h, 0);
};

async function run(op: CombineOp, els: BoxedElement[]) {
  const r = await combineElements(els, op, 'new');
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe('combine', () => {
  const a = sq('a', 0, 0, 100, {
    fillColor: '#ff0000',
    strokeWidth: 'thick',
    opacity: 0.8,
    layerId: 'L',
  });
  const b = sq('b', 50, 50, 100, { fillColor: '#00ff00' });

  it('unites two overlapping squares into one eight-cornered outline', async () => {
    const r = await run('unite', [a, b]);
    expect(r.path.nodes).toHaveLength(8);
    expect(r.path.subpaths).toBeUndefined();
    expect(area(r.path)).toBeCloseTo(17500, 0);
    expect(r.removedIds).toEqual(['a', 'b']);
  });

  it('subtracts the others from the bottom-most', async () => {
    const r = await run('subtract', [a, b]);
    expect(area(r.path)).toBeCloseTo(7500, 0);
    expect(r.path).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('intersects what all cover', async () => {
    const r = await run('intersect', [a, b]);
    expect(r.path).toMatchObject({ x: 50, y: 50, width: 50, height: 50 });
    expect(r.path.nodes).toHaveLength(4);
  });

  it('excludes the overlap, leaving two islands', async () => {
    const r = await run('exclude', [a, b]);
    expect(1 + (r.path.subpaths?.length ?? 0)).toBe(2);
  });

  it('cuts a hole: a disc out of a square leaves an outline and a round hole', async () => {
    const r = await run('subtract', [sq('s', 0, 0, 200), disc('c', 50, 50, 100)]);
    expect(r.path.subpaths).toHaveLength(1);
    // The hole stays round: every point within a quarter pixel inside the circle's edge.
    const hole = r.path.subpaths![0]!.map((n) => Math.hypot(n.nx * 200 - 100, n.ny * 200 - 100));
    expect(Math.max(...hole)).toBeLessThanOrEqual(50.001);
    expect(Math.min(...hole)).toBeGreaterThanOrEqual(50 - 0.25);
  });

  it('wears the bottom-most element style, in its layer, closed', async () => {
    const r = await run('unite', [a, b]);
    expect(r.path).toMatchObject({
      type: 'path',
      closed: true,
      fillColor: '#ff0000',
      strokeWidth: 'thick',
      opacity: 0.8,
      layerId: 'L',
      id: 'new',
    });
  });

  it('applies rotation to the outline and leaves the result unrotated', async () => {
    const turned = sq('t', 0, 0, 100, { rotation: 45 });
    const r = await run('unite', [turned, sq('u', 1000, 1000, 10)]);
    expect(r.path.rotation).toBeUndefined();
    expect(r.path.width).toBeGreaterThan(1000);
  });

  it('reports nothing left for shapes that do not overlap', async () => {
    const r = await combineElements([a, sq('far', 500, 500, 10)], 'intersect', 'n');
    expect(r).toEqual({ ok: false, reason: 'empty' });
  });

  it('refuses a selection holding something that cannot combine', async () => {
    const text = { id: 't', type: 'text', x: 0, y: 0, width: 10, height: 10 } as BoxedElement;
    expect(isCombinable(text)).toBe(false);
    expect(await combineElements([a, text], 'unite', 'n')).toEqual({
      ok: false,
      reason: 'not-combinable',
    });
    expect(await combineElements([a], 'unite', 'n')).toEqual({
      ok: false,
      reason: 'not-combinable',
    });
  });

  it('refuses inputs too detailed to keep', async () => {
    const huge = disc('h', 0, 0, 100_000_000);
    const r = await combineElements([huge, disc('i', 0, 0, 100_000_000)], 'unite', 'n');
    expect(r.ok ? 'ok' : r.reason).toBe('too-detailed');
  });

  it('combines a combined path again, its hole kept', async () => {
    const ring = await run('subtract', [sq('s', 0, 0, 200), sq('h', 50, 50, 100)]);
    const again = await run('unite', [ring.path, sq('x', 300, 0, 50)]);
    expect(1 + (again.path.subpaths?.length ?? 0)).toBe(3);
  });

  it('stays within budget for two maximally detailed discs', async () => {
    const big = (id: string, x: number) => disc(id, x, 0, 1024);
    expect(elementRings(big('p', 0))[0]!.length).toBeLessThan(400);
    const t0 = performance.now();
    await run('unite', [big('p', 0), big('q', 300)]);
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('simplifyRing', () => {
  it('drops the closing repeat and points on a straight run', () => {
    expect(
      simplifyRing([
        [0, 0],
        [5, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ]),
    ).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
  });

  it('gives nothing for a ring that collapses', () => {
    expect(
      simplifyRing([
        [0, 0],
        [1, 0],
        [2, 0],
      ]),
    ).toEqual([]);
  });
});

describe('multiPolygonToPath', () => {
  it('is empty for no area', () => {
    expect(multiPolygonToPath([], 'x', {})).toBe('empty');
  });
});

describe('simplifyRing spikes', () => {
  it('keeps a point that folds back past its neighbours', () => {
    // A thin spike out to (20, 0) and back: collinear, but outside the segment it would merge into.
    const ring = simplifyRing([
      [0, 0],
      [20, 0],
      [10, 0.01],
      [10, 10],
      [0, 10],
    ]);
    expect(ring.some(([x]) => x === 20)).toBe(true);
  });
});

describe("combine keeps each input's look", () => {
  it("keeps a closed pencil shape's fill and outline, and a stock colour by name", async () => {
    const a = sq('a', 0, 0, 100, { fillColor: '#f1f5f9', strokeColor: '#1e293b' });
    const b = sq('b', 50, 0, 100);
    const r = await combineElements([a, b], 'unite', 'u');
    expect(r.ok && r.path).toMatchObject({ fillColor: '#f1f5f9', strokeColor: '#1e293b' });
    const named = await combineElements(
      [sq('c', 0, 0, 100, { penColour: 'red' } as Partial<ShapeElement>), sq('d', 50, 0, 100)],
      'unite',
      'v',
    );
    expect(named.ok && named.path.penColour).toBe('red');
  });

  it('keeps a closed pencil loop a filled, outlined shape (not a blob in its outline colour)', async () => {
    const loop = (id: string, x: number) =>
      ({
        id,
        type: 'freehand',
        closed: true,
        fillColor: '#f1f5f9',
        strokeColor: '#1e293b',
        ...packFreehandPoints(
          Array.from({ length: 24 }, (_, i) => {
            const t = (i / 24) * Math.PI * 2;
            return { x: x + Math.cos(t) * 50, y: Math.sin(t) * 50 };
          }),
        ),
      }) as FreehandElement;
    const r = await combineElements([loop('a', 0), loop('b', 60)], 'unite', 'u');
    expect(r.ok && r.path).toMatchObject({ fillColor: '#f1f5f9', strokeColor: '#1e293b' });
    expect(r.ok && r.path.strokeWidth).not.toBe('none');
  });
});
