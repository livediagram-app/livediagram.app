import { describe, expect, it } from 'vitest';
import {
  rectsIntersect,
  type Point,
  type Rect,
} from '@liveworkspace/model-core/geometry-primitives';
import { buildRectGrid, eachRectMeeting, type RectGrid } from '@liveworkspace/model-core/rect-grid';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import {
  createDragAffectedArrows,
  type DragArrowEnd,
  type DragOverlayLike,
} from './drag-affected-arrows';
import { ridingElements } from './drag-ride';

// The preview's arrow work over a toy model (each editor binds its own): boxes, and arrows pinned to them, free, or
// on another arrow. A route-behind rect is the bounds of an arrow's ends; a hole is a candidate box crossing it.

type Box = { id: string; type: 'box'; x: number; y: number; width: number; height: number };
type Arrow = { id: string; type: 'arrow'; from: DragArrowEnd; to: DragArrowEnd };
type El = Box | Arrow;
type Index = ReadonlyMap<string, El>;
type Grid = { rects: RectGrid; byId: ReadonlyMap<string, El> };

const isBox = (el: El): el is Box => el.type === 'box';
const indexCache = new WeakMap<readonly El[], Index>();
const index = (els: readonly El[]): Index => new Map(els.map((el) => [el.id, el]));
const position = (end: DragArrowEnd, idx: Index, depth = 0): Point => {
  if (end.kind === 'free') {
    const { x, y } = end as unknown as Point;
    return { x, y };
  }
  if (end.kind === 'pinned') {
    const b = idx.get((end as { elementId: string }).elementId);
    return b && isBox(b) ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : { x: 0, y: 0 };
  }
  const a = idx.get((end as { arrowId: string }).arrowId);
  if (!a || a.type !== 'arrow' || depth > 4) return { x: 0, y: 0 };
  const [p, q] = [position(a.from, idx, depth + 1), position(a.to, idx, depth + 1)];
  return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
};
const bounds = (p: Point, q: Point): Rect => ({
  x: Math.min(p.x, q.x),
  y: Math.min(p.y, q.y),
  width: Math.abs(p.x - q.x),
  height: Math.abs(p.y - q.y),
});

const arrows = createDragAffectedArrows<El, Arrow, Index, Grid, { from: Point; to: Point }>({
  isBoxed: isBox,
  isArrow: (el): el is Arrow => el.type === 'arrow',
  ends: (a) => [a.from, a.to],
  buildElementIndex: index,
  elementIndexFor: (els) => {
    let idx = indexCache.get(els);
    if (!idx) indexCache.set(els, (idx = index(els)));
    return idx;
  },
  endpointPosition: (end, idx) => position(end, idx),
  routeBehindQueryRect: bounds,
  routeBehindHoles: (a, from, to, candidates) => {
    const own = new Set(
      [a.from, a.to].flatMap((e) =>
        e.kind === 'pinned' ? [(e as { elementId: string }).elementId] : [],
      ),
    );
    return candidates
      .filter(
        (el): el is Box => isBox(el) && !own.has(el.id) && rectsIntersect(el, bounds(from, to)),
      )
      .map(({ x, y, width, height }) => ({ x, y, width, height }));
  },
  buildElementGrid: (els) => ({
    rects: buildRectGrid(new Map(els.filter(isBox).map((b) => [b.id, b]))),
    byId: index(els),
  }),
  queryElementGrid: (grid, rect) => {
    const out: El[] = [];
    eachRectMeeting(grid.rects, rect, new Set(), (id) => out.push(grid.byId.get(id)!));
    return out;
  },
  frameOf: (a, idx) => ({ from: position(a.from, idx), to: position(a.to, idx) }),
});

const box = (id: string, x: number, y: number, size = 50): Box => ({
  id,
  type: 'box',
  x,
  y,
  width: size,
  height: size,
});
const pin = (elementId: string): DragArrowEnd => ({ kind: 'pinned', elementId });
const free = (x: number, y: number) => ({ kind: 'free', x, y }) as DragArrowEnd;

