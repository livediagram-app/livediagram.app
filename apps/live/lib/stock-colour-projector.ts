// The canvas's stock-colour resolution over a whole element list (docs/specs/007-editor/
// editor-modes.md "One look"): every colour stored by name drawn in its version for the canvas
// surface, on every tab and in either editor mode. Cached per source object, so an unchanged
// element keeps its identity between renders and the memoised element views stay quiet.
//
// Theme colours too (docs/specs/011-theme/light-and-dark.md): given the tab's theme map (themeViewMap), each colour the
// theme painted is drawn as the same slot in the viewer's half, before the stock colours resolve. Given the stored and the
// drawn canvas, a label that redraw sank into what is behind it is drawn in an ink that reads there ("A theme never
// sinks a label into what is behind it").
//
// An element on a page with a fill of its own (docs/specs/011-theme/light-and-dark.md "A page's own paper") is
// drawn for that page, not for the viewer's chrome: its theme colours in the half that matches the page's
// surface, its stock colours for that surface, so a light slide in dark chrome keeps dark words.
import {
  resolveStockColours,
  viewElementInTheme,
  withReadableLabelInks,
  type CanvasSurface,
  type Element,
} from '@livediagram/document';

const NO_THEME_MAP: ReadonlyMap<string, string> = new Map();

/** The surface of each element on a page with its own fill (elementPageSurfaces), and the theme map
 *  for each surface (themeViewMap in that appearance). */
export type PageView = {
  surfaces: ReadonlyMap<string, CanvasSurface>;
  maps: Readonly<Record<CanvasSurface, ReadonlyMap<string, string>>>;
};

/** One element as drawn: on its page's surface where it has one, else on the canvas's. */
export function elementAsSeen(
  el: Element,
  surface: CanvasSurface,
  themeMap: ReadonlyMap<string, string>,
  pageView?: PageView,
): Element {
  const onPage = pageView?.surfaces.get(el.id);
  return onPage
    ? resolveStockColours(viewElementInTheme(el, pageView!.maps[onPage]), onPage)
    : resolveStockColours(viewElementInTheme(el, themeMap), surface);
}

export function createStockColourProjector(): (
  elements: Element[],
  surface: CanvasSurface,
  themeMap?: ReadonlyMap<string, string>,
  canvases?: { stored: string; drawn: string },
  pageView?: PageView,
) => Element[] {
  let cacheSurface: CanvasSurface | null = null;
  let cacheMap: ReadonlyMap<string, string> | null = null;
  let cacheCanvases = '';
  let cacheMaps: PageView['maps'] | null = null;
  // Each element's projection and the page surface it was drawn for ('' off a filled page), so an
  // element moved onto another page is drawn afresh without dropping everyone else's.
  let cache = new WeakMap<Element, { on: string; out: Element }>();
  // Each projected label's re-inked version (withReadableLabelInks), so an unchanged label keeps its identity.
  let inkCache = new WeakMap<Element, Element>();
  // The last board in and its projection: a render that changes no element (a pan, a zoom, a marquee
  // frame) gets the same array back, so nothing derived from the board recomputes.
  let lastIn: Element[] | null = null;
  let lastOut: Element[] = [];
  let lastSurfaces: PageView['surfaces'] | null = null;
  return (elements, surface, themeMap = NO_THEME_MAP, canvases, pageView) => {
    const canvasKey = canvases ? `${canvases.stored}|${canvases.drawn}` : '';
    const maps = pageView?.maps ?? null;
    if (
      surface !== cacheSurface ||
      themeMap !== cacheMap ||
      canvasKey !== cacheCanvases ||
      maps !== cacheMaps
    ) {
      cacheSurface = surface;
      cacheMap = themeMap;
      cacheCanvases = canvasKey;
      cacheMaps = maps;
      cache = new WeakMap();
      inkCache = new WeakMap();
      lastIn = null;
    }
    const surfaces = pageView?.surfaces ?? null;
    if (elements === lastIn && surfaces === lastSurfaces) return lastOut;
    lastSurfaces = surfaces;
    let changed = false;
    const out = elements.map((el) => {
      const on = surfaces?.get(el.id) ?? '';
      const hit = cache.get(el);
      let projected = hit?.on === on ? hit.out : undefined;
      if (!projected) {
        projected = elementAsSeen(el, surface, themeMap, pageView);
        cache.set(el, { on, out: projected });
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
