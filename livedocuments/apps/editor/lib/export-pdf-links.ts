// A PDF's link areas (docs/specs/007-editor/article-pages.md "Everywhere a page goes"): a Pages tab's PDF
// is a picture of each page, so its links are areas laid over the pictures, read off the articles' writing
// as laid out (ArticleEditorHandle.links): each contents entry to its heading's page, each link in the text
// to its address. Pure but for that one read, so the PDF writer (export-tab-pdf.ts) stays a container.
import { isSafeArticleHref, type LaidOutPage } from '@livedocuments/document';
import { articleHandleOf, type ArticleLinkArea } from './article/article-editor-store';

// CSS px to PDF points, as the page's own size.
const PT_PER_PX = 0.75;

/** A link area on a PDF page, in points from the page's bottom-left corner: to another page of the PDF
 *  (by its index among the PDF's pages) or to an address. */
export type PdfLink = { x: number; y: number; w: number; h: number } & (
  { page: number } | { uri: string }
);

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

/** A PDF string literal: backslash and parentheses escaped, anything past ASCII percent-encoded (an address
 *  is ASCII in a PDF). */
export function pdfString(s: string): string {
  const ascii = s.replace(/[^\x20-\x7e]/g, (c) => encodeURIComponent(c));
  return `(${ascii.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}

/** A link's annotation dictionary: `pageRef` the object reference of each PDF page. */
export function linkAnnotation(link: PdfLink, pageRef: (index: number) => string): string {
  const rect = `[${link.x} ${link.y} ${round(link.x + link.w)} ${round(link.y + link.h)}]`;
  const action =
    'uri' in link
      ? `/A << /S /URI /URI ${pdfString(link.uri)} >>`
      : `/Dest [${pageRef(link.page)} /Fit]`;
  return `<< /Type /Annot /Subtype /Link /Rect ${rect} /Border [0 0 0] ${action} >>`;
}