const a = box('a', 0, 0);
const b = box('b', 400, 0);
const c = box('c', 0, 400);
const wall = box('wall', 1000, -200, 100);
const ab: Arrow = { id: 'ab', type: 'arrow', from: pin('a'), to: pin('b') };
const ac: Arrow = { id: 'ac', type: 'arrow', from: pin('a'), to: pin('c') };
// Free, passing beside the wall: the wall cuts it once moved over it.
const loose: Arrow = { id: 'loose', type: 'arrow', from: free(900, 300), to: free(1300, 300) };
const rider: Arrow = {
  id: 'rider',
  type: 'arrow',
  from: free(200, 300),
  to: { kind: 'on-arrow', arrowId: 'ab' },
};
const DOC: El[] = [a, b, c, wall, ab, ac, loose, rider];
const LINKS = arrows.buildArrowLinks(DOC);

const overlay = (changed: El[], removed: string[] = [], added: El[] = []): DragOverlayLike<El> => ({
  changed: new Map(changed.map((el) => [el.id, el])),
  removed: new Set(removed),
  added: added.map((el) => ({ el })),
});
const affected = (o: DragOverlayLike<El>) => [...arrows.affectedArrows(o, DOC, LINKS)].sort();

describe('the drag preview’s affected arrows', () => {
  it('links each arrow to what its ends hold', () => {
    expect(LINKS.dependants.get('a')).toEqual(['ab', 'ac']);
    expect(LINKS.dependants.get('ab')).toEqual(['rider']);
    expect(LINKS.dependants.has('wall')).toBe(false);
  });

  it('takes the arrows pinned to a moved box, and those riding on them', () => {
    expect(affected(overlay([{ ...b, x: 420 }]))).toEqual(['ab', 'rider']);
    expect(affected(overlay([{ ...c, y: 410 }]))).toEqual(['ac']);
  });

  it('takes an arrow a moved box crosses where it went, and where it was', () => {
    expect(affected(overlay([{ ...wall, y: 250 }]))).toEqual(['loose']);
    const parked = { ...wall, y: 250 };
    const back = arrows.affectedArrows(
      overlay([{ ...wall, y: -200 }]),
      [a, b, c, parked, ab, ac, loose, rider],
      arrows.buildArrowLinks([a, b, c, parked, ab, ac, loose, rider]),
    );
    expect([...back]).toEqual(['loose']);
  });

  it('keeps the crossings where the boxes were for a whole gesture, and finds them again for another', () => {
    const first = overlay([{ ...wall, x: 1010, y: 250 }]);
    expect(affected(first)).toEqual(['loose']);
    expect(affected(overlay([{ ...wall, x: 1020, y: 250 }]))).toEqual(['loose']);
    expect(affected(overlay([{ ...a, x: 5 }]))).toEqual(['ab', 'ac', 'rider']);
  });

  it('takes a changed arrow, and the arrows on a removed element', () => {
    expect(affected(overlay([{ ...loose, to: free(1400, 300) }]))).toEqual(['loose']);
    expect(affected(overlay([], ['ab']))).toEqual(['rider']);
  });

  it('takes none when the ride carries every arrow, and asks the boxes when one arrow stays', () => {
    const moved = overlay([{ ...wall, y: 250 }]);
    const all = new Map(
      ['ab', 'ac', 'loose', 'rider', 'wall'].map((id) => [id, { dx: 0, dy: 450 }]),
    );
    expect([...arrows.affectedArrows(moved, DOC, LINKS, all)]).toEqual([]);
    all.delete('loose');
    expect([...arrows.affectedArrows(moved, DOC, LINKS, all)]).toEqual(['loose']);
    expect([...arrows.affectedArrows(moved, DOC, LINKS, new Map())]).toEqual(['loose']);
  });

  it('redraws an affected arrow through the preview, with holes from the moved boxes where they are now', () => {
    const moved = { ...wall, y: 250 };
    const o = overlay([moved], [], [box('new', 1150, 295, 10)]);
    const idx = new Map(index(DOC));
    idx.set('wall', moved);
    const grid = {
      rects: buildRectGrid(
        new Map([
          ['wall', wall],
          ['c', c],
        ]),
      ),
      byId: index(DOC),
    };
    const geometry = arrows.previewArrowGeometry(loose, idx, grid, o, arrows.movedBoxesGrid(o));
    expect(geometry.frame).toEqual({ from: { x: 900, y: 300 }, to: { x: 1300, y: 300 } });
    expect(geometry.holes).toEqual([
      { x: 1000, y: 250, width: 100, height: 100 },
      { x: 1150, y: 295, width: 10, height: 10 },
    ]);
    // The wall where it was is not a hole: the gesture moved it.
    const still = arrows.previewArrowGeometry(
      ab,
      idx,
      grid,
      overlay([]),
      arrows.movedBoxesGrid(overlay([])),
    );
    expect(still.holes).toEqual([]);
  });
});

