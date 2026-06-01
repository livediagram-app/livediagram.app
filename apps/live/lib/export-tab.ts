// Tab export helpers — one entry per format the user can pick from
// the Export overlay. All four return a Promise<Blob> so the caller
// can plug them into a single download helper without branching on
// the MIME type.
//
// Scope: each export is a snapshot of a single Tab — its name, theme,
// background, and all elements. Cross-tab links and per-element
// comments are preserved in the JSON export but flattened or
// omitted in the visual ones (PNG, PDF) where they have no natural
// rendering.

import type { ArrowElement, BoxedElement, Element, Tab } from '@livediagram/diagram';

// ---------------------------------------------------------------------
// File (JSON)
// ---------------------------------------------------------------------

// Wraps the Tab in a small envelope with a schema-version field so
// the import path (#11) can detect the format and forward-migrate
// across future schema breaks.
//
// `schemaVersion` is intentionally numeric + monotonic — when the
// Tab shape changes incompatibly we bump it; the import path checks
// `<= CURRENT` and either accepts or refuses with a clear error.
export const TAB_SCHEMA_VERSION = 1;

export type ExportedTabEnvelope = {
  schemaVersion: number;
  kind: 'livediagram.tab';
  exportedAt: number;
  tab: Tab;
};

export function exportTabAsJson(tab: Tab): Blob {
  const envelope: ExportedTabEnvelope = {
    schemaVersion: TAB_SCHEMA_VERSION,
    kind: 'livediagram.tab',
    exportedAt: Date.now(),
    tab,
  };
  return new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
}

// ---------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------

// Extracts every labelled boxed element + every labelled arrow into
// a tree-like markdown document. Reading order: top-to-bottom by y,
// then left-to-right by x. That matches how a person would scan the
// canvas and produces a usable export even for non-tree layouts.
//
// Arrows with labels render as italic edges between bullet points,
// keyed off their endpoints so the connection survives the
// flattening. Unlabelled arrows are dropped — they're structural,
// not content.
export function exportTabAsMarkdown(tab: Tab): Blob {
  const lines: string[] = [];
  lines.push(`# ${tab.name || 'Untitled tab'}`);
  lines.push('');

  const boxed = tab.elements.filter(
    (e): e is BoxedElement => e.type === 'shape' || e.type === 'text' || e.type === 'sticky',
  );
  const arrows = tab.elements.filter((e): e is ArrowElement => e.type === 'arrow');
  const labelledBoxed = boxed.filter((b) => b.label && b.label.trim().length > 0);
  labelledBoxed.sort((a, b) => a.y - b.y || a.x - b.x);
  if (labelledBoxed.length > 0) {
    lines.push('## Elements');
    lines.push('');
    for (const b of labelledBoxed) {
      const tag = b.type === 'shape' ? `(${b.shape})` : `(${b.type})`;
      lines.push(`- **${b.label}** ${tag}`);
    }
    lines.push('');
  }

  const labelledArrows = arrows.filter((a) => a.label && a.label.trim().length > 0);
  if (labelledArrows.length > 0) {
    lines.push('## Connections');
    lines.push('');
    for (const a of labelledArrows) {
      const fromLabel = endpointLabel(a.from, boxed);
      const toLabel = endpointLabel(a.to, boxed);
      lines.push(`- *${a.label}*: ${fromLabel} → ${toLabel}`);
    }
    lines.push('');
  }

  if (labelledBoxed.length === 0 && labelledArrows.length === 0) {
    lines.push('_No labelled content._');
  }
  return new Blob([lines.join('\n')], { type: 'text/markdown' });
}

function endpointLabel(endpoint: ArrowElement['from'], boxed: BoxedElement[]): string {
  if (endpoint.kind === 'pinned') {
    const target = boxed.find((b) => b.id === endpoint.elementId);
    if (target && target.label) return target.label;
    return '?';
  }
  return `(${Math.round(endpoint.x)}, ${Math.round(endpoint.y)})`;
}

