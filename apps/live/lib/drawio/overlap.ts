// Whether a draw.io vertex overlaps another (spec "Opacity over paper", D41): a translucent shape
// over or under something else keeps its opacity, because seeing through it matters there.

import { absoluteRect, type DrawioGraph, type Rect } from './cells';

const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A memoised test over the page's visible vertices, ancestors and descendants left out. */
export function overlapTest(graph: DrawioGraph): (cellId: string) => boolean {
  const memo = new Map<string, boolean>();
  let vertices: { id: string; rect: Rect }[] | null = null;
  const ancestorsOf = (id: string) => {
    const out = new Set<string>();
    for (let p = graph.cells.get(id)?.parentId; p; p = graph.cells.get(p)?.parentId) out.add(p);
    return out;
  };
  return (cellId) => {
    const known = memo.get(cellId);
    if (known !== undefined) return known;
    vertices ??= [...graph.cells.values()]
      .filter((c) => c.vertex && c.visible && c.geometry)
      .flatMap((c) => {
        const rect = absoluteRect(graph, c.id);
        return rect ? [{ id: c.id, rect }] : [];
      });
    const own = absoluteRect(graph, cellId);
    const mine = ancestorsOf(cellId);
    const hit =
      own !== null &&
      vertices.some(
        (v) =>
          v.id !== cellId &&
          !mine.has(v.id) &&
          !ancestorsOf(v.id).has(cellId) &&
          intersects(own, v.rect),
      );
    memo.set(cellId, hit);
    return hit;
  };
}
