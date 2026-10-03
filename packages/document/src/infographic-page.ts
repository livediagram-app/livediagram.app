// The page Infographic mode draws the canvas as (docs/specs/007-editor/editor-modes.md "The
// page"): an A4 sheet at the canvas origin, portrait or landscape. The orientation is the tab's
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

/** The A4 page's rect in canvas coordinates, anchored at the origin. */
export function infographicPageRect(orientation: PageOrientation): PageRect {
  const portrait = orientation === 'portrait';
  return {
    x: 0,
    y: 0,
    width: portrait ? A4_SHORT_SIDE : A4_LONG_SIDE,
    height: portrait ? A4_LONG_SIDE : A4_SHORT_SIDE,
  };
}
