// The page Infographic mode draws the canvas as (docs/specs/007-editor/editor-modes.md "The
// page"): an A4 sheet centred on the canvas origin, portrait or landscape. The orientation is the tab's
// (`Tab.pageOrientation`, portrait when absent) so everyone lays out on the same page; the sheet
// itself is a view, never stored as an element.

export type PageOrientation = 'portrait' | 'landscape';

export const PAGE_ORIENTATIONS: readonly PageOrientation[] = ['portrait', 'landscape'];

// A4 is 210 x 297 mm; at the CSS 96 px per inch that is 793.7 x 1122.5, rounded to whole pixels.
export const A4_SHORT_SIDE = 794;
export const A4_LONG_SIDE = 1123;

export type PageRect = { x: number; y: number; width: number; height: number };

export function isPageOrientation(v: unknown): v is PageOrientation {
  return v === 'portrait' || v === 'landscape';
}

/** The tab's page orientation: portrait unless it says landscape. */
export function pageOrientationOf(tab: { pageOrientation?: unknown } | undefined): PageOrientation {
  return isPageOrientation(tab?.pageOrientation) ? tab.pageOrientation : 'portrait';
}

/** The A4 page's rect in canvas coordinates, centred on the origin, so turning it keeps its
 *  centre where it was. */
export function infographicPageRect(orientation: PageOrientation): PageRect {
  const portrait = orientation === 'portrait';
  const width = portrait ? A4_SHORT_SIDE : A4_LONG_SIDE;
  const height = portrait ? A4_LONG_SIDE : A4_SHORT_SIDE;
  return { x: -width / 2, y: -height / 2, width, height };
}

/** The box the view fits to frame the page: a square of the long side, centred on the origin, so
 *  either orientation fits at the same zoom and turning the page never moves the view. */
export function infographicPageFitBox(): PageRect {
  return { x: -A4_LONG_SIDE / 2, y: -A4_LONG_SIDE / 2, width: A4_LONG_SIDE, height: A4_LONG_SIDE };
}

/** Whether a canvas point lies on the page (its edges included). */
export function isOnInfographicPage(
  orientation: PageOrientation,
  point: { x: number; y: number },
): boolean {
  const r = infographicPageRect(orientation);
  return point.x >= r.x && point.x <= r.x + r.width && point.y >= r.y && point.y <= r.y + r.height;
}
