import { isBoxed, type Anchor, type Element, type ElementId } from './index';
import { bestAnchorTowards } from './anchor-choice';
import { isChipShape } from './chip';
import { isContainerKind } from './containment';
import type { Point } from './geometry-primitives';
import { pointInsideOutline } from './shape-outline';

// An arrow end over a shape's body, away from its anchors (docs/specs/008-canvas/canvas-and-palette.md "Dropped on
// a shape"): it pins to the anchor it would enter through, facing `towards` (the arrow's other end), the choice
// click-to-connect makes. Left free inside, the head hid under the shape and nothing connected.
//
// The topmost shape whose outline holds the point, skipping what an end is drawn across rather than onto: a
// container (a stack), whose members' arrows run inside it; a badge or step chip, which no
// arrow ends on; and `skipId`, the shape the other end is already on, so a new arrow drawn out of it does not loop
// back while it leaves. A picture or a drawing (image, freehand) is skipped too: an arrow released inside one
// points at something in it, as it always has. Null when no shape is under the point.
const POINTED_INTO: ReadonlySet<Element['type']> = new Set(['image', 'freehand']);

export function bodyDropAnchor(
  point: Point,
  elements: readonly Element[],
  towards: Point,
  skipId: ElementId | null,
): { elementId: ElementId; anchor: Anchor } | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (!isBoxed(el) || el.id === skipId || POINTED_INTO.has(el.type)) continue;
    if (el.type === 'shape' && (isContainerKind(el.shape) || isChipShape(el.shape))) continue;
    // An unrotated box rejected by its bounds first: the outline test is the costly part, and most shapes are far.
    const outside =
      point.x < el.x || point.x > el.x + el.width || point.y < el.y || point.y > el.y + el.height;
    if (outside && !el.rotation) continue;
    if (pointInsideOutline(el, point, 0)) {
      return { elementId: el.id, anchor: bestAnchorTowards(el, towards) };
    }
  }
  return null;
}
