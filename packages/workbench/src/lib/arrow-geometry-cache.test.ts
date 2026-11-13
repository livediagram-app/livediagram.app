import { describe, expect, it, vi } from 'vitest';
import { createArrowGeometryCache } from './arrow-geometry-cache';
import type { DragArrowEnd } from './drag-affected-arrows';

// Each editor's docs/specs/008-canvas/canvas-performance.md "A drop redraws what it reached", over a toy model: a box
// is a rect, an arrow's geometry is its id and the rect it reaches.
type El =
  | { id: string; type: 'box'; x: number; y: number; width: number; height: number }
  | { id: string; type: 'ink' }
  | { id: string; type: 'arrow'; from: DragArrowEnd; to: DragArrowEnd; global?: boolean };
type G = { id: string; reach: { x: number; y: number; width: number; height: number } };

const box = (id: string, x: number, y = 0): El => ({
  id,
  type: 'box',
  x,
  y,
  width: 10,
  height: 10,
});
const pin = (elementId: string): DragArrowEnd => ({ kind: 'pinned', elementId });
const arrow = (id: string, from: DragArrowEnd, to: DragArrowEnd, global = false): El => ({
  id,
  type: 'arrow',
  from,
  to,
  global,
});

function setup() {
  const cache = createArrowGeometryCache<El, G>({
    isArrow: (el) => el.type === 'arrow',
    ends: (a) => [
      (a as Extract<El, { type: 'arrow' }>).from,
      (a as Extract<El, { type: 'arrow' }>).to,
    ],
    reach: (g) => g.reach,
    structural: (a) => (a as { global?: boolean }).global === true,
  });
  const compute = vi.fn((a: El): G => ({
    id: a.id,
    // Each arrow reaches a strip of its own, far from the others unless placed there.
    reach: { x: Number(a.id.slice(1)) * 1000, y: 500, width: 100, height: 100 },
  }));
  const run = (els: El[], key: unknown = 'k') => {
    compute.mockClear();
    const out = cache.geometryFor(els, key, compute);
    return { out, derived: compute.mock.calls.map(([a]) => a.id).sort() };
  };
  return run;
}

// a1: A → B; a2: B → C (shares B with a1); a3: D → E, away from both; a4: F → G.
const board = (): El[] => [
  box('A', 0),
  box('B', 100),
  box('C', 200),
  box('D', 300),
  box('E', 400),
  box('F', 500),
  box('G', 600),
  arrow('a1', pin('A'), pin('B')),
  arrow('a2', pin('B'), pin('C')),
  arrow('a3', pin('D'), pin('E')),
  arrow('a4', pin('F'), pin('G')),
];

describe('createArrowGeometryCache', () => {
  it('derives every arrow the first time, and none on the same board', () => {
    const run = setup();
    const els = board();
    expect(run(els).derived).toEqual(['a1', 'a2', 'a3', 'a4']);
    const first = run(els);
    expect(first.derived).toEqual([]);
  });

  it('derives the arrows pinned to a moved box and those sharing a pin with their other end', () => {
    const run = setup();
    const els = board();
    const was = run(els).out;
    const moved = els.map((e) => (e.id === 'A' ? box('A', 50) : e));
    const { out, derived } = run(moved);
    expect(derived).toEqual(['a1', 'a2']);
    expect(out.get('a3')).toBe(was.get('a3'));
  });

  it('derives an arrow whose reach a change meets, where it was or where it went', () => {
    const run = setup();
    const els = board();
    run(els);
    // Box C moves into a3's strip (x 3000): a3's holes may change; a2 is pinned to C.
    const into = els.map((e) => (e.id === 'C' ? box('C', 3020, 520) : e));
    expect(run(into).derived).toEqual(['a1', 'a2', 'a3']);
    // And back out of it: where it was counts.
    expect(run(els).derived).toEqual(['a1', 'a2', 'a3']);
    // A new box in a4's strip, then gone again.
    const added = [...els, box('N', 4010, 510)];
    expect(run(added).derived).toEqual(['a4']);
    expect(run(els).derived).toEqual(['a4']);
  });

  it('derives a changed, new or gone arrow and the arrows at its pins, where it was and is', () => {
    const run = setup();
    const els = board();
    run(els);
    // a3 restyled: only a3 (nothing else sits at D or E).
    expect(run(els.map((e) => (e.id === 'a3' ? { ...e } : e))).derived).toEqual(['a3']);
    // a3 re-pinned from D to B: a3, and a1 and a2 at B (its new pin).
    const repinned = els.map((e) => (e.id === 'a3' ? arrow('a3', pin('B'), pin('E')) : e));
    expect(run(repinned).derived).toEqual(['a1', 'a2', 'a3']);
    // And back: B was a pin of the arrow as it was.
    expect(run(els).derived).toEqual(['a1', 'a2', 'a3']);
    // A new arrow at C joins a2's fan; gone again, it leaves it.
    const added = [...els, arrow('a9', pin('C'), pin('G'))];
    expect(run(added).derived).toEqual(['a2', 'a4', 'a9']);
    expect(run(els).derived).toEqual(['a2', 'a4']);
    // An arrow with a free end changed: just its pinned end's fan.
    const loose = [...els, arrow('a8', { kind: 'free' } as DragArrowEnd, pin('A'))];
    run(loose);
    expect(run(loose.map((e) => (e.id === 'a8' ? { ...e } : e))).derived).toEqual(['a1', 'a8']);
  });

  it('derives every arrow for an element of unknown extent or a new key', () => {
    const run = setup();
    const els = board();
    run(els);
    const all = ['a1', 'a2', 'a3', 'a4'];
    const inked = [...els, { id: 'i', type: 'ink' } as El];
    expect(run(inked).derived).toEqual(all);
    // An ink stroke gone can't be told either.
    expect(run(els).derived).toEqual(all);
    expect(run(els, 'other').derived).toEqual(all);
    expect(run(els, 'other').derived).toEqual([]);
  });

  it('always derives a structural arrow, an arrow riding another, and the arrows at its pins', () => {
    const run = setup();
    const els: El[] = [
      ...board().filter((e) => e.id !== 'a4'),
      arrow('a4', pin('F'), pin('G'), true),
      arrow('a5', { kind: 'on-arrow', arrowId: 'a3' } as DragArrowEnd, pin('E')),
      arrow('a6', { kind: 'free' } as DragArrowEnd, pin('E')),
    ];
    run(els);
    // Nothing near them changes, yet a4 (structural), a5 (rides a3), a3 and a6 (share E with a5) are derived again.
    const moved = els.map((e) => (e.id === 'A' ? box('A', 50) : e));
    expect(run(moved).derived).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('follows a pin at either end of an arrow on a moved box', () => {
    const run = setup();
    const els = board();
    run(els);
    // C moves: a2 (B → C) is pinned to it, and a1 shares B, a2's other end.
    const moved = els.map((e) => (e.id === 'C' ? box('C', 250) : e));
    expect(run(moved).derived).toEqual(['a1', 'a2']);
  });

  it('carries over an entry the caller set in the map it returned', () => {
    const run = setup();
    const els = board();
    const { out } = run(els);
    const redrawn = { ...out.get('a3')!, id: 'a3 again' };
    out.set('a3', redrawn);
    expect(run(els).out.get('a3')).toBe(redrawn);
  });
});
