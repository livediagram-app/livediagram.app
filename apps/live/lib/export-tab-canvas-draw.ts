// Canvas 2D element drawing for tab export (PNG/PDF rasteriser): boxed
// shapes (incl. isometric extrusion + silhouette) and arrows, drawn into a
// CanvasRenderingContext2D. Split out of export-tab.ts.
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
} from '@livediagram/diagram';
// Shared SVG render helpers (spec/62 §5): moved into the diagram package so the
// MCP worker reuses the same element drawing. The canvas / isometric / backdrop
// orchestration below stays here and imports the per-element drawers + helpers.
import {
  arrowHeadRefs,
  describeBoxedExport,
  EXPORT_IMAGE_FILL,
  EXPORT_IMAGE_STROKE,
  labelMaxWidth,
  LABEL_LINE_HEIGHT,
  wrapLabel,
  type ExportRun,
  type ExportShape,
} from '@livediagram/diagram';
import { isoDepthLayers, isoLayerBrightness, ISO_TILT_DEG } from './isometric';

// Shared options for the image exports (PNG / SVG / PDF). `isometric` tilts
// the rendered scene into the editor's isometric projection (spec/45 / 48),
// off by default. `pattern` paints the tab's backdrop pattern (grid / dots /

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
export function drawBoxedExtrusion(ctx: CanvasRenderingContext2D, el: BoxedElement): void {
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

export function drawBoxed(ctx: CanvasRenderingContext2D, el: BoxedElement): void {
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
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  arrow: ArrowElement,
  elements: Element[],
): void {
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
