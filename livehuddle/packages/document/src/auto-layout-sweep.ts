// Boxes no arrow joins, swept into rows below a layout (docs/specs/024-agents/blueprints/edit-operations.md EO38).

import { LAYER_GAP, SIBLING_GAP, type Pt } from './auto-layout-shared';
import { unionRects, type Rect } from '@liveworkspace/model-core/geometry-primitives';
import { isBoxed, type BoxedElement, type Element } from './index';

// Every caller passes a non-empty block, so the union is never null.
const bbox = (els: BoxedElement[]): Rect => unionRects(els)!;

// autoLayoutElements only positions nodes an arrow touches; edgeless nodes
// keep their given position. The edit operations' `layout` sweeps them into rows below the placed
// content instead (docs/specs/024-agents/blueprints/edit-operations.md EO38). `exempt` ids are
// deliberately-placed nodes the sweep must leave alone but still avoid.
export function sweepEdgelessNodes(elements: Element[], exempt?: Set<string>): Element[] {
  const touched = new Set<string>();
  for (const el of elements) {
    if (el.type !== 'arrow') continue;
    // A loop back to its own node places nothing (the layout drops it), so a node with only that is still loose:
    // counted, it stayed at the origin, over the first placed node.
    if (
      el.from.kind === 'pinned' &&
      el.to.kind === 'pinned' &&
      el.from.elementId === el.to.elementId
    )
      continue;
    if (el.from.kind === 'pinned') touched.add(el.from.elementId);
    if (el.to.kind === 'pinned') touched.add(el.to.elementId);
  }
  const anchored = (id: string) => touched.has(id) || (exempt?.has(id) ?? false);
  const loose = elements.filter((el): el is BoxedElement => isBoxed(el) && !anchored(el.id));
  if (loose.length === 0) return elements;
  const placed = elements.filter((el): el is BoxedElement => isBoxed(el) && anchored(el.id));

  // Row-wrap the loose nodes below the placed block (or from the origin when
  // everything is loose), capping rows at the block's width so the sweep
  // doesn't sprawl into a single endless line.
  const block = placed.length ? bbox(placed) : null;
  const start = block ? { x: block.x, y: block.y + block.height + LAYER_GAP } : { x: 0, y: 0 };
  const rowCap = Math.max(block ? block.width : 0, 600);
  const pos = new Map<string, Pt>();
  let x = 0;
  let y = start.y;
  let rowH = 0;
  for (const el of loose) {
    if (x > 0 && x + el.width > rowCap) {
      x = 0;
      y += rowH + SIBLING_GAP;
      rowH = 0;
    }
    pos.set(el.id, { x: start.x + x, y });
    x += el.width + SIBLING_GAP;
    rowH = Math.max(rowH, el.height);
  }
  return elements.map((el) => {
    const p = pos.get(el.id);
    return p && isBoxed(el) ? { ...el, x: p.x, y: p.y } : el;
  });
}
