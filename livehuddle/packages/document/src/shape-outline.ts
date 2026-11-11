// An element's visual body: the box a pointer test measures against. The drawn outlines of the diagram shapes
// (a circle's ellipse, a diamond's polygon) left with them (docs/specs/002-project-scope/not-in-livehuddle.md "The
// element engine", part 5), so every kept kind's outline is its box.

import { isTechIconId } from '@liveworkspace/icons';
import type { BoxedElement } from './index';
import { techIconMarkBounds } from '@liveworkspace/model-core/icon-size';
import { rotatePoint, type Point } from '@liveworkspace/model-core/geometry-primitives';

// The box treated as an element's visual body: a Technology icon's fixed-size mark
// (docs/specs/010-palette/technology-icons.md: the element box can be much larger than the visible chip), the
// element itself otherwise.
export function connectorBox(el: BoxedElement): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (el.type === 'shape' && el.shape === 'icon' && isTechIconId(el.iconId)) {
    return techIconMarkBounds(el);
  }
  return el;
}

// Whether `p` (world coordinates) lies inside the element's body by more than `inset` px. Rotation is undone about
// the element centre first.
export function pointInsideOutline(el: BoxedElement, p: Point, inset: number): boolean {
  const local = el.rotation
    ? rotatePoint(p, { x: el.x + el.width / 2, y: el.y + el.height / 2 }, -el.rotation)
    : p;
  const box = connectorBox(el);
  return (
    local.x > box.x + inset &&
    local.x < box.x + box.width - inset &&
    local.y > box.y + inset &&
    local.y < box.y + box.height - inset
  );
}
