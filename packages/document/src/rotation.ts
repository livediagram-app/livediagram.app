// Which elements can be rotated (docs/specs/008-canvas/canvas-and-palette.md, the Rotation category).
// Every boxed element carries `rotation` except an annotation marker: it is a round numbered pin, so
// turning it only turns its number (docs/specs/009-elements/blueprints/annotations.md [QD8]). One
// predicate gates the element menu's Rotation category, the Rotate commands and the rotation write,
// so no surface can offer what another refuses.

import { boundsOfPoints, rotatePoint, type Rect } from './geometry-primitives';
import { isBoxed, type BoxedElement, type Element } from './index';

export function supportsRotation(el: Element): el is BoxedElement {
  return isBoxed(el) && el.type !== 'annotation';
}

// The box around a boxed element as the canvas draws it: its four corners turned by its rotation about
// its centre (rotatePoint, the same turn the canvas's CSS applies), or its own box when unrotated or
// not rotatable. The marquee tests containment against this, so a rotated element whose drawn corners
// stick out of the swept box is not selected, and one wholly inside it is.
export function drawnBounds(el: BoxedElement): Rect {
  const box = { x: el.x, y: el.y, width: el.width, height: el.height };
  const rotation = supportsRotation(el) ? (el.rotation ?? 0) : 0;
  if (rotation % 360 === 0) return box;
  const center = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const corners = [
    { x: el.x, y: el.y },
    { x: el.x + el.width, y: el.y },
    { x: el.x + el.width, y: el.y + el.height },
    { x: el.x, y: el.y + el.height },
  ].map((p) => rotatePoint(p, center, rotation));
  return boundsOfPoints(corners)!;
}
