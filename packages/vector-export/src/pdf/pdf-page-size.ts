// A PDF page's size (liveworkspace/docs/specs/013-export/vector-pdf.md "Page size"): the SVG's CSS size at 0.75 pt per px (96 to 72 per inch),
// so an A4 page is 595 x 842 pt and a canvas prints at the size it shows; a page past the PDF limit shrinks uniformly
// to fit it.

// CSS px to PDF points.
export const PT_PER_PX = 0.75;
// The largest page side a PDF holds (the PDF 1.4 limit, 200 inches).
export const MAX_PDF_PAGE_PT = 14400;

/** A page of `cssW` x `cssH` CSS px, in points, to the hundredth, at least 1 pt a side. */
export function pageMedia(cssW: number, cssH: number): { mediaW: number; mediaH: number } {
  const w = cssW * PT_PER_PX;
  const h = cssH * PT_PER_PX;
  const fit = Math.min(1, MAX_PDF_PAGE_PT / Math.max(w, h, 1));
  const pt = (n: number) => Math.max(1, Math.round(n * fit * 100) / 100);
  return { mediaW: pt(w), mediaH: pt(h) };
}

/** A single-page PDF's page from a rendered canvas: its pixels over the scale it was drawn at, as CSS px. */
export function singlePageMedia(
  pixelW: number,
  pixelH: number,
  scale: number,
): { mediaW: number; mediaH: number } {
  return pageMedia(pixelW / scale, pixelH / scale);
}
