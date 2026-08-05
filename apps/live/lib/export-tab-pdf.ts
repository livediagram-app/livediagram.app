// PDF export (spec/15 export menu). Wraps the rendered canvas into a minimal,
// hand-rolled single-page PDF (raw RGB pixels, FlateDecode-compressed) so we
// don't pull in a multi-hundred-KB pdf library for a single-image export.
// Split out of export-tab.ts: the PDF container format is a self-contained
// concern, distinct from the canvas/SVG renderers; it just needs the rendered
// pixels from renderTabToCanvas.
import type { Tab } from '@livediagram/diagram';
import { renderTabToCanvas, type ImageExportOpts } from './export-tab';

/**
 * One tab, one page. The deck exporter below is the general form; this stays
 * as the name every existing caller already uses.
 */
export async function exportTabAsPdf(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  return exportTabsAsPdf([tab], opts);
}

/**
 * Several tabs, one document, a page each — how a slide deck leaves (spec/31).
 *
 * One file rather than N downloads: a browser asked for twenty images in a row
 * blocks most of them, and a deck is wanted as a thing you can send someone.
 *
 * Objects are laid out three per page after the catalogue and the page tree, so
 * page `i` owns 3+3i (the page), 4+3i (its content stream) and 5+3i (its
 * image). The xref table is byte offsets and has to agree with that exactly,
 * which is the one thing worth testing here — a reader given a wrong offset
 * rejects the whole document rather than one page of it.
 */
export async function exportTabsAsPdf(tabs: Tab[], opts: ImageExportOpts = {}): Promise<Blob> {
  if (tabs.length === 0) throw new Error('PDF export needs at least one page');
  const pages = [];
  for (const tab of tabs) {
    pages.push(await renderPage(tab, opts));
  }
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
  const total = 2 + pages.length * 3;

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
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /XObject << /Img ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>\nendobj\n`,
    );
    const content = `q\n${page.width} 0 0 ${page.height} 0 0 cm\n/Img Do\nQ\n`;
    startObj(n + 1);
    push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
    startObj(n + 2);
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${page.bytes.length} >>\nstream\n`,
    );
    push(page.bytes);
    push('\nendstream\nendobj\n');
  });
  const xrefOffset = cursor;
  push(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= total; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  const size = parts.reduce((n, p) => n + p.length, 0);
  const buf = new Uint8Array(size);
  let off = 0;
  for (const p of parts) {
    buf.set(p, off);
    off += p.length;
  }
  return new Blob([buf], { type: 'application/pdf' });
}

/** One tab rendered to the compressed RGB bytes a PDF page embeds. */
async function renderPage(
  tab: Tab,
  opts: ImageExportOpts,
): Promise<{ width: number; height: number; bytes: Uint8Array }> {
  const canvas = await renderTabToCanvas(tab, opts);
  // Fetch the PNG bytes from the canvas, then embed them as a
  // /DCTDecode-less image — we use the simpler /FlateDecode raw
  // pixel-bytes encoding so we don't need a JPEG re-encoder. The
  // canvas's `toBlob('image/png')` is the closest path; for the PDF
  // we read the raw RGBA bytes and FlateDecode them ourselves.
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('PDF rendering failed: no 2d context');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Strip alpha — PDF /DeviceRGB doesn't carry an alpha channel.
  // Composite onto white so transparent regions don't end up black.
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let i = 0, j = 0; i < imgData.data.length; i += 4, j += 3) {
    const a = imgData.data[i + 3]! / 255;
    rgb[j] = Math.round(imgData.data[i]! * a + 255 * (1 - a));
    rgb[j + 1] = Math.round(imgData.data[i + 1]! * a + 255 * (1 - a));
    rgb[j + 2] = Math.round(imgData.data[i + 2]! * a + 255 * (1 - a));
  }
  const compressed = await deflate(rgb);
  return { width: canvas.width, height: canvas.height, bytes: compressed };
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