describe('the ride rules', () => {
  const BEFORE = index(DOC);
  const rides = (changed: El[], rules: Partial<Parameters<typeof ridingElements<El>>[2]> = {}) =>
    Object.fromEntries(
      ridingElements(overlay(changed), BEFORE, { isBoxed: isBox, links: LINKS, ...rules }),
    );

  it('lets moved boxes ride, and an arrow whose ends ride one offset', () => {
    expect(
      rides([
        { ...a, x: 10 },
        { ...b, x: 410 },
      ]),
    ).toEqual({
      a: { dx: 10, dy: 0 },
      b: { dx: 10, dy: 0 },
      ab: { dx: 10, dy: 0 },
    });
    expect(
      rides([
        { ...a, x: 10 },
        { ...b, x: 420 },
      ]),
    ).toEqual({ a: { dx: 10, dy: 0 }, b: { dx: 20, dy: 0 } });
  });

  it('carries an arrow whose free ends shifted with it, and never a resized box', () => {
    const shifted = { ...loose, from: free(910, 300), to: free(1310, 300) };
    expect(rides([{ ...a, x: 10 }, shifted])).toMatchObject({ loose: { dx: 10, dy: 0 } });
    expect(rides([{ ...a, width: 80 }])).toEqual({});
    expect(
      rides([
        { ...a, x: 10 },
        { ...ab, to: pin('c') },
      ]),
    ).not.toHaveProperty('ab');
    expect(
      rides([
        { ...a, x: 10 },
        { ...c, x: 10 },
        { ...ac, from: { kind: 'on-arrow', arrowId: 'ab' } as DragArrowEnd },
      ]),
    ).not.toHaveProperty('ac');
  });

  it('keeps the still ids out, rides no arrow when told not to, and needs a box to carry anything', () => {
    const moveAll: El[] = [
      { ...a, x: 10 },
      { ...b, x: 410 },
    ];
    expect(rides(moveAll, { still: new Set(['a']) })).toEqual({ b: { dx: 10, dy: 0 } });
    expect(rides(moveAll, { arrowsRide: false })).toEqual({
      a: { dx: 10, dy: 0 },
      b: { dx: 10, dy: 0 },
    });
    expect(rides([{ ...loose, from: free(910, 300), to: free(1310, 300) }])).toEqual({});
    expect(rides(moveAll, { links: null })).toEqual({ a: { dx: 10, dy: 0 }, b: { dx: 10, dy: 0 } });
    expect(rides([box('new', 0, 0)])).toEqual({});
  });
});

describe('the affected arrows’ cost', () => {
  // A 45-column grid of 2,000 boxes, each joined to the next: every box resized (a union resize), so every arrow
  // re-routes. Scanning every moved box for every arrow made this quadratic: about half a second in livedesign.
  const N = 2000;
  const boxes = Array.from({ length: N }, (_, i) =>
    box(`n${i}`, (i % 45) * 200, Math.floor(i / 45) * 140, 100),
  );
  const joins: Arrow[] = boxes
    .slice(1)
    .map((bx, i) => ({ id: `j${i}`, type: 'arrow', from: pin(boxes[i]!.id), to: pin(bx.id) }));
  const board: El[] = [...boxes, ...joins];
  const links = arrows.buildArrowLinks(board);
  const grid = {
    rects: buildRectGrid(new Map(boxes.map((bx) => [bx.id, bx]))),
    byId: index(board),
  };

  it('finds and re-routes every arrow of a 2,000-box union resize within budget', () => {
    let grow = 0;
    const frame = () => {
      grow += 2;
      const o = overlay(boxes.map((bx) => ({ ...bx, width: bx.width + grow })));
      const idx = new Map(index(board));
      for (const [id, el] of o.changed) idx.set(id, el);
      const moved = arrows.movedBoxesGrid(o);
      for (const id of arrows.affectedArrows(o, board, links))
        arrows.previewArrowGeometry(idx.get(id) as Arrow, idx, grid, o, moved);
    };
    for (let i = 0; i < 2; i++) frame();
    let best = Infinity;
    for (let i = 0; i < 3; i++) best = Math.min(best, cpuMsOf(frame));
    if (process.env.PERF_LOG) console.log(`union resize arrow work ${best.toFixed(2)} ms`);
    expect(best).toBeLessThan(cpuBudgetMs(40));
  });
});
