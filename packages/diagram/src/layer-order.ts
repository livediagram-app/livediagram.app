import { unionRects, type Rect } from './geometry-primitives';
import { isBoxed, type BoxedElement, type Element, type ElementId } from './index';

// Layer order: moving one element, or a set, to the top or bottom of the
// paint order. (This module used to hold groups too; spec/147 removed them.)

export function bringToFront(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [...elements.filter((e) => e.id !== id), el];
}

export function sendToBack(elements: Element[], id: ElementId): Element[] {
  const el = elements.find((e) => e.id === id);
  if (!el) return elements;
  return [el, ...elements.filter((e) => e.id !== id)];
}

export function bringManyToFront(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...others, ...members];
}

export function sendManyToBack(elements: Element[], ids: Set<ElementId>): Element[] {
  const members = elements.filter((e) => ids.has(e.id));
  const others = elements.filter((e) => !ids.has(e.id));
  return [...members, ...others];
}

// Union bounding box of multiple boxed elements. Returns null if no boxed
// elements were found.
export function unionBoxedBounds(elements: Element[], ids: Set<ElementId>): Rect | null {
  return unionRects(elements.filter((el): el is BoxedElement => ids.has(el.id) && isBoxed(el)));
}
