// Boxes swept into rows (docs/specs/024-agents/blueprints/edit-operations.md EO38): what the edit operations' `layout`
// does now that no arrow joins anything. The layered graph layout went with the arrows (docs/specs/002-project-scope/
// not-in-livehuddle.md "The element engine", part 4): a stored arrow is a retired element nothing reads, so every box is
// loose, and the sweep is the whole layout.

import { unionRects } from '@liveworkspace/model-core/geometry-primitives';
import { isBoxed, type BoxedElement, type Element } from './index';

// The gap between rows (and between a placed block and the rows under it), and between boxes in a row.
export const LAYER_GAP = 90;
export const SIBLING_GAP = 56;
// Rows wrap at the placed block's width, never narrower than this.
const MIN_ROW_WIDTH = 600;

// Row-wrap every box not in `exempt` below the exempt ones (or from the origin when none is exempt), capping rows at
// the exempt block's width so the sweep doesn't sprawl into a single endless line. `exempt` ids are deliberately
// placed boxes the sweep leaves alone but still avoids. A retired arrow is never moved.
export function sweepEdgelessNodes(elements: Element[], exempt?: ReadonlySet<string>): Element[] {
  const anchored = (id: string) => exempt?.has(id) ?? false;
  const loose = elements.filter((el): el is BoxedElement => isBoxed(el) && !anchored(el.id));
  if (loose.length === 0) return elements;
  const placed = elements.filter((el): el is BoxedElement => isBoxed(el) && anchored(el.id));
  const block = placed.length ? unionRects(placed) : null;
  const start = block ? { x: block.x, y: block.y + block.height + LAYER_GAP } : { x: 0, y: 0 };
  const rowCap = Math.max(block ? block.width : 0, MIN_ROW_WIDTH);
  const pos = new Map<string, { x: number; y: number }>();
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
