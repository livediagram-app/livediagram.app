// Where an article's writing sits on its pages (docs/specs/007-editor/article-pages.md "Flowing
// onto pages"): one box over the article's pages, laid in columns, one column a page's text area
// (the page less its margins), the gap between two columns the margins and the space between the
// pages. The browser breaks the writing into those columns; these helpers map between a place in
// the box and a place on a page. Pure.
import {
  ARTICLE_TOP_MIN_PX,
  articleMarginPx,
  ILLUSTRATE_PAGE_GAP,
  type ArticleStyle,
  type LaidOutPage,
} from '@livediagram/document';

export type FlowFrame = {
  // The box's top-left on the canvas, and its size, in canvas px.
  x: number;
  y: number;
  width: number;
  height: number;
  // A column's width, the gap between columns, and one column plus one gap.
  columnWidth: number;
  gap: number;
  stride: number;
  margin: number;
  // The top margin: the margin, never less than ARTICLE_TOP_MIN_PX.
  top: number;
  // How many pages (columns) the article has.
  count: number;
};

/** The frame over an article's pages (all one size, in a row, in order). */
export function flowFrame(pages: readonly LaidOutPage[], margin: number): FlowFrame {
  const lead = pages[0]!;
  const { width: pageW, height: pageH } = lead.rect;
  // A margin never leaves a column narrower than a quarter of the page.
  const m = Math.min(margin, pageW * 0.375, pageH * 0.375);
  // The top keeps room for the page toolbar above the first line (articleTopMarginPx).
  const top = Math.min(Math.max(m, ARTICLE_TOP_MIN_PX), pageH * 0.375);
  const columnWidth = pageW - 2 * m;
  const gap = 2 * m + ILLUSTRATE_PAGE_GAP;
  const count = pages.length;
  return {
    x: lead.rect.x + m,
    y: lead.rect.y + top,
    width: count * columnWidth + (count - 1) * gap,
    height: pageH - top - m,
    top,
    columnWidth,
    gap,
    stride: columnWidth + gap,
    margin: m,
    count,
  };
}

/** The column (0 first) a point in the box lies in, by its x from the box's left. */
export function columnAt(frame: FlowFrame, localX: number): number {
  return Math.max(0, Math.floor((localX + frame.gap / 2) / frame.stride));
}

/** A spot in the box as a place on a page: the page's index and the spot from the page's top-left
 *  corner (canvas px). A column past the article's pages keeps its index (the writing reaching
 *  pages not there yet). */
export function pagePlaceOf(
  frame: FlowFrame,
  local: { x: number; y: number },
): { index: number; x: number; y: number } {
  const index = columnAt(frame, local.x);
  return { index, x: local.x - index * frame.stride + frame.margin, y: local.y + frame.top };
}

/** The canvas point of a place on one of the article's pages. */
export function canvasPointOf(
  pages: readonly LaidOutPage[],
  place: { page: string; x: number; y: number },
): { x: number; y: number } | null {
  const page = pages.find((p) => p.id === place.page);
  return page ? { x: page.rect.x + place.x, y: page.rect.y + place.y } : null;
}

/** The text width before an article is laid out (no pages of its own yet), canvas px: about an A4
 *  page's column at Normal margins. */
export const ARTICLE_FALLBACK_TEXT_WIDTH = 600;

/** An article's text width (one column), from its pages laid out among `pages`. */
export function articleTextWidth(
  pages: readonly LaidOutPage[],
  flow: string,
  style: ArticleStyle | undefined,
): number {
  const own = pages.filter((p) => p.flow === flow);
  return own.length
    ? flowFrame(own, articleMarginPx(style)).columnWidth
    : ARTICLE_FALLBACK_TEXT_WIDTH;
}
