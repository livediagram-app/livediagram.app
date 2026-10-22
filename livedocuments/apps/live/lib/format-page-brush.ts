// The Format tool on pages (docs/specs/007-editor/pages-mode.md "Copying a
// background"): a press on a page's paper arms that page's background as the brush, and each later
// press on another page paints it there. The brush is the Format tool's one source, so a page is
// held in the same slot as an element, marked so the two never meet: leaving the tool, Done or an
// empty-canvas press empty it either way, and an element pressed under a page brush (or a page
// under an element brush) is a no-op that keeps it, as a shape's look onto an arrow is.

const PAGE_BRUSH = 'page-brush:';

/** The brush that holds a page's background. */
export const pageBrush = (pageId: string) => `${PAGE_BRUSH}${pageId}`;

/** The page a brush holds, or null for an element's (or no) brush. */
export function brushPageId(sourceId: string | null): string | null {
  return sourceId?.startsWith(PAGE_BRUSH) ? sourceId.slice(PAGE_BRUSH.length) : null;
}

/** The Format banner's line: what to press next. */
export function formatBannerMessage(sourceId: string | null, pages: boolean): string {
  if (brushPageId(sourceId)) return 'Tap pages to paint this background onto them';
  if (sourceId) return 'Tap elements to paint this style onto them';
  return pages
    ? 'Select a base element or page to copy its style'
    : 'Select a base element to copy its style';
}

/** A press on a page's paper with the Format tool: the brush it leaves (arming the page when the
 *  brush is empty, emptying it after a paint with Paint once) and whether to paint. */
export function pagePaintPress(
  sourceId: string | null,
  pageId: string,
  keep: boolean,
): { next: string | null; paint: { from: string; to: string } | null } {
  if (sourceId === null) return { next: pageBrush(pageId), paint: null };
  const from = brushPageId(sourceId);
  // An element's brush, or the page the brush came from: nothing to paint, the brush kept.
  if (!from || from === pageId) return { next: sourceId, paint: null };
  return { next: keep ? sourceId : null, paint: { from, to: pageId } };
}

/** A page brush as the Format Panel's preview shows it: the page's name, its fill's colour (a
 *  gradient's first stop, a picture's tone) and what a paint copies. */
export function pageBrushPreview(page: {
  name?: string;
  index: number;
  background?: { fill?: { kind: string; color?: string; from?: string; tone?: string } };
}): { name: string; fill: string; summary: string } {
  const fill = page.background?.fill;
  const colour =
    (fill?.kind === 'solid' && fill.color) ||
    (fill?.kind === 'gradient' && fill.from) ||
    (fill?.kind === 'image' && fill.tone) ||
    '#ffffff';
  return {
    name: `${page.name?.trim() || `Page ${page.index + 1}`} background`,
    fill: colour,
    summary: 'Copies: background and pattern',
  };
}
