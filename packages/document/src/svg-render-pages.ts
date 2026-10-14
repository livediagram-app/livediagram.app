// An Illustrate tab drawn as its pages (docs/specs/015-api/mcp-server.md §5, docs/specs/007-editor/illustrate-pages.md
// "Export"): each page as an export draws it (its sheet, its background, the elements reaching onto it, cut at its
// edges), so a preview shows what the pages print rather than the content's bounds on the canvas. One page at its own
// size, or every page in a grid of rows, so each stays legible in an image whose longer side is bounded. Pure.
import { illustratePagesOf, layOutIllustratePages, type LaidOutPage } from './illustrate-page';
import { pageExportFrame } from './illustrate-page-frame';
import { opensInOf } from './editor-mode';
import { r2, xmlEscape } from './svg-render-primitives';
import { renderElementsToSvg } from './svg-render';
import type { Tab } from './index';

type RenderOpts = Omit<NonNullable<Parameters<typeof renderElementsToSvg>[1]>, 'frame'>;

// The gap between pages in the grid, and the backdrop it shows (a neutral desk under the sheets).
export const PAGES_GRID_GAP_PX = 48;
const PAGES_GRID_BACKDROP = '#e2e8f0';
// The size of the place and name under each page.
const PAGES_GRID_LABEL_PX = 32;

// The pages a tab lays out, in their row; none for a tab that is not in Illustrate (illustratePagesOf reads any other
// tab as one page, which it only has once it is switched).
export function laidOutPagesOf(tab: Tab): LaidOutPage[] {
  if (opensInOf(tab) !== 'illustrate') return [];
  return layOutIllustratePages(illustratePagesOf(tab));
}

// How many pages a grid row holds: two of wide pages (slides), three of tall or square ones, never more than there are.
export function pagesPerRow(pages: readonly LaidOutPage[]): number {
  const wide = pages.filter((p) => p.rect.width > p.rect.height).length > pages.length / 2;
  return Math.max(1, Math.min(pages.length, wide ? 2 : 3));
}

// One page as an export draws it, with what goes over its sheet and under its elements (an article's writing).
export function renderPageToSvg(
  tab: Tab,
  page: LaidOutPage,
  opts: RenderOpts & { writingSvg?: (page: LaidOutPage) => string | undefined } = {},
): string {
  const { writingSvg, ...rest } = opts;
  const frame = pageExportFrame(page, { idPrefix: `pg-${page.index}` });
  const writing = writingSvg?.(page);
  return renderElementsToSvg(tab, {
    ...rest,
    frame: { ...frame, ...(writing ? { writingSvg: writing } : {}) },
  });
}

// Every page of the tab, each drawn as `renderPageToSvg` draws it, in rows of `pagesPerRow` on a neutral backdrop
// with each page's name under it; null for a tab with no pages.
export function renderPagesToSvg(
  tab: Tab,
  opts: RenderOpts & { writingSvg?: (page: LaidOutPage) => string | undefined } = {},
): string | null {
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
      const name = `${page.index + 1}${page.name ? `  ${page.name}` : ''}`;
      parts.push(
        `<text x="${r2(x)}" y="${r2(y + page.rect.height + PAGES_GRID_LABEL_PX + 4)}" font-size="${PAGES_GRID_LABEL_PX}" fill="#475569">${xmlEscape(name)}</text>`,
      );
    });
    y += rowH[ri]! + PAGES_GRID_GAP_PX;
  });
  parts.push('</svg>');
  return parts.join('\n');
}