// ---------------------------------------------------------------------
// PNG / PDF helpers — shared canvas rendering
// ---------------------------------------------------------------------

const EXPORT_PADDING = 32;
const EXPORT_BG = '#ffffff';

// Walk all elements and return the bounding box of the visible
// content. Arrows count via their endpoints; boxed elements via
// their rectangle. Empty tabs default to a small standard page so
// the export isn't a 0×0 canvas.
function contentBounds(elements: Element[]): { x: number; y: number; w: number; h: number } {
  if (elements.length === 0) return { x: 0, y: 0, w: 600, h: 400 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  const consider = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const el of elements) {
    if (el.type === 'arrow') {
      if (el.from.kind === 'free') consider(el.from.x, el.from.y);
      if (el.to.kind === 'free') consider(el.to.x, el.to.y);
      // Pinned endpoints resolve through their target element's
      // bounding rect below.
    } else {
      consider(el.x, el.y);
      consider(el.x + el.width, el.y + el.height);
    }
  }
  // Fall through to a sane default when nothing contributed bounds
  // (e.g. a tab with only pinned arrows whose elements were since
  // deleted — degenerate but possible).
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 600, h: 400 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Render the tab to a 2D <canvas> at the requested pixel ratio.
// Minimal renderer — covers shape rectangles / ellipses, text
// elements (rendered as flat text without alignment fanciness),
// sticky notes (filled rect + text), and arrows as lines with a
// triangular head. Fancier rendering (rich text, padding, theme
// patterns) is intentionally out of scope; the export is meant as
// a faithful overview, not a pixel-perfect screenshot.
function renderTabToCanvas(tab: Tab, opts: { scale?: number } = {}): HTMLCanvasElement {
  const scale = opts.scale ?? 2; // default 2× for crisp output
  const bounds = contentBounds(tab.elements);
  const w = (bounds.w + EXPORT_PADDING * 2) * scale;
  const h = (bounds.h + EXPORT_PADDING * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  ctx.translate(EXPORT_PADDING - bounds.x, EXPORT_PADDING - bounds.y);
  // Background — solid white. Theme backgrounds (dots/grid/colour)
  // would be nice but they're decorative; flat white is the safest
  // export default.
  ctx.fillStyle = tab.backgroundColor ?? EXPORT_BG;
  ctx.fillRect(bounds.x - EXPORT_PADDING, bounds.y - EXPORT_PADDING, w / scale, h / scale);

  // Boxed elements first so arrows draw over them with the right
  // z-order on either end.
  for (const el of tab.elements) {
    if (el.type === 'arrow') continue;
    drawBoxed(ctx, el);
  }
  for (const el of tab.elements) {
    if (el.type !== 'arrow') continue;
    drawArrow(ctx, el, tab.elements);
  }
  return canvas;
}

function drawBoxed(ctx: CanvasRenderingContext2D, el: BoxedElement): void {
  const fill = el.fillColor ?? (el.type === 'sticky' ? '#fef3c7' : '#ffffff');
  const stroke = el.strokeColor ?? '#0f172a';
  const opacity = el.opacity ?? 1;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  if (el.type === 'shape' && el.shape === 'circle') {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (el.type === 'shape' && el.shape === 'diamond') {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    ctx.beginPath();
    ctx.moveTo(cx, el.y);
    ctx.lineTo(el.x + el.width, cy);
    ctx.lineTo(cx, el.y + el.height);
    ctx.lineTo(el.x, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (el.type === 'text') {
    // Text elements have no fill / stroke — pure label.
  } else {
    // Default rectangle (rounded corners ~ 6px for stickies + rects).
    const r = 6;
    roundedRect(ctx, el.x, el.y, el.width, el.height, r);
    ctx.fill();
    ctx.stroke();
  }
  if (el.label) {
    ctx.fillStyle = el.textColor ?? '#0f172a';
    const fontSize =
      el.textSize === 'lg' ? 20 : el.textSize === 'sm' ? 12 : el.textSize === 'scale' ? 18 : 14;
    ctx.font = `${el.textBold ? '600' : '400'} ${el.textItalic ? 'italic ' : ''}${fontSize}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign =
      el.textAlignX === 'right' ? 'right' : el.textAlignX === 'left' ? 'left' : 'center';
    const tx =
      el.textAlignX === 'right'
        ? el.x + el.width - 8
        : el.textAlignX === 'left'
          ? el.x + 8
          : el.x + el.width / 2;
    const ty = el.y + el.height / 2;
    ctx.fillText(el.label, tx, ty);
  }
  ctx.restore();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function endpointPoint(
  endpoint: ArrowElement['from'],
  elements: Element[],
): { x: number; y: number } {
  if (endpoint.kind === 'free') return { x: endpoint.x, y: endpoint.y };
  const target = elements.find((e) => e.id === endpoint.elementId);
  if (!target || target.type === 'arrow') return { x: 0, y: 0 };
  // Map the anchor name to a point on the target's bounding box.
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  switch (endpoint.anchor) {
    case 'n':
      return { x: cx, y: target.y };
    case 's':
      return { x: cx, y: target.y + target.height };
    case 'e':
      return { x: target.x + target.width, y: cy };
    case 'w':
      return { x: target.x, y: cy };
    case 'ne':
      return { x: target.x + target.width, y: target.y };
    case 'nw':
      return { x: target.x, y: target.y };
    case 'se':
      return { x: target.x + target.width, y: target.y + target.height };
    case 'sw':
      return { x: target.x, y: target.y + target.height };
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, arrow: ArrowElement, elements: Element[]): void {
  const from = endpointPoint(arrow.from, elements);
  const to = endpointPoint(arrow.to, elements);
  const stroke = arrow.strokeColor ?? '#64748b';
  const lineWidth = arrow.strokeWidth ?? 2;
  ctx.save();
  ctx.globalAlpha = arrow.opacity ?? 1;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  // Arrowheads — small triangles at the requested endpoints.
  const ends = arrow.arrowEnds ?? 'to';
  if (ends === 'to' || ends === 'both') drawArrowhead(ctx, from, to);
  if (ends === 'from' || ends === 'both') drawArrowhead(ctx, to, from);
  if (arrow.label) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(arrow.label, mx, my - 4);
  }
  ctx.restore();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 8;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 6),
    to.y - size * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 6),
    to.y - size * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------

export function exportTabAsPng(tab: Tab): Promise<Blob> {
  const canvas = renderTabToCanvas(tab);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG encoding failed'));
    }, 'image/png');
  });
}

// ---------------------------------------------------------------------
// PDF — single-page PDF wrapping the rendered PNG as an image
// XObject. Minimal hand-rolled PDF so we don't pull in a multi-
// hundred-KB pdf library for a single-image export.
// ---------------------------------------------------------------------

export async function exportTabAsPdf(tab: Tab): Promise<Blob> {
  const canvas = renderTabToCanvas(tab);
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
  // Assemble a minimal PDF document with one page sized to fit the
  // image at ~72 dpi. PDF objects are 1-indexed; xref tracks byte
  // offsets so the reader can find each.
  const pageWidth = canvas.width;
  const pageHeight = canvas.height;
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
  push('%PDF-1.4\n%\xff\xff\xff\xff\n');
  startObj(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  startObj(2);
  push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  startObj(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Img 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`,
  );
  // Content stream: draw the image at full page size.
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Img Do\nQ\n`;
  startObj(4);
  push(`<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
  // Image XObject — raw RGB pixels, FlateDecode-compressed.
  startObj(5);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`,
  );
  push(compressed);
  push('\nendstream\nendobj\n');
  const xrefOffset = cursor;
  push(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  // Concatenate.
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

// ---------------------------------------------------------------------
// Download helper — trigger a browser save dialog for the produced
// blob. Lives here so call sites don't repeat the same anchor-element
// dance every time.
// ---------------------------------------------------------------------

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking
  // the URL — revoking too early aborts the save in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
