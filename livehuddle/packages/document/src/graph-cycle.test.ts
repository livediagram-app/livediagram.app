import { describe, expect, it } from 'vitest';
import { layoutGraph } from './graph-input';
import { arrowPolyline, pathPassesThrough } from './arrow-path-hits';
import { elementIndexFor } from './geometry';
import { isBoxed, type ArrowElement, type BoxedElement } from './index';

// docs/specs/015-api/mcp-server.md §4.7 `style: "cycle"`: a node with no edge sits at the ring's centre, the ring wide
// enough that the centre never runs into a stop.
const overlaps = (a: BoxedElement, b: BoxedElement) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('cycle style', () => {
  it.each([
    [3, 3],
    [4, 3],
    [5, 4],
    [3, 6],
  ])('keeps %i stops clear of %i hubs at the centre', (stops, hubs) => {
    const ring = Array.from({ length: stops }, (_, i) => `r${i}`);
    const centre = Array.from({ length: hubs }, (_, i) => `h${i}`);
    const els = layoutGraph({
      style: 'cycle',
      nodes: [...ring, ...centre].map((id) => ({ id, label: id })),
      edges: ring.map((id, i) => ({ from: id, to: ring[(i + 1) % stops]! })),
    }).filter(isBoxed);
    const at = (id: string) => els.find((b) => b.id === id)!;
    for (const h of centre)
      for (const r of ring) expect(overlaps(at(h), at(r)), `${h}~${r}`).toBe(false);
  });

  // A star: one stop wired to every other. An arc between stops that are not neighbours on the ring went along the
  // ring's own arc, behind the stops between; it now goes round the outside of them.
  it.each([5, 6, 8, 12])(
    'routes a %i-stop star’s arcs round the stops, not behind them',
    (stops) => {
      const ids = Array.from({ length: stops }, (_, i) => `s${i}`);
      const els = layoutGraph({
        style: 'cycle',
        nodes: ids.map((id) => ({ id, label: id })),
        edges: ids.slice(1).map((to) => ({ from: 's0', to })),
      });
      const index = elementIndexFor(els);
      const boxes = els.filter(isBoxed);
      const arrows = els.filter((e): e is ArrowElement => e.type === 'arrow');
      expect(arrows).toHaveLength(stops - 1);
      for (const a of arrows) {
        const path = arrowPolyline(a, index);
        const ends = [a.from, a.to].map((ep) => (ep.kind === 'pinned' ? ep.elementId : ''));
        for (const b of boxes)
          if (!ends.includes(b.id))
            expect(pathPassesThrough(path, b), `${ends.join('→')} through ${b.id}`).toBe(false);
      }
    },
  );

  it('keeps a far arc off its nearer neighbours’ arcs, each a lane further out', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `s${i}`);
    const els = layoutGraph({
      style: 'cycle',
      nodes: ids.map((id) => ({ id, label: id })),
      edges: ids.slice(1).map((to) => ({ from: 's0', to })),
    });
    const index = elementIndexFor(els);
    const arrows = els.filter((e): e is ArrowElement => e.type === 'arrow');
    const far = (to: string) => {
      const a = arrows.find((x) => x.to.kind === 'pinned' && x.to.elementId === to)!;
      return Math.max(...arrowPolyline(a, index).map((p) => Math.hypot(p.x, p.y)));
    };
    expect(far('s3')).toBeGreaterThan(far('s2'));
  });

  it('keeps the ring its own size when one hub fits inside it', () => {
    const els = layoutGraph({
      style: 'cycle',
      nodes: ['a', 'b', 'c', 'hub'].map((id) => ({ id, label: id })),
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    }).filter(isBoxed);
    const top = els.find((b) => b.id === 'a')!;
    // The smallest ring, 200px to the top stop's centre.
    expect(top.y + top.height / 2).toBeCloseTo(-200, 5);
  });
});
