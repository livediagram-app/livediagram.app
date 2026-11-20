// A Pages tab drawn as its pages (docs/specs/015-api/mcp-server.md §5, docs/specs/007-editor/pages-mode.md
// "Export"): each page as an export draws it (its sheet, its background, the elements reaching onto it, cut at its
// edges), so a preview shows what the pages print rather than the content's bounds on the canvas. One page at its own
// size, or every page in a grid of rows, so each stays legible in an image whose longer side is bounded. Pure.
import { pagesOf, layOutPages, type LaidOutPage } from './page';
import { pageExportFrame } from './page-frame';
import { r2, xmlEscape } from './svg-render-primitives';
import { renderElementsToSvg } from './svg-render';
import type { Tab } from './index';
import { articleOpsToSvg } from './article-draw-ops';
import { estimateArticle } from './article-layout-estimate';
import { themeAccent } from './page-default-background';
import { getBuiltInTheme } from './themes';

type RenderOpts = Omit<NonNullable<Parameters<typeof renderElementsToSvg>[1]>, 'frame'>;

// The gap between pages in the grid, and the backdrop it shows (a neutral desk under the sheets).
const PAGES_GRID_GAP_PX = 48;
const PAGES_GRID_BACKDROP = '#e2e8f0';
// The size of the place and name under each page.
const PAGES_GRID_LABEL_PX = 32;

// The pages a tab lays out, in their row.
export function laidOutPagesOf(tab: Tab): LaidOutPage[] {
  return layOutPages(pagesOf(tab));
}

// How many pages a grid row holds: two of wide pages (slides), three of tall or square ones, never more than there are.
export function pagesPerRow(pages: readonly LaidOutPage[]): number {
  const wide = pages.filter((p) => p.rect.width > p.rect.height).length > pages.length / 2;
  return Math.max(1, Math.min(pages.length, wide ? 2 : 3));
}

// The pages a preview draws and each article page's writing, estimated without a browser (article-layout-estimate.ts)
// in the tab theme's accent: the tab's pages, with the pages an article's writing would grow onto (the editor adds
// them as it lays the writing out) after each article's last; `added` names those.
export function pagesWithWriting(tab: Tab): {
  pages: LaidOutPage[];
  added: ReadonlySet<string>;
  writing: (page: LaidOutPage) => string | undefined;
} {
  const own = laidOutPagesOf(tab);
  const accent = themeAccent(getBuiltInTheme(tab.theme, 'light'));
  const byPage = new Map<string, string>();
  const after = new Map<string, LaidOutPage[]>();
  const added = new Set<string>();
  for (const flow of new Set(own.flatMap((p) => (p.flow ? [p.flow] : [])))) {
    const est = estimateArticle(tab, flow, own, accent);
    for (const [id, ops] of est.ops) byPage.set(id, articleOpsToSvg(ops));
    if (est.added.length) {
      const last = own.filter((p) => p.flow === flow).at(-1)!;
      after.set(last.id, est.added);
      for (const p of est.added) added.add(p.id);
    }
  }
  const pages = own.flatMap((p) => [p, ...(after.get(p.id) ?? [])]);
  return { pages, added, writing: (page) => byPage.get(page.id) };
}

// One page as an export draws it, with what goes over its sheet and under its elements (an article's writing: the
// estimated writing unless `writingSvg` says otherwise).
export function renderPageToSvg(
  tab: Tab,
  page: LaidOutPage,
  opts: RenderOpts & { writingSvg?: (page: LaidOutPage) => string | undefined } = {},
): string {
  const { writingSvg = pagesWithWriting(tab).writing, ...rest } = opts;
  // The page's own picture too, from the same resolver as its image elements.
  const frame = pageExportFrame(page, {
    idPrefix: `pg-${page.index}`,
    imageHref: opts.resolveImageHref,
  });
  const writing = writingSvg(page);
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
  if (laidOutPagesOf(tab).length === 0) return null;
  const laid = pagesWithWriting(tab);
  const { pages, added } = laid;
  const writing = opts.writingSvg ?? laid.writing;
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
      const svg = renderPageToSvg(tab, page, { ...opts, writingSvg: writing }).replace(
        '<svg xmlns="http://www.w3.org/2000/svg" ',
        `<svg x="${r2(x)}" y="${r2(y)}" `,
      );
      parts.push(svg);
      const place = pages.indexOf(page) + 1;
      const name = added.has(page.id)
        ? `${place}  (added as the writing is laid out)`
        : `${place}${page.name ? `  ${page.name}` : ''}`;
      parts.push(
        `<text x="${r2(x)}" y="${r2(y + page.rect.height + PAGES_GRID_LABEL_PX + 4)}" font-size="${PAGES_GRID_LABEL_PX}" fill="#475569">${xmlEscape(name)}</text>`,
      );
    });
    y += rowH[ri]! + PAGES_GRID_GAP_PX;
  });
  parts.push('</svg>');
  return parts.join('\n');
}
