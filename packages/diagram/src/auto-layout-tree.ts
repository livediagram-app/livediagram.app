// Tree layout style (spec/47 "Layout styles"): a tidy org-chart. Top-to-
// bottom, every parent centred over its own children, the property the
// layered flow layout can't guarantee (it centres each rank against the
// widest rank, so a parent can drift off its own reports).
//
// Geometry hangs off a BFS spanning forest rooted at the in-degree-0 nodes;
// extra in-edges and cycles stay out of the skeleton and their arrows simply
// re-anchor across the result.

import { type ElementId } from './index';
import {
  LAYER_GAP,
  SIBLING_GAP,
  pushTo,
  spanningForest,
  type Edge,
  type PlacedComponent,
  type Pt,
  type Size,
} from './auto-layout-shared';

// Roots for the spanning forest: in-degree-0 nodes (classic tree roots). A
// fully cyclic component has none, so fall back to the node with the best
// out-minus-in balance (ties → input order) to get a deterministic anchor.
function treeRoots(ids: ElementId[], edges: Edge[]): ElementId[] {
  const indeg = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  const outdeg = new Map<ElementId, number>(ids.map((id) => [id, 0]));
  for (const e of edges) {
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    outdeg.set(e.from, (outdeg.get(e.from) ?? 0) + 1);
  }
  const roots = ids.filter((id) => indeg.get(id) === 0);
  if (roots.length > 0) return roots;
  let best = ids[0]!;
  for (const id of ids) {
    if (outdeg.get(id)! - indeg.get(id)! > outdeg.get(best)! - indeg.get(best)!) best = id;
  }
  return [best];
}

// Place one component as a top-to-bottom tidy tree. Multiple roots lay out
// side by side (siblings under an implicit virtual root).
export function positionTreeComponent(
  ids: ElementId[],
  edges: Edge[],
  size: Map<ElementId, Size>,
  centers: Map<ElementId, Pt>,
): PlacedComponent {
  const roots = treeRoots(ids, edges);
  const children = spanningForest(ids, edges, roots);
  // Deterministic sibling order that respects the user's rough left-to-right
  // intent, same cheap crossing reduction the flow layout uses.
  const crossOf = (id: ElementId) => centers.get(id)!.x;
  for (const kids of children.values()) kids.sort((a, b) => crossOf(a) - crossOf(b));
  const orderedRoots = [...roots].sort((a, b) => crossOf(a) - crossOf(b));

  // Depth per node (root = 0) so ranks can share a vertical band even when
  // sibling subtrees have different heights per level.
  const depth = new Map<ElementId, number>();
  const walkDepth = (id: ElementId, d: number) => {
    depth.set(id, d);
    for (const k of children.get(id)!) walkDepth(k, d + 1);
  };
  for (const r of orderedRoots) walkDepth(r, 0);

  const byDepth = new Map<number, ElementId[]>();
  for (const id of ids) pushTo(byDepth, depth.get(id)!, id);
  const rowTop = new Map<number, number>();
  const rowH = new Map<number, number>();
  let y = 0;
  for (let d = 0; byDepth.has(d); d++) {
    const h = Math.max(...byDepth.get(d)!.map((id) => size.get(id)!.h));
    rowTop.set(d, y);
    rowH.set(d, h);
    y += h + LAYER_GAP;
  }

  // Post-order horizontal extent of each subtree, then a pre-order walk that
  // packs children left-to-right and centres the parent over their span.
  const extent = new Map<ElementId, number>();
  const measure = (id: ElementId): number => {
    const kids = children.get(id)!;
    const own = size.get(id)!.w;
    if (kids.length === 0) {
      extent.set(id, own);
      return own;
    }
    let total = 0;
    for (const k of kids) total += measure(k) + SIBLING_GAP;
    total -= SIBLING_GAP;
    const e = Math.max(own, total);
    extent.set(id, e);
    return e;
  };

  const pos = new Map<ElementId, Pt>();
  const place = (id: ElementId, left: number) => {
    const d = depth.get(id)!;
    const e = extent.get(id)!;
    const s = size.get(id)!;
    const y = rowTop.get(d)! + (rowH.get(d)! - s.h) / 2;
    const kids = children.get(id)!;
    if (kids.length === 0) {
      pos.set(id, { x: left + (e - s.w) / 2, y });
      return;
    }
    // Children first, packed within this extent; then the parent centred on
    // the midpoint of its first and last child (Reingold-Tilford style, so
    // uneven subtree widths don't drag the parent off its own reports),
    // clamped to stay inside the extent.
    const kidsTotal =
      kids.reduce((sum, k) => sum + extent.get(k)!, 0) + (kids.length - 1) * SIBLING_GAP;
    let cursor = left + (e - kidsTotal) / 2;
    for (const k of kids) {
      place(k, cursor);
      cursor += extent.get(k)! + SIBLING_GAP;
    }
    const first = pos.get(kids[0]!)!;
    const last = pos.get(kids[kids.length - 1]!)!;
    const mid =
      (first.x + size.get(kids[0]!)!.w / 2 + last.x + size.get(kids[kids.length - 1]!)!.w / 2) / 2;
    const x = Math.max(left, Math.min(left + e - s.w, mid - s.w / 2));
    pos.set(id, { x, y });
  };

  let left = 0;
  for (const r of orderedRoots) {
    measure(r);
    place(r, left);
    left += extent.get(r)! + SIBLING_GAP;
  }

  return { pos, width: Math.max(0, left - SIBLING_GAP), height: Math.max(0, y - LAYER_GAP) };
}
