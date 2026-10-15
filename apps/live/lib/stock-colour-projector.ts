// The canvas's stock-colour resolution over a whole element list (docs/specs/007-editor/
// editor-modes.md "One look"): every colour stored by name drawn in its version for the canvas
// surface, on every tab and in either editor mode. Cached per source object, so an unchanged
// element keeps its identity between renders and the memoised element views stay quiet.
//
// Theme colours too (docs/specs/011-theme/light-and-dark.md): given the tab's theme map (themeViewMap), each colour the
// theme painted is drawn as the same slot in the viewer's half, before the stock colours resolve.
import {
  resolveStockColours,
  viewElementInTheme,
  type CanvasSurface,
  type Element,
} from '@livediagram/document';

const NO_THEME_MAP: ReadonlyMap<string, string> = new Map();

export function createStockColourProjector(): (
  elements: Element[],
  surface: CanvasSurface,
  themeMap?: ReadonlyMap<string, string>,
) => Element[] {
  let cacheSurface: CanvasSurface | null = null;
  let cacheMap: ReadonlyMap<string, string> | null = null;
  let cache = new WeakMap<Element, Element>();
  // The last board in and its projection: a render that changes no element (a pan, a zoom, a marquee
  // frame) gets the same array back, so nothing derived from the board recomputes.
  let lastIn: Element[] | null = null;
  let lastOut: Element[] = [];
  return (elements, surface, themeMap = NO_THEME_MAP) => {
    if (surface !== cacheSurface || themeMap !== cacheMap) {
      cacheSurface = surface;
      cacheMap = themeMap;
      cache = new WeakMap();
      lastIn = null;
    }
    if (elements === lastIn) return lastOut;
    let changed = false;
    const out = elements.map((el) => {
      let projected = cache.get(el);
      if (!projected) {
        projected = resolveStockColours(viewElementInTheme(el, themeMap), surface);
        cache.set(el, projected);
      }
      if (projected !== el) changed = true;
      return projected;
    });
    lastIn = elements;
    lastOut = changed ? out : elements;
    return lastOut;
  };
}
