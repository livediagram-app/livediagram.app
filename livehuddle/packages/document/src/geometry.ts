import {
  isBoxed,
  retiredArrowBounds,
  type BoxedElement,
  type Element,
  type ElementId,
} from './index';
import { connectorBox } from './shape-outline';
import type { Rect } from '@liveworkspace/model-core/geometry-primitives';

// --- Geometry helpers ------------------------------------------------------

// The dependency-free primitives (Point, Rect, clamp, rect tests, unions)
// live in a leaf module so modules that must not import the barrel at
// runtime (shadow.ts, web-components.ts) can still share them.
export * from '@liveworkspace/model-core/geometry-primitives';

export function centreOf(el: BoxedElement): { x: number; y: number } {
  const box = connectorBox(el);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// An id -> element lookup. Callers that resolve many endpoints over
// the same element set (every arrow on a render, every arrow on a
// marquee sweep) build this once and pass it instead of the raw
// array, turning each endpoint resolution from an O(n) `find` into an
// O(1) `get`.
export type ElementIndex = ReadonlyMap<ElementId, Element>;

// `instanceof Map` alone narrows a ReadonlyMap to Map<any, any>.
export const isElementIndex = (elements: Element[] | ElementIndex): elements is ElementIndex =>
  elements instanceof Map;

export function buildElementIndex(elements: Element[]): Map<ElementId, Element> {
  const index = new Map<ElementId, Element>();
  for (const el of elements) index.set(el.id, el);
  return index;
}

// Accepts either the raw element array or a prebuilt index; an array is looked up through its
// cached index (elementIndexFor), so a per-element loop over one board stays O(n).
// One id index per element list, built on first ask and reused while the list is the same array, as
// `elementGridFor` keeps one grid (board arrays are never mutated in place): resolving the ends of
// every arrow on a board then looks ids up instead of scanning the list once per end.
const indexCache = new WeakMap<readonly Element[], Map<ElementId, Element>>();
export function elementIndexFor(elements: readonly Element[]): ElementIndex {
  let index = indexCache.get(elements);
  if (!index) {
    index = buildElementIndex(elements as Element[]);
    indexCache.set(elements, index);
  }
  return index;
}

// A boxed element's own box; a stored arrow's line and placeholder card together (./retired-arrow).
export function elementBounds(element: Element, elements: Element[]): Rect {
  if (isBoxed(element)) {
    return { x: element.x, y: element.y, width: element.width, height: element.height };
  }
  return retiredArrowBounds(element, elementIndexFor(elements));
}
