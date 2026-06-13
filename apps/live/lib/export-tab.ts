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

import {
  endpointPosition,
  hasRichFormatting,
  isBoxed,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
  type TextRun,
} from '@livediagram/diagram';
import { framesFirst } from './canvas';

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

  // Use isBoxed instead of an inline kind list so a future
  // BoxedElement variant (FreehandElement landed via this gap)
  // doesn't silently drop out of the markdown export. The tag
  // computation below already falls back to `(<type>)` for any
  // non-shape kind.
  const boxed = tab.elements.filter(isBoxed);
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
  // z-order on either end; framesFirst keeps frame sections behind
  // their contents (spec/09).
  for (const el of framesFirst(tab.elements)) {
    if (el.type === 'arrow') continue;
    drawBoxed(ctx, el);
  }
  for (const el of tab.elements) {
    if (el.type !== 'arrow') continue;
    drawArrow(ctx, el, tab.elements);
  }
  return canvas;
}

// --- Shared boxed-element export description --------------------------
//
// Both visual exporters (the PNG canvas renderer + the SVG renderer)
// make the SAME decisions — which silhouette a boxed element maps to,
// its fill / stroke defaults, and where its label sits — then draw with
// their own primitives. Encoding that decision ONCE here keeps the two
// renderers from drifting (a new export-visible shape or a tweaked
// default lands in one place, not two).

// The label colour / size / weight defaults shared by both renderers.
const EXPORT_INK = '#0f172a'; // slate-900 — default stroke + label colour
const EXPORT_IMAGE_FILL = '#f1f5f9'; // slate-100 placeholder body
const EXPORT_IMAGE_STROKE = '#94a3b8'; // slate-400 placeholder dashes
const EXPORT_IMAGE_LABEL = '#64748b'; // slate-500 alt-text label

// One resolved span of a rich label (run ⊕ element defaults). Underline /
// strikethrough are intentionally absent — neither visual exporter draws
// them today, so runs match (not exceed) that fidelity.
type ExportRun = { text: string; color: string; size: number; bold: boolean; italic: boolean };

type ExportLabel = {
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  color: string;
  size: number;
  bold: boolean;
  italic: boolean;
  // Present when the element carries per-range formatting; both renderers
  // lay these out on one baseline from the anchor point. The single
  // text/color/size/bold/italic fields above stay populated as a fallback.
  runs?: ExportRun[];
};

// `image` is a dashed placeholder (a static export can't embed the
// bitmap synchronously); `none` is a label-only element (text); the
// rest carry the resolved fill + stroke. Geometry comes from the
// element itself at draw time — the descriptor only carries the
// branch decision + colours + label so neither renderer re-derives them.
type ExportShape =
  | { kind: 'image' }
  | { kind: 'ellipse'; fill: string; stroke: string }
  | { kind: 'diamond'; fill: string; stroke: string }
  | { kind: 'rect'; fill: string; stroke: string }
  | { kind: 'none' };

type BoxedExport = { opacity: number; shape: ExportShape; label: ExportLabel | null };

function describeBoxedExport(el: BoxedElement): BoxedExport {
  const opacity = el.opacity ?? 1;
  if (el.type === 'image') {
    return {
      opacity,
      shape: { kind: 'image' },
      // Alt text (or "Image") centred in the placeholder.
      label: {
        text: el.alt ?? 'Image',
        x: el.x + el.width / 2,
        y: el.y + el.height / 2,
        anchor: 'middle',
        color: EXPORT_IMAGE_LABEL,
        size: 12,
        bold: true,
        italic: false,
      },
    };
  }
  const fill = el.fillColor ?? (el.type === 'sticky' ? '#fef3c7' : '#ffffff');
  const stroke = el.strokeColor ?? EXPORT_INK;
  // Annotation markers + circles render as the themed circle; diamonds as
  // a 4-point polygon; text as label-only; everything else as a rounded
  // rect — the "faithful overview" simplification shared by both exporters.
  const shape: ExportShape =
    (el.type === 'shape' && el.shape === 'circle') || el.type === 'annotation'
      ? { kind: 'ellipse', fill, stroke }
      : el.type === 'shape' && el.shape === 'diamond'
        ? { kind: 'diamond', fill, stroke }
        : el.type === 'text'
          ? { kind: 'none' }
          : { kind: 'rect', fill, stroke };
  const baseColor = el.textColor ?? EXPORT_INK;
  const baseSize = fontSizeFor(el.textSize);
  const richText = (el as { richText?: TextRun[] }).richText;
  const runs: ExportRun[] | undefined = hasRichFormatting(richText)
    ? richText!.map((run) => ({
        text: run.text,
        color: run.color ?? baseColor,
        size: run.size ? fontSizeFor(run.size) : baseSize,
        bold: run.bold ?? !!el.textBold,
        italic: run.italic ?? !!el.textItalic,
      }))
    : undefined;
  const label: ExportLabel | null = el.label
    ? {
        text: el.label,
        x:
          el.textAlignX === 'right'
            ? el.x + el.width - 8
            : el.textAlignX === 'left'
              ? el.x + 8
              : el.x + el.width / 2,
        y: el.y + el.height / 2,
        anchor: el.textAlignX === 'right' ? 'end' : el.textAlignX === 'left' ? 'start' : 'middle',
        color: baseColor,
        size: baseSize,
        bold: !!el.textBold,
        italic: !!el.textItalic,
        runs,
      }
    : null;
  return { opacity, shape, label };
}

