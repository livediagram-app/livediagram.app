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
  angledElbow,
  arrowLabelAnchor,
  arrowPathD,
  arrowStyleOf,
  BORDER_DASH_ARRAY,
  curveAnchorPoints,
  curveControlPoint,
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  endpointPosition,
  hasRichFormatting,
  shade,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
  type TextRun,
} from '@livediagram/diagram';
import { framesFirst } from './canvas';
import { backgroundPatternTile } from './canvas-backgrounds';
import {
  isoCanvasMatrix,
  isoDepthLayers,
  isoLayerBrightness,
  isoProjectBounds,
  ISO_TILT_DEG,
} from './isometric';

// Shared options for the image exports (PNG / SVG / PDF). `isometric` tilts
// the rendered scene into the editor's isometric projection (spec/45 / 48),
// off by default. `pattern` paints the tab's backdrop pattern (grid / dots /
// …); on by default, the user can switch it off in the Export dialog.
export type ImageExportOpts = { isometric?: boolean; pattern?: boolean };

// Default backdrop pattern colour when a tab leaves it unset (matches the
// editor's fallback).
const EXPORT_PATTERN_COLOR = '#cbd5e1'; // slate-300

// One <pattern> id for the export SVG / canvas rasterisation.
const BG_PATTERN_ID = 'lvd-export-bg';

// The tab's backdrop pattern as an SVG <defs> + a fill ref, or null when the
// pattern is off / blank / unset. Shared by the SVG export (inline) and the
// PNG/PDF rasteriser. Animated patterns + Blank return null (no static image).
function backgroundPatternDefs(
  tab: Tab,
  opts: ImageExportOpts,
): { defs: string; fill: string; width: number; height: number; content: string } | null {
  if (opts.pattern === false || !tab.backgroundPattern) return null;
  const tile = backgroundPatternTile(
    tab.backgroundPattern,
    tab.patternColor ?? EXPORT_PATTERN_COLOR,
    tab.backgroundOpacity ?? 1,
    tab.backgroundPatternScale ?? 1,
  );
  if (!tile) return null;
  const defs =
    `<defs><pattern id="${BG_PATTERN_ID}" patternUnits="userSpaceOnUse" ` +
    `width="${r2(tile.width)}" height="${r2(tile.height)}">${tile.content}</pattern></defs>`;
  return { defs, fill: `url(#${BG_PATTERN_ID})`, ...tile };
}

