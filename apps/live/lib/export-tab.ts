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
  arrowLabelAnchor,
  arrowPathD,
  arrowStyleOf,
  BORDER_DASH_ARRAY,
  defaultArrowStrokeColor,
  endpointPosition,
  shade,
  type ArrowElement,
  type BoxedElement,
  type Element,
  type Tab,
} from '@livediagram/diagram';
// Shared SVG render helpers (spec/62 §5): moved into the diagram package so the
// MCP worker reuses the same element drawing. The canvas / isometric / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
import {
  arrowHeadRefs,
  contentBounds,
  describeBoxedExport,
  EXPORT_BG,
  EXPORT_IMAGE_FILL,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  labelMaxWidth,
  LABEL_LINE_HEIGHT,
  r2,
  svgArrow,
  svgBoxed,
  wrapLabel,
  xmlEscape,
  type ExportRun,
  type ExportShape,
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

export async function renderTabToCanvas(
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
