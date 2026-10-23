// A Pages tab drawn as its pages (docs/specs/015-api/mcp-server.md §5, docs/specs/007-editor/pages-mode.md
// "Export"): each page as an export draws it (its sheet, its background, the elements reaching onto it, cut at its
// edges), so a preview shows what the pages print rather than the content's bounds on the canvas. One page at its own
// size, or every page in a grid of rows, so each stays legible in an image whose longer side is bounded. Pure.
import { pagesOf, layOutPages, type LaidOutPage } from './page';
import { pageExportFrame } from './page-frame';
import { tabWireframeFrameTheme } from './wireframe-page';
import { opensInOf } from './editor-mode';
import { r2, xmlEscape } from './svg-render-primitives';
import { renderElementsToSvg } from './svg-render';
import type { Tab } from './index';

type RenderOpts = Omit<NonNullable<Parameters<typeof renderElementsToSvg>[1]>, 'frame'> & {
  // A photo page's composite by page id (docs/specs/031-photo/photo-pages.md "Exports and other views").
  resolvePhotoHref?: (pageId: string) => string | undefined;
};

// The gap between pages in the grid, and the backdrop it shows (a neutral desk under the sheets).
const PAGES_GRID_GAP_PX = 48;
const PAGES_GRID_BACKDROP = '#e2e8f0';
// The size of the place and name under each page.
const PAGES_GRID_LABEL_PX = 32;

// The pages a tab lays out, in their row; none for a tab that is not in Pages (pagesOf reads any other
// tab as one page, which it only has once it is switched).
export function laidOutPagesOf(tab: Tab): LaidOutPage[] {
  if (opensInOf(tab) !== 'pages') return [];
  return layOutPages(pagesOf(tab));
}

// How many pages a grid row holds: two of wide pages (slides), three of tall or square ones, never more than there are.
export function pagesPerRow(pages: readonly LaidOutPage[]): number {
  const wide = pages.filter((p) => p.rect.width > p.rect.height).length > pages.length / 2;
  return Math.max(1, Math.min(pages.length, wide ? 2 : 3));
}

// One page as an export draws it: its sheet, its background and the elements reaching onto it.
export function renderPageToSvg(tab: Tab, page: LaidOutPage, opts: RenderOpts = {}): string {
  const { resolvePhotoHref, ...rest } = opts;
  // The page's own picture too, from the same resolver as its image elements.
  const frame = pageExportFrame(page, {
    frameTheme: tabWireframeFrameTheme(tab),
    idPrefix: `pg-${page.index}`,
    imageHref: opts.resolveImageHref,
    ...(resolvePhotoHref ? { photoHref: resolvePhotoHref } : {}),
  });
  return renderElementsToSvg(tab, { ...rest, frame });
}

// Every page of the tab, each drawn as `renderPageToSvg` draws it, in rows of `pagesPerRow` on a neutral backdrop
// with each page's name under it; null for a tab with no pages.
export function renderPagesToSvg(tab: Tab, opts: RenderOpts = {}): string | null {
  const pages = laidOutPagesOf(tab);
  if (pages.length === 0) return null;
  const perRow = pagesPerRow(pages);
  const cellW = Math.max(...pages.map((p) => p.rect.width));
  // Room under each page for its place and name, large enough to read when the grid is drawn smaller.
  const label = PAGES_GRID_LABEL_PX + 16;
  const rows: LaidOutPage[][] = [];
  for (let i = 0; i < pages.length; i += perRow) rows.push(pages.slice(i, i + perRow));
  const rowH = rows.map((row) => Math.max(...row.map((p) => p.rect.height)) + label);
  const width = perRow * cellW + (perRow + 1) * PAGES_GRID_GAP_PX;
  const height = rowH.reduce((a, h) => a + h, 0) + (rows.length + 1) * PAGES_GRID_GAP_PX;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(width)}" height="${r2(height)}" viewBox="0 0 ${r2(width)} ${r2(height)}">`,
    `<rect width="${r2(width)}" height="${r2(height)}" fill="${PAGES_GRID_BACKDROP}"/>`,
  ];
  let y = PAGES_GRID_GAP_PX;
  rows.forEach((row, ri) => {
    row.forEach((page, ci) => {
      const x = PAGES_GRID_GAP_PX + ci * (cellW + PAGES_GRID_GAP_PX);
      // The page's own drawing, nested where its cell is: its root tag placed, its viewBox kept.
      const svg = renderPageToSvg(tab, page, opts).replace(
        '<svg xmlns="http://www.w3.org/2000/svg" ',
        `<svg x="${r2(x)}" y="${r2(y)}" `,
      );
      parts.push(svg);
      const place = pages.indexOf(page) + 1;
      const name = `${place}${page.name ? `  ${page.name}` : ''}`;
      parts.push(
        `<text x="${r2(x)}" y="${r2(y + page.rect.height + PAGES_GRID_LABEL_PX + 4)}" font-size="${PAGES_GRID_LABEL_PX}" fill="#475569">${xmlEscape(name)}</text>`,
      );
    });
    y += rowH[ri]! + PAGES_GRID_GAP_PX;
  });
  parts.push('</svg>');
  return parts.join('\n');
}
