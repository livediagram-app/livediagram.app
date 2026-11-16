// A PDF page's link areas (livedocuments/docs/specs/007-editor/article-pages.md "Everywhere a page goes"): each a
// rectangle in points from the page's bottom-left corner, going to another page of the PDF or to an address. The
// product works out where they lie (livedocuments' export-pdf-links.ts reads its articles' contents entries and
// links); the writer lays them over the page.

const round = (n: number) => Math.round(n * 100) / 100;

/** A link area on a PDF page, in points from the page's bottom-left corner: to another page of the PDF (by its index
 *  among the PDF's pages) or to an address. */
export type PdfLink = { x: number; y: number; w: number; h: number } & (
  { page: number } | { uri: string }
);

/** A PDF string literal: backslash and parentheses escaped, anything past ASCII percent-encoded (an address is ASCII
 *  in a PDF). */
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