function drawBoxed(ctx: CanvasRenderingContext2D, el: BoxedElement): void {
  const { opacity, shape, label } = describeBoxedExport(el);
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = 1.5;
  if (shape.kind === 'image') {
    ctx.strokeStyle = EXPORT_IMAGE_STROKE;
    ctx.fillStyle = EXPORT_IMAGE_FILL;
    ctx.setLineDash([4, 4]);
    roundedRect(ctx, el.x, el.y, el.width, el.height, 6);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (shape.kind === 'ellipse') {
    ctx.fillStyle = shape.fill;
    ctx.strokeStyle = shape.stroke;
    ctx.beginPath();
    ctx.ellipse(cx, cy, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (shape.kind === 'diamond') {
    ctx.fillStyle = shape.fill;
    ctx.strokeStyle = shape.stroke;
    ctx.beginPath();
    ctx.moveTo(cx, el.y);
    ctx.lineTo(el.x + el.width, cy);
    ctx.lineTo(cx, el.y + el.height);
    ctx.lineTo(el.x, cy);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (shape.kind === 'rect') {
    ctx.fillStyle = shape.fill;
    ctx.strokeStyle = shape.stroke;
    roundedRect(ctx, el.x, el.y, el.width, el.height, 6);
    ctx.fill();
    ctx.stroke();
  }
  if (label) {
    ctx.textBaseline = 'middle';
    if (label.runs) {
      // Per-range label: lay the spans on one baseline from the anchor
      // point. Measure each span first (font must be set before measure),
      // sum the widths, then derive the start x from the anchor.
      const fontFor = (r: ExportRun) =>
        `${r.bold ? '600' : '400'} ${r.italic ? 'italic ' : ''}${r.size}px system-ui, sans-serif`;
      let total = 0;
      for (const run of label.runs) {
        ctx.font = fontFor(run);
        total += ctx.measureText(run.text).width;
      }
      let x =
        label.anchor === 'start'
          ? label.x
          : label.anchor === 'end'
            ? label.x - total
            : label.x - total / 2;
      ctx.textAlign = 'left';
      for (const run of label.runs) {
        ctx.font = fontFor(run);
        ctx.fillStyle = run.color;
        ctx.fillText(run.text, x, label.y);
        x += ctx.measureText(run.text).width;
      }
    } else {
      ctx.fillStyle = label.color;
      ctx.font = `${label.bold ? '600' : '400'} ${label.italic ? 'italic ' : ''}${label.size}px system-ui, sans-serif`;
      ctx.textAlign =
        label.anchor === 'end' ? 'right' : label.anchor === 'start' ? 'left' : 'center';
      ctx.fillText(label.text, label.x, label.y);
    }
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

function drawArrow(ctx: CanvasRenderingContext2D, arrow: ArrowElement, elements: Element[]): void {
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
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
// SVG — vector counterpart of the canvas renderer. Same coverage as the
// PNG / PDF path (rect / ellipse / diamond / text / sticky / image
// placeholder / arrows) so the three visual exports stay consistent;
// the difference is vector output that scales without pixelation and
// stays editable in design tools. Synchronous (string assembly), so it
// returns a Blob directly rather than a Promise.
// ---------------------------------------------------------------------

// Round to 2dp so the markup stays compact without visible drift.
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// XML-escape for both text nodes and attribute values.
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fontSizeFor(textSize: BoxedElement['textSize']): number {
  return textSize === 'lg' ? 20 : textSize === 'sm' ? 12 : textSize === 'scale' ? 18 : 14;
}

function svgLabel(
  text: string,
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  color: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): string {
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-family="system-ui, sans-serif" font-size="${fontSize}"` +
    ` font-weight="${bold ? 600 : 400}"${italic ? ' font-style="italic"' : ''}` +
    ` fill="${xmlEscape(color)}" text-anchor="${anchor}" dominant-baseline="central">${xmlEscape(text)}</text>`
  );
}

// Per-range label as one anchored <text> with a <tspan> per run; the
// parent text-anchor positions the whole block and the tspans flow
// left-to-right from there (SVG advances each tspan automatically).
function svgRichLabel(
  runs: ExportRun[],
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
): string {
  const spans = runs
    .map(
      (r) =>
        `<tspan fill="${xmlEscape(r.color)}" font-size="${r.size}"` +
        ` font-weight="${r.bold ? 600 : 400}"${r.italic ? ' font-style="italic"' : ''}>` +
        `${xmlEscape(r.text)}</tspan>`,
    )
    .join('');
  return (
    `<text x="${r2(x)}" y="${r2(y)}" font-family="system-ui, sans-serif"` +
    ` text-anchor="${anchor}" dominant-baseline="central">${spans}</text>`
  );
}

function svgBoxed(el: BoxedElement): string {
  const { opacity, shape, label } = describeBoxedExport(el);
  const opAttr = opacity !== 1 ? ` opacity="${r2(opacity)}"` : '';
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  let shapeStr = '';
  if (shape.kind === 'image') {
    // Dashed placeholder rect — a static export can't embed the bitmap.
    shapeStr =
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6"` +
      ` fill="${EXPORT_IMAGE_FILL}" stroke="${EXPORT_IMAGE_STROKE}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  } else if (shape.kind === 'ellipse') {
    shapeStr = `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(el.width / 2)}" ry="${r2(el.height / 2)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`;
  } else if (shape.kind === 'diamond') {
    shapeStr = `<polygon points="${r2(cx)},${r2(el.y)} ${r2(el.x + el.width)},${r2(cy)} ${r2(cx)},${r2(el.y + el.height)} ${r2(el.x)},${r2(cy)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (shape.kind === 'rect') {
    shapeStr = `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`;
  }
  const labelStr = !label
    ? ''
    : label.runs
      ? svgRichLabel(label.runs, label.x, label.y, label.anchor)
      : svgLabel(
          label.text,
          label.x,
          label.y,
          label.anchor,
          label.color,
          label.size,
          label.bold,
          label.italic,
        );
  return `<g${opAttr}>${shapeStr}${labelStr}</g>`;
}

function svgArrowhead(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 8;
  const p1 = `${r2(to.x)},${r2(to.y)}`;
  const p2 = `${r2(to.x - size * Math.cos(angle - Math.PI / 6))},${r2(to.y - size * Math.sin(angle - Math.PI / 6))}`;
  const p3 = `${r2(to.x - size * Math.cos(angle + Math.PI / 6))},${r2(to.y - size * Math.sin(angle + Math.PI / 6))}`;
  return `<polygon points="${p1} ${p2} ${p3}" fill="${xmlEscape(color)}"/>`;
}

function svgArrow(arrow: ArrowElement, elements: Element[]): string {
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const stroke = arrow.strokeColor ?? '#64748b';
  const lw = arrow.strokeWidth ?? 2;
  const op = arrow.opacity ?? 1;
  const opAttr = op !== 1 ? ` opacity="${r2(op)}"` : '';
  const parts = [`<g${opAttr}>`];
  parts.push(
    `<line x1="${r2(from.x)}" y1="${r2(from.y)}" x2="${r2(to.x)}" y2="${r2(to.y)}" stroke="${xmlEscape(stroke)}" stroke-width="${lw}"/>`,
  );
  const ends = arrow.arrowEnds ?? 'to';
  if (ends === 'to' || ends === 'both') parts.push(svgArrowhead(from, to, stroke));
  if (ends === 'from' || ends === 'both') parts.push(svgArrowhead(to, from, stroke));
  if (arrow.label) {
    parts.push(
      svgLabel(
        arrow.label,
        (from.x + to.x) / 2,
        (from.y + to.y) / 2 - 6,
        'middle',
        '#0f172a',
        12,
        false,
        false,
      ),
    );
  }
  parts.push('</g>');
  return parts.join('');
}

function renderTabToSvg(tab: Tab): string {
  const bounds = contentBounds(tab.elements);
  const vbX = bounds.x - EXPORT_PADDING;
  const vbY = bounds.y - EXPORT_PADDING;
  const vbW = bounds.w + EXPORT_PADDING * 2;
  const vbH = bounds.h + EXPORT_PADDING * 2;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
  );
  parts.push(
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(tab.backgroundColor ?? EXPORT_BG)}"/>`,
  );
  // Boxed elements first, then arrows on top (same z-order as the canvas).
  // framesFirst keeps frame sections behind their contents (spec/09).
  for (const el of framesFirst(tab.elements)) {
    if (el.type !== 'arrow') parts.push(svgBoxed(el));
  }
  for (const el of tab.elements) {
    if (el.type === 'arrow') parts.push(svgArrow(el, tab.elements));
  }
  parts.push('</svg>');
  return parts.join('\n');
}

export function exportTabAsSvg(tab: Tab): Blob {
  return new Blob([renderTabToSvg(tab)], { type: 'image/svg+xml' });
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
