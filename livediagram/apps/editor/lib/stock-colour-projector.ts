// The canvas's stock-colour resolution over a whole element list (docs/specs/007-editor/
// editor-modes.md "One look"): every colour stored by name drawn in its version for the canvas
// surface, on every tab and in either editor mode. Cached per source object, so an unchanged
// element keeps its identity between renders and the memoised element views stay quiet.
//
// Theme colours too (docs/specs/011-theme/light-and-dark.md): given the tab's theme map (themeViewMap), each colour the
// theme painted is drawn as the same slot in the viewer's half, before the stock colours resolve. Given the stored and the
// drawn canvas, a label that redraw sank into what is behind it is drawn in an ink that reads there ("A theme never
// sinks a label into what is behind it").
import {
  elementAsSeen,
  withReadableLabelInks,
  type CanvasSurface,
  type Element,
} from '@livediagram/document';

const NO_THEME_MAP: ReadonlyMap<string, string> = new Map();

export function createStockColourProjector(): (
  elements: Element[],
  surface: CanvasSurface,
  themeMap?: ReadonlyMap<string, string>,
  canvases?: { stored: string; drawn: string },
) => Element[] {
  let cacheSurface: CanvasSurface | null = null;
  let cacheMap: ReadonlyMap<string, string> | null = null;
  let cacheCanvases = '';
  // Each element's projection.
  let cache = new WeakMap<Element, Element>();
  // Each projected label's re-inked version (withReadableLabelInks), so an unchanged label keeps its identity.
  let inkCache = new WeakMap<Element, Element>();
  // The last board in and its projection: a render that changes no element (a pan, a zoom, a marquee
  // frame) gets the same array back, so nothing derived from the board recomputes.
  let lastIn: Element[] | null = null;
  let lastOut: Element[] = [];
  return (elements, surface, themeMap = NO_THEME_MAP, canvases) => {
    const canvasKey = canvases ? `${canvases.stored}|${canvases.drawn}` : '';
    if (surface !== cacheSurface || themeMap !== cacheMap || canvasKey !== cacheCanvases) {
      cacheSurface = surface;
      cacheMap = themeMap;
      cacheCanvases = canvasKey;
      cache = new WeakMap();
      inkCache = new WeakMap();
      lastIn = null;
    }
    if (elements === lastIn) return lastOut;
    let changed = false;
    const out = elements.map((el) => {
      let projected = cache.get(el);
      if (!projected) {
        projected = elementAsSeen(el, surface, themeMap);
        cache.set(el, projected);
      }
      if (projected !== el) changed = true;
      return projected;
    });
    lastIn = elements;
    lastOut = changed ? out : elements;
    // Labels against what is behind them: only when the redraw changed an element or the canvas, so a tab drawn as
    // stored is free. A label given the same ink as last time keeps last time's object, so its view stays quiet.
    if (canvases && (changed || canvases.stored !== canvases.drawn)) {
      const inked = withReadableLabelInks(elements, canvases.stored, lastOut, canvases.drawn);
      if (inked !== lastOut)
        lastOut = inked.map((el, i) => {
          if (el === lastOut[i]) return el;
          const prior = inkCache.get(lastOut[i]!);
          if (
            prior &&
            (prior as { textColor?: string }).textColor === (el as { textColor?: string }).textColor
          )
            return prior;
          inkCache.set(lastOut[i]!, el);
          return el;
        });
    }
    return lastOut;
  };
}
