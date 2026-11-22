// A PDF's link areas (docs/specs/007-editor/article-pages.md "Everywhere a page goes"): areas laid over each
// page, read off the articles' writing as laid out (ArticleEditorHandle.links): each contents entry to its
// heading's page, each link in the text to its address. Pure but for that one read; the shared PDF writer
// (@liveworkspace/vector-export, liveworkspace/docs/specs/013-export/vector-pdf.md) writes them.
import { isSafeArticleHref, type LaidOutPage } from '@liveknowledge/document';
import type { PdfLink } from '@liveworkspace/vector-export/pdf-links';
import { PT_PER_PX } from '@liveworkspace/vector-export/pdf-page-size';
import { articleHandleOf, type ArticleLinkArea } from './article/article-editor-store';

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * The link areas lying on `page`, as PDF links: `areas` its article's (canvas rects), `own` its article's
 * pages in order (an area's `page` indexes them), `pdfIndexOf` a page's index among the PDF's pages (or -1,
 * left out of the export: a link to it is dropped).
 */
export function pdfLinksOn(
  page: Pick<LaidOutPage, 'rect'>,
  areas: readonly ArticleLinkArea[],
  own: readonly Pick<LaidOutPage, 'id'>[],
  pdfIndexOf: (pageId: string) => number,
): PdfLink[] {
  const r = page.rect;
  const out: PdfLink[] = [];
  for (const a of areas) {
    // On this page: its middle inside the page's sheet.
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    if (cx < r.x || cx > r.x + r.width || cy < r.y || cy > r.y + r.height) continue;
    const rect = {
      x: round((a.x - r.x) * PT_PER_PX),
      y: round((r.y + r.height - (a.y + a.h)) * PT_PER_PX),
      w: round(a.w * PT_PER_PX),
      h: round(a.h * PT_PER_PX),
    };
    if ('href' in a) {
      if (isSafeArticleHref(a.href)) out.push({ ...rect, uri: a.href });
      continue;
    }
    const target = own[a.page];
    const index = target ? pdfIndexOf(target.id) : -1;
    if (index >= 0) out.push({ ...rect, page: index });
  }
  return out;
}

/** Every exported page's link areas, in the PDF's page order: none for a page with no article, or an
 *  article not laid out in an editor. */
export function pdfLinksFor(
  pages: readonly LaidOutPage[],
  allPages: readonly Pick<LaidOutPage, 'id' | 'flow'>[],
): PdfLink[][] {
  const pdfIndexOf = (id: string) => pages.findIndex((p) => p.id === id);
  const areasOf = new Map<string, readonly ArticleLinkArea[]>();
  return pages.map((page) => {
    if (!page.flow) return [];
    let areas = areasOf.get(page.flow);
    if (!areas) {
      areas = articleHandleOf(page.flow)?.links() ?? [];
      areasOf.set(page.flow, areas);
    }
    const own = allPages.filter((p) => p.flow === page.flow);
    return pdfLinksOn(page, areas, own, pdfIndexOf);
  });
}
