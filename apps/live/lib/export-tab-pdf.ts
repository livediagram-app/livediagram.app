// PDF export (docs/specs/013-workspace/folders.md export menu). Wraps the rendered canvas into a minimal,
// hand-rolled PDF (one page, or one per Illustrate page) (raw RGB pixels, FlateDecode-compressed) so we
// don't pull in a multi-hundred-KB pdf library for a single-image export.
// Split out of export-tab.ts: the PDF container format is a self-contained
// concern, distinct from the canvas/SVG renderers; it just needs the rendered
// pixels from renderTabToCanvas.
import type { LaidOutPage, Tab } from '@livediagram/document';
import { renderedExportScale, renderTabToCanvas, type ImageExportOpts } from './export-tab';

export async function exportTabAsPdf(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const canvas = await renderTabToCanvas(tab, opts);
  return assemblePdf([
    {
      ...(await pdfImage(canvas)),
      ...singlePageMedia(canvas.width, canvas.height, renderedExportScale(canvas)),
    },
  ]);
}

// CSS px to PDF points (96 to 72 per inch): an A4 page is 595 x 842 pt, as printed.
const PT_PER_PX = 0.75;
// The largest page side a PDF holds (the PDF 1.4 limit, 200 inches).
export const MAX_PDF_PAGE_PT = 14400;

/** A single-page PDF's page in points: the canvas at its CSS size (pixels / render scale) at
 *  0.75 pt per px, so it prints at the size it shows rather than at the render's 2x; a page past
 *  the PDF limit shrinks uniformly to fit it. The image keeps every pixel either way. */
export function singlePageMedia(
  pixelW: number,
  pixelH: number,
  scale: number,
): { mediaW: number; mediaH: number } {
  const w = (pixelW / scale) * PT_PER_PX;
  const h = (pixelH / scale) * PT_PER_PX;
  const fit = Math.min(1, MAX_PDF_PAGE_PT / Math.max(w, h, 1));
  const pt = (n: number) => Math.max(1, Math.round(n * fit * 100) / 100);
  return { mediaW: pt(w), mediaH: pt(h) };
}

/** An Illustrate tab's pages as one PDF (docs/specs/007-editor/illustrate-pages.md "Export"):
 *  every page in row order, one PDF page each at its own size and orientation in print points,
 *  each exactly its sheet. */
export async function exportPagesAsPdf(
  tab: Tab,
  pages: readonly LaidOutPage[],
  opts: ImageExportOpts = {},
): Promise<Blob> {
  const out: PdfPage[] = [];
  for (const page of pages) {
    const canvas = await renderTabToCanvas(tab, { ...opts, page });
    out.push({
      ...(await pdfImage(canvas)),
      mediaW: Math.round(page.rect.width * PT_PER_PX * 100) / 100,
      mediaH: Math.round(page.rect.height * PT_PER_PX * 100) / 100,
    });
  }
  return assemblePdf(out);
}

type PdfImage = { width: number; height: number; bytes: Uint8Array };
type PdfPage = PdfImage & { mediaW: number; mediaH: number };

// The canvas's pixels as FlateDecode RGB, alpha composited onto white (PDF /DeviceRGB carries no
// alpha, and transparent regions would otherwise come out black). Raw pixels rather than a JPEG
// re-encode, so no encoder is needed.
async function pdfImage(canvas: HTMLCanvasElement): Promise<PdfImage> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering failed: no 2d context');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let i = 0, j = 0; i < imgData.data.length; i += 4, j += 3) {
    const a = imgData.data[i + 3]! / 255;
    rgb[j] = Math.round(imgData.data[i]! * a + 255 * (1 - a));
    rgb[j + 1] = Math.round(imgData.data[i + 1]! * a + 255 * (1 - a));
    rgb[j + 2] = Math.round(imgData.data[i + 2]! * a + 255 * (1 - a));
  }
  return { width: canvas.width, height: canvas.height, bytes: await deflate(rgb) };
}

// A minimal PDF: the catalog (1), the page tree (2), then per page its page object, content
// stream and image (3 objects each). Objects are 1-indexed; the xref holds each one's byte offset.
function assemblePdf(pages: readonly PdfPage[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;
  const push = (s: string | Uint8Array) => {
    const bytes = typeof s === 'string' ? enc.encode(s) : s;
    parts.push(bytes);
    cursor += bytes.length;
  };
  const startObj = (n: number) => {
    offsets[n] = cursor;
    push(`${n} 0 obj\n`);
  };
  const pageObj = (i: number) => 3 + i * 3;
  push('%PDF-1.4\n%\xff\xff\xff\xff\n');
  startObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  const kids = pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ');
  push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);
  pages.forEach((page, i) => {
    const n = pageObj(i);
    startObj(n);
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.mediaW} ${page.mediaH}] /Resources << /XObject << /Img ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>\nendobj\n`,
    );
    // Content stream: draw the image across the whole page.
    const content = `q\n${page.mediaW} 0 0 ${page.mediaH} 0 0 cm\n/Img Do\nQ\n`;
    startObj(n + 1);
    push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
    startObj(n + 2);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${page.bytes.length} >>\nstream\n`,
    );
    push(page.bytes);
    push('\nendstream\nendobj\n');
  });
  const count = 3 + pages.length * 3;
  const xrefOffset = cursor;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let i = 1; i < count; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return new Blob([buf], { type: 'application/pdf' });
}

// Wrap CompressionStream so the PDF generator gets a flat Uint8Array
// of FlateDecode (zlib) bytes. Modern browsers all support this; in
// the unlikely case it's missing we throw — the user will then fall
// back to PNG/JSON, which don't need compression.
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  // Slice into a fresh ArrayBuffer to widen the typed-array's
  // backing type — TS 5.7 narrows Uint8Array to its parameterised
  // ArrayBufferLike, which Blob() refuses. The copy is cheap
  // compared to the deflate work that follows.
  const copy = new Uint8Array(data.length);
  copy.set(data);
  const stream = new Blob([copy.buffer]).stream().pipeThrough(new CompressionStream('deflate'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}
