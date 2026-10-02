// The canvas's stock-colour resolution over a whole element list (docs/specs/007-editor/
// editor-modes.md "One look"): every colour stored by name drawn in its version for the canvas
// surface, on every tab and in either editor mode. Cached per source object, so an unchanged
// element keeps its identity between renders and the memoised element views stay quiet.
import { resolveStockColours, type CanvasSurface, type Element } from '@livediagram/document';

export function createStockColourProjector(): (
  elements: Element[],
  surface: CanvasSurface,
) => Element[] {
  let cacheSurface: CanvasSurface | null = null;
  let cache = new WeakMap<Element, Element>();
  return (elements, surface) => {
    if (surface !== cacheSurface) {
      cacheSurface = surface;
      cache = new WeakMap();
    }
    let changed = false;
    const out = elements.map((el) => {
      let projected = cache.get(el);
      if (!projected) {
        projected = resolveStockColours(el, surface);
        cache.set(el, projected);
      }
      if (projected !== el) changed = true;
      return projected;
    });
    return changed ? out : elements;
  };
}
