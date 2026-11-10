import { unionRects, type Rect } from '@liveworkspace/model-core/geometry-primitives';
import { isBoxed, type BoxedElement, type Element, type ElementId } from './element';

// Layer order: moving one element, or a set, to the top or bottom of the
// paint order. (This module used to hold groups too; docs/specs/009-elements/web-components-and-no-groups.md removed them.)

export function bringToFront<E extends Element>(elements: E[], id: ElementId): E[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [...elements.filter((e) => e.id !== id), el];
}

export function sendToBack<E extends Element>(elements: E[], id: ElementId): E[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [el, ...elements.filter((e) => e.id !== id)];
}

export function bringManyToFront<E extends Element>(elements: E[], ids: Set<ElementId>): E[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...others, ...members];
}

export function sendManyToBack<E extends Element>(elements: E[], ids: Set<ElementId>): E[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...members, ...others];
}

// Union bounding box of multiple boxed elements. Returns null if no boxed
// elements were found.
export function unionBoxedBounds(elements: Element[], ids: ReadonlySet<ElementId>): Rect | null {
  return unionRects(elements.filter((el): el is BoxedElement => ids.has(el.id) && isBoxed(el)));
}