// Rasterise an SVG string to an Image (for drawing the pattern onto the PNG /
// PDF canvas). Browser-only; the canvas renderer is never reached in non-DOM
// test runs (no 2D context there).
function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('pattern render failed'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// JSON snapshot + Markdown outline — the non-visual export formats.
// They share nothing with the rasteriser below beyond the Tab data
// model, so they live in their own module; re-exported here so the
// existing `@/lib/export-tab` import paths keep resolving unchanged.
export {
  TAB_SCHEMA_VERSION,
  exportTabAsJson,
  exportTabAsMarkdown,
  type ExportedTabEnvelope,
} from './export-tab-text';

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
async function renderTabToCanvas(
  tab: Tab,
  opts: { scale?: number } & ImageExportOpts = {},
): Promise<HTMLCanvasElement> {
  const scale = opts.scale ?? 2; // default 2× for crisp output
  const bounds = contentBounds(tab.elements);
  // Isometric export (spec/45 / 48): project the flat content through the iso
  // affine and size the canvas to the tilted footprint so nothing clips. The
  // matrix is applied to the drawing context after positioning, so every
  // element / arrow drawer stays in plain canvas coordinates.
  const iso = opts.isometric ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  const w = (draw.w + EXPORT_PADDING * 2) * scale;
  const h = (draw.h + EXPORT_PADDING * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(w));
  canvas.height = Math.max(1, Math.floor(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);
  // Background colour, painted across the whole canvas BEFORE the iso tilt so
  // the triangular margins around the parallelogram fill too. The pattern (if
  // on) sits flat over it — like the editor, whose backdrop never tilts.
  ctx.fillStyle = tab.backgroundColor ?? EXPORT_BG;
  ctx.fillRect(0, 0, w / scale, h / scale);
  const bg = backgroundPatternDefs(tab, opts);
  if (bg) {
    const wu = w / scale;
    const hu = h / scale;
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.floor(w)}" height="${Math.floor(h)}" viewBox="0 0 ${r2(wu)} ${r2(hu)}">` +
      `${bg.defs}<rect width="${r2(wu)}" height="${r2(hu)}" fill="${bg.fill}"/></svg>`;
    try {
      const img = await svgToImage(svg);
      ctx.drawImage(img, 0, 0, wu, hu);
    } catch {
      // Pattern is decorative — a render failure must never abort the export.
    }
  }
  // Position the (projected) content min-corner at the padding offset, then
  // apply the iso projection so element coords map onto the tilted plane.
  ctx.translate(EXPORT_PADDING - draw.x, EXPORT_PADDING - draw.y);
  if (iso) ctx.transform(iso.a, iso.b, iso.c, iso.d, 0, 0);

  // Isometric: paint every element's extrusion column first, so all the
  // depth sits behind all the element bodies (matching the editor's single
  // depth plane behind the element layer).
  if (iso) {
    for (const el of framesFirst(tab.elements)) {
      if (el.type !== 'arrow') drawBoxedExtrusion(ctx, el);
    }
  }
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

// The image-placeholder colours shared by both renderers. Element fill /
// stroke / text fall through to the diagram's defaultFillColor / -Stroke /
// -Text (matching the canvas), so there's no separate "export ink" default.
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
  // Fall through to the SAME element-type defaults the canvas uses
  // (defaultFillColor / -Stroke / -Text) so an element that defers its colour
  // to the theme — e.g. every shape on the default brand theme — exports with
  // its rendered look (brand-50 fill / brand-500 border) rather than a flat
  // white box. Themed tabs store explicit colours on each element, so those
  // round-trip unchanged; this only changes the deferring case.
  const fill = el.fillColor ?? defaultFillColor(el);
  const stroke = el.strokeColor ?? defaultStrokeColor(el);
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
  const baseColor = el.textColor ?? defaultTextColor(el);
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

// Build the silhouette path for a boxed export shape at an optional offset
// (canvas px). Shared by the element body and its isometric extrusion copies
// so the two never diverge. `image` shares the rect's rounded outline.
function boxedSilhouettePath(
  ctx: CanvasRenderingContext2D,
  el: BoxedElement,
  kind: ExportShape['kind'],
  dx = 0,
  dy = 0,
): void {
  const x = el.x + dx;
  const y = el.y + dy;
  const cx = x + el.width / 2;
  const cy = y + el.height / 2;
  if (kind === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, el.width / 2, el.height / 2, 0, 0, Math.PI * 2);
  } else if (kind === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(cx, y);
    ctx.lineTo(x + el.width, cy);
    ctx.lineTo(cx, y + el.height);
    ctx.lineTo(x, cy);
    ctx.closePath();
  } else {
    // rect + image both use the rounded outline.
    roundedRect(ctx, x, y, el.width, el.height, 6);
  }
}

// Isometric extrusion (spec/45): behind the element body, paint a stack of its
// silhouette stepped along the projected depth axis — the same voxel column
// the on-screen isometric view renders (IsometricDepthLayer). Each copy is the
// element's accent dimmed toward the floor. The step is computed in element
// space so that, once the iso matrix is applied to the context, every copy
// lands at the right SCREEN depth offset (0, z·sin(elevation)); inverting that
// projection gives the element-space offset z·tan(elevation)·(sinAz, cosAz).
function drawBoxedExtrusion(ctx: CanvasRenderingContext2D, el: BoxedElement): void {
  const { shape, opacity } = describeBoxedExport(el);
  if (shape.kind === 'none') return; // text: no body to extrude
  const accent = shape.kind === 'image' ? EXPORT_IMAGE_STROKE : shape.stroke;
  const az = (ISO_TILT_DEG.z * Math.PI) / 180;
  const k = Math.tan((ISO_TILT_DEG.x * Math.PI) / 180);
  const ox = Math.sin(az);
  const oy = Math.cos(az);
  const layers = isoDepthLayers();
  ctx.save();
  ctx.globalAlpha = opacity;
  // Deepest (floor) first so nearer, brighter copies paint over it.
  for (let i = layers.length - 1; i >= 0; i--) {
    const z = -layers[i]!; // positive depth (floor → just under the element)
    ctx.fillStyle = shade(accent, 1 - isoLayerBrightness(i, layers.length));
    boxedSilhouettePath(ctx, el, shape.kind, z * k * ox, z * k * oy);
    ctx.fill();
  }
  ctx.restore();
}

function drawBoxed(ctx: CanvasRenderingContext2D, el: BoxedElement): void {
  const { opacity, shape, label } = describeBoxedExport(el);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = 1.5;
  if (shape.kind === 'image') {
    ctx.strokeStyle = EXPORT_IMAGE_STROKE;
    ctx.fillStyle = EXPORT_IMAGE_FILL;
    ctx.setLineDash([4, 4]);
    boxedSilhouettePath(ctx, el, 'image');
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (shape.kind !== 'none') {
    ctx.fillStyle = shape.fill;
    ctx.strokeStyle = shape.stroke;
    boxedSilhouettePath(ctx, el, shape.kind);
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
      // Wrap to the element width so long labels stay inside the box, then
      // stack the lines centred on the label's vertical anchor.
      const lines = wrapLabel(label.text, labelMaxWidth(el), (s) => ctx.measureText(s).width);
      const lineH = label.size * LABEL_LINE_HEIGHT;
      let ly = label.y - ((lines.length - 1) * lineH) / 2;
      for (const line of lines) {
        ctx.fillText(line, label.x, ly);
        ly += lineH;
      }
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

// The point that precedes each endpoint along the rendered path, so the
// arrowhead can point along a curved / angled line instead of the straight
// from→to chord (the reported "curves export straight" bug). Mirrors the
// tangent the editor's <ArrowView> draws its heads along.
function arrowHeadRefs(
  arrow: ArrowElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { toRef: { x: number; y: number }; fromRef: { x: number; y: number } } {
  const style = arrowStyleOf(arrow);
  const pts = arrow.curvePoints;
  if (pts && pts.length > 0 && (style === 'curved' || style === 'angled')) {
    const anchors = curveAnchorPoints(from, to, pts);
    return { toRef: anchors[anchors.length - 1]!, fromRef: anchors[0]! };
  }
  if (style === 'curved') {
    const c = curveControlPoint(from, to, arrow.curveOffset);
    return { toRef: c, fromRef: c };
  }
  if (style === 'angled') {
    const elbow = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
    return { toRef: elbow, fromRef: elbow };
  }
  return { toRef: from, fromRef: to };
}

function drawArrow(ctx: CanvasRenderingContext2D, arrow: ArrowElement, elements: Element[]): void {
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const stroke = arrow.strokeColor ?? defaultArrowStrokeColor();
  const lineWidth = arrow.strokeWidth ?? 2;
  const style = arrowStyleOf(arrow);
  ctx.save();
  ctx.globalAlpha = arrow.opacity ?? 1;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // Honour the line pattern (dashed / dotted / …) like the editor does.
  const dash = BORDER_DASH_ARRAY[arrow.strokeStyle ?? 'solid'];
  if (dash) ctx.setLineDash(dash.split(' ').map(Number));
  // Stroke the SAME path the editor renders (straight / curved / angled,
  // honouring drag handles) via its shared SVG path data.
  const d = arrowPathD(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  ctx.stroke(new Path2D(d));
  ctx.setLineDash([]);
  // Arrowheads — small triangles pointing along the path's end tangents.
  const { toRef, fromRef } = arrowHeadRefs(arrow, from, to);
  const ends = arrow.arrowEnds ?? 'to';
  if (ends === 'to' || ends === 'both') drawArrowhead(ctx, toRef, to);
  if (ends === 'from' || ends === 'both') drawArrowhead(ctx, fromRef, from);
  if (arrow.label) {
    const anchor = arrowLabelAnchor(
      style,
      from,
      to,
      arrow.from,
      arrow.to,
      arrow.curveOffset,
      arrow.elbowOffset,
      arrow.labelOffset,
      arrow.curvePoints,
    );
    ctx.fillStyle = '#0f172a';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(arrow.label, anchor.x, anchor.y - 4);
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

// Horizontal room a label has inside its element — the box width minus the
// same ~8px inset the label x already uses on each side. Both renderers wrap
// to this so long labels (sticky notes especially) stay inside the element
// instead of spilling out as one illegible line (the reported bug).
function labelMaxWidth(el: BoxedElement): number {
  return Math.max(8, el.width - 16);
}
const LABEL_LINE_HEIGHT = 1.25;

// Greedy word-wrap to a max pixel width, preserving explicit newlines. A
// single word wider than the box is left whole (no mid-word breaking) — it
// still overflows far less than the previous unwrapped single line.
function wrapLabel(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let cur = words[0]!;
    for (let i = 1; i < words.length; i++) {
      const w = words[i]!;
      if (measure(`${cur} ${w}`) <= maxWidth) cur += ` ${w}`;
      else {
        out.push(cur);
        cur = w;
      }
    }
    out.push(cur);
  }
  return out;
}

// A reusable measuring 2D context for the SVG path (the canvas renderer
// measures on its own context). Null in non-DOM environments (jsdom tests),
// where we fall back to a rough character-width estimate so wrapping still
// degrades gracefully rather than throwing.
let _labelMeasureCtx: CanvasRenderingContext2D | null | undefined;
function labelMeasure(size: number, bold: boolean, italic: boolean): (s: string) => number {
  if (_labelMeasureCtx === undefined) {
    _labelMeasureCtx =
      typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  const ctx = _labelMeasureCtx;
  if (!ctx) return (s) => s.length * size * 0.55;
  ctx.font = `${bold ? '600' : '400'} ${italic ? 'italic ' : ''}${size}px system-ui, sans-serif`;
  return (s) => ctx.measureText(s).width;
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

// A word-wrapped plain label as one anchored <text> with a <tspan> per line,
// each dy a line-height below the last, centred on the vertical anchor — the
// SVG counterpart of the canvas multi-line label.
function svgWrappedLabel(
  lines: string[],
  x: number,
  y: number,
  anchor: 'start' | 'middle' | 'end',
  color: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
): string {
  const lineH = fontSize * LABEL_LINE_HEIGHT;
  const firstY = y - ((lines.length - 1) * lineH) / 2;
  const tspans = lines
    .map(
      (line, i) => `<tspan x="${r2(x)}" dy="${i === 0 ? 0 : r2(lineH)}">${xmlEscape(line)}</tspan>`,
    )
    .join('');
  return (
    `<text x="${r2(x)}" y="${r2(firstY)}" font-family="system-ui, sans-serif" font-size="${fontSize}"` +
    ` font-weight="${bold ? 600 : 400}"${italic ? ' font-style="italic"' : ''}` +
    ` fill="${xmlEscape(color)}" text-anchor="${anchor}" dominant-baseline="central">${tspans}</text>`
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
      : svgWrappedLabel(
          wrapLabel(
            label.text,
            labelMaxWidth(el),
            labelMeasure(label.size, label.bold, label.italic),
          ),
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

// A single filled silhouette (no stroke / label) at an offset — the SVG
// counterpart of boxedSilhouettePath, used for the isometric extrusion copies.
function svgSilhouette(
  el: BoxedElement,
  kind: ExportShape['kind'],
  dx: number,
  dy: number,
  fill: string,
): string {
  const x = el.x + dx;
  const y = el.y + dy;
  const cx = x + el.width / 2;
  const cy = y + el.height / 2;
  if (kind === 'ellipse') {
    return `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(el.width / 2)}" ry="${r2(el.height / 2)}" fill="${xmlEscape(fill)}"/>`;
  }
  if (kind === 'diamond') {
    return `<polygon points="${r2(cx)},${r2(y)} ${r2(x + el.width)},${r2(cy)} ${r2(cx)},${r2(y + el.height)} ${r2(x)},${r2(cy)}" fill="${xmlEscape(fill)}"/>`;
  }
  return `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6" fill="${xmlEscape(fill)}"/>`;
}

// Isometric extrusion column for one boxed element (spec/45) — the SVG
// counterpart of drawBoxedExtrusion. Stepped silhouette copies, dimmed toward
// the floor, behind the element body.
function svgBoxedExtrusion(el: BoxedElement): string {
  const { shape, opacity } = describeBoxedExport(el);
  if (shape.kind === 'none') return '';
  const accent = shape.kind === 'image' ? EXPORT_IMAGE_STROKE : shape.stroke;
  const az = (ISO_TILT_DEG.z * Math.PI) / 180;
  const k = Math.tan((ISO_TILT_DEG.x * Math.PI) / 180);
  const ox = Math.sin(az);
  const oy = Math.cos(az);
  const layers = isoDepthLayers();
  const opAttr = opacity !== 1 ? ` opacity="${r2(opacity)}"` : '';
  const parts = [`<g${opAttr}>`];
  for (let i = layers.length - 1; i >= 0; i--) {
    const z = -layers[i]!;
    const fill = shade(accent, 1 - isoLayerBrightness(i, layers.length));
    parts.push(svgSilhouette(el, shape.kind, z * k * ox, z * k * oy, fill));
  }
  parts.push('</g>');
  return parts.join('');
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
  const stroke = arrow.strokeColor ?? defaultArrowStrokeColor();
  const lw = arrow.strokeWidth ?? 2;
  const op = arrow.opacity ?? 1;
  const opAttr = op !== 1 ? ` opacity="${r2(op)}"` : '';
  const style = arrowStyleOf(arrow);
  const parts = [`<g${opAttr}>`];
  // The same path the editor renders (straight / curved / angled, honouring
  // the curve / elbow drag handles) — not a flat from→to line (the reported
  // "curves export straight" bug).
  const d = arrowPathD(
    style,
    from,
    to,
    arrow.from,
    arrow.to,
    arrow.curveOffset,
    arrow.elbowOffset,
    arrow.curvePoints,
  );
  const dash = BORDER_DASH_ARRAY[arrow.strokeStyle ?? 'solid'];
  const dashAttr = dash ? ` stroke-dasharray="${dash}"` : '';
  parts.push(
    `<path d="${d}" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}/>`,
  );
  const { toRef, fromRef } = arrowHeadRefs(arrow, from, to);
  const ends = arrow.arrowEnds ?? 'to';
  if (ends === 'to' || ends === 'both') parts.push(svgArrowhead(toRef, to, stroke));
  if (ends === 'from' || ends === 'both') parts.push(svgArrowhead(fromRef, from, stroke));
  if (arrow.label) {
    const anchor = arrowLabelAnchor(
      style,
      from,
      to,
      arrow.from,
      arrow.to,
      arrow.curveOffset,
      arrow.elbowOffset,
      arrow.labelOffset,
      arrow.curvePoints,
    );
    parts.push(
      svgLabel(arrow.label, anchor.x, anchor.y - 6, 'middle', '#0f172a', 12, false, false),
    );
  }
  parts.push('</g>');
  return parts.join('');
}

function renderTabToSvg(tab: Tab, opts: ImageExportOpts = {}): string {
  const bounds = contentBounds(tab.elements);
  // Isometric export: the viewBox spans the projected (tilted) footprint and a
  // <g matrix> applies the iso projection to the content, while the background
  // rect stays in viewBox space so it fills the whole frame.
  const iso = opts.isometric ? isoCanvasMatrix() : null;
  const draw = iso ? isoProjectBounds(bounds, iso) : bounds;
  const vbX = draw.x - EXPORT_PADDING;
  const vbY = draw.y - EXPORT_PADDING;
  const vbW = draw.w + EXPORT_PADDING * 2;
  const vbH = draw.h + EXPORT_PADDING * 2;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
  );
  parts.push(
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(tab.backgroundColor ?? EXPORT_BG)}"/>`,
  );
  // Backdrop pattern (spec/48) over the colour, flat (never tilted — the
  // editor's backdrop doesn't tilt in isometric either).
  const bg = backgroundPatternDefs(tab, opts);
  if (bg) {
    parts.push(bg.defs);
    parts.push(
      `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${bg.fill}"/>`,
    );
  }
  if (iso) {
    parts.push(`<g transform="matrix(${r2(iso.a)} ${r2(iso.b)} ${r2(iso.c)} ${r2(iso.d)} 0 0)">`);
    // All extrusion columns behind all element bodies (matching the canvas).
    for (const el of framesFirst(tab.elements)) {
      if (el.type !== 'arrow') parts.push(svgBoxedExtrusion(el));
    }
  }
  // Boxed elements first, then arrows on top (same z-order as the canvas).
  // framesFirst keeps frame sections behind their contents (spec/09).
  for (const el of framesFirst(tab.elements)) {
    if (el.type !== 'arrow') parts.push(svgBoxed(el));
  }
  for (const el of tab.elements) {
    if (el.type === 'arrow') parts.push(svgArrow(el, tab.elements));
  }
  if (iso) parts.push('</g>');
  parts.push('</svg>');
  return parts.join('\n');
}

export function exportTabAsSvg(tab: Tab, opts: ImageExportOpts = {}): Blob {
  return new Blob([renderTabToSvg(tab, opts)], { type: 'image/svg+xml' });
}

// ---------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------

export async function exportTabAsPng(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
  const canvas = await renderTabToCanvas(tab, opts);
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

export async function exportTabAsPdf(tab: Tab, opts: ImageExportOpts = {}): Promise<Blob> {
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
