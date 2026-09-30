// The whiteboard's ink projection over a whole element list (docs/specs/023-whiteboard/whiteboard.md
// "Appearance"), cached per source object so an unchanged element keeps its
// identity between renders and the memoised element views stay quiet.
import { inkWhiteboardElement, type Element } from '@livediagram/document';

export function createInkProjector(): (elements: Element[], ink: string) => Element[] {
  let cacheInk: string | null = null;
  let cache = new WeakMap<Element, Element>();
  return (elements, ink) => {
    if (ink !== cacheInk) {
      cacheInk = ink;
      cache = new WeakMap();
    }
    let changed = false;
    const out = elements.map((el) => {
      let projected = cache.get(el);
      if (!projected) {
        projected = inkWhiteboardElement(el, ink);
        cache.set(el, projected);
      }
      if (projected !== el) changed = true;
      return projected;
    });
    return changed ? out : elements;
  };
}
