// The colour maths (a written colour to channels, contrast, tint and shade, the paper a colour amounts to): one
// copy for every product, @liveworkspace/element-model/colour-math.
export * from '@liveworkspace/element-model/colour-math';
// The element defaults (the colours, padding and controls an element has when it stores none): one table for every
// product, @liveworkspace/element-model/element-colours. What is liveplanner's own wraps them below.
export * from '@liveworkspace/element-model/element-colours';
import {
  acceptsInlineIcon as acceptsInlineIconOf,
  positionsInlineIcon as positionsInlineIconOf,
} from '@liveworkspace/element-model/element-colours';
import type { Element, ShapeElement, ShapeKind } from './index';
import { hasOwnFace } from './collab-shapes';

const ownFace = (kind: string) => hasOwnFace(kind as ShapeKind);

// The Collaborate elements that draw their own face (hasOwnFace: the collaboration cards, the session button, the
// picker...) never render an inline icon, so one folded in would be invisible. Dropped on them, it stands alone.
export function acceptsInlineIcon(element: Element): element is ShapeElement {
  return acceptsInlineIconOf(element, ownFace);
}

/** Whether a shape's inline icon goes where `iconPosition` says, so offering that choice does something. */
export function positionsInlineIcon(element: Element): boolean {
  return positionsInlineIconOf(element, ownFace);
}
