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
  canvasSurface,
  elementPageTones,
  resolveStockColours,
  viewElementInTheme,
  type CanvasSurface,
  type Element,
  type LaidOutPage,
} from '@livedocuments/document';

const NO_THEME_MAP: ReadonlyMap<string, string> = new Map();

/** The surface of each element on a page with its own fill (elementPageSurfaces), the theme map
 *  for each surface (themeViewMap in that appearance), and, where known, that page's tone
 *  (elementPageTones), which a label with no fill of its own is read against. */
export type PageView = {
  surfaces: ReadonlyMap<string, CanvasSurface>;
  maps: Readonly<Record<CanvasSurface, ReadonlyMap<string, string>>>;
  tones?: ReadonlyMap<string, string>;
};

/** The page view of `elements` on `pages`: each one's page tone and the surface it makes, from one
 *  walk (elementPageTones). Undefined where no element sits on a filled page. */
export function pageViewOf(
  elements: Element[],
  pages: readonly LaidOutPage[],
  maps: PageView['maps'],
): PageView | undefined {
  const tones = elementPageTones(elements, pages);
  if (!tones.size) return undefined;
  const surfaces = new Map<string, CanvasSurface>();
  for (const [id, tone] of tones) surfaces.set(id, canvasSurface(tone));
  return { surfaces, maps, tones };
}

/** One element as drawn: on its page's surface where it has one, else on the canvas's. */
export function elementAsSeen(
  el: Element,
  surface: CanvasSurface,
  themeMap: ReadonlyMap<string, string>,
  pageView?: PageView,
): Element {
  const onPage = pageView?.surfaces.get(el.id);
  return onPage
    ? resolveStockColours(
        viewElementInTheme(el, pageView!.maps[onPage], pageView!.tones?.get(el.id)),
        onPage,
      )
    : resolveStockColours(viewElementInTheme(el, themeMap), surface);
}

export function createStockColourProjector(): (
  elements: Element[],
  surface: CanvasSurface,
  themeMap?: ReadonlyMap<string, string>,
  pageView?: PageView,
) => Element[] {
  let cacheSurface: CanvasSurface | null = null;
  let cacheMap: ReadonlyMap<string, string> | null = null;
  let cacheMaps: PageView['maps'] | null = null;
  // Each element's projection and the page surface and tone it was drawn for ('' off a filled page), so an
  // element moved onto another page is drawn afresh without dropping everyone else's.
  let cache = new WeakMap<Element, { on: string; out: Element }>();
  // The last board in and its projection: a render that changes no element (a pan, a zoom, a marquee
  // frame) gets the same array back, so nothing derived from the board recomputes.
  let lastIn: Element[] | null = null;
  let lastOut: Element[] = [];
  let lastSurfaces: PageView['surfaces'] | null = null;
  return (elements, surface, themeMap = NO_THEME_MAP, pageView) => {
    const maps = pageView?.maps ?? null;
    if (surface !== cacheSurface || themeMap !== cacheMap || maps !== cacheMaps) {
      cacheSurface = surface;
      cacheMap = themeMap;
      cacheMaps = maps;
      cache = new WeakMap();
      lastIn = null;
    }
    const surfaces = pageView?.surfaces ?? null;
    if (elements === lastIn && surfaces === lastSurfaces) return lastOut;
    lastSurfaces = surfaces;
    let changed = false;
    const out = elements.map((el) => {
      const on = `${surfaces?.get(el.id) ?? ''}${pageView?.tones?.get(el.id) ?? ''}`;
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
    return lastOut;
  };
}
