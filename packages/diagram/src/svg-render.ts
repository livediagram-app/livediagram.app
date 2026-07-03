// Headless SVG renderer for a tab's elements (spec/62 §5). Extracted from the
// editor's export pipeline (apps/live/lib/export-tab.ts) so the SAME element
// drawing serves both the in-app SVG/PNG export AND the MCP worker's inline
// render — one renderer, two callers, no DOM. The per-element drawers
// (svgBoxed / svgArrow / labels) and their pure helpers live here; the in-app
// export keeps only its isometric + backdrop-pattern orchestration on top.
//
// Text measurement degrades to a char-width estimate when there's no DOM
// (Workers / jsdom), so wrapping still works headless.
import {
  angledElbow,
  arrowLabelAnchor,
  arrowPathD,
  curveAnchorPoints,
  curveControlPoint,
} from './arrow-path';
import {
  ARROWHEAD_SIZE_PX,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  type ArrowheadShape,
} from './arrow-style';
import { BORDER_DASH_ARRAY, BORDER_RADIUS_PX } from './border-style';
import {
  defaultArrowStrokeColor,
  defaultFillColor,
  defaultPadding,
  defaultStrokeColor,
  defaultTextAlign,
  defaultTextColor,
} from './colors';
import { endpointPosition } from './geometry';
import { iconBandBounds, techIconMarkBounds } from './icon-size';
import { hasShapeSilhouette, svgFreehandShape, svgShapeSilhouette } from './svg-render-shapes';
import { svgTableShape } from './svg-render-table';
import { hasRichFormatting } from './rich-text';
// Text/number primitives shared with the per-element emitters — re-exported
// below so existing importers of this module keep resolving.
import {
  fontSizeFor,
  labelMaxWidth,
  labelMeasure,
  r2,
  wrapLabel,
  xmlEscape,
} from './svg-render-primitives';

export {
  fontSizeFor,
  LABEL_LINE_HEIGHT,
  labelMaxWidth,
  labelMeasure,
  r2,
  wrapLabel,
  xmlEscape,
} from './svg-render-primitives';
import {
  svgLabel,
  svgRichWrappedLabel,
  svgWrappedLabel,
  type ExportLabel,
  type ExportRun,
} from './svg-render-labels';

export {
  svgLabel,
  svgRichLabel,
  svgRichWrappedLabel,
  svgWrappedLabel,
  wrapExportRuns,
  type ExportLabel,
  type ExportRun,
} from './svg-render-labels';
import { PADDING_PX } from './index';
import type { ArrowElement, BoxedElement, Element, Tab, TextRun } from './index';

export const EXPORT_PADDING = 32;
export const EXPORT_BG = '#ffffff';
export const EXPORT_IMAGE_FILL = '#f1f5f9'; // slate-100 placeholder body
export const EXPORT_IMAGE_STROKE = '#94a3b8'; // slate-400 placeholder dashes
export const EXPORT_IMAGE_LABEL = '#64748b'; // slate-500 alt-text label

// `image` carries the resolved bitmap render info: `href` is a data URL when a
// caller has supplied the bytes (the bitmap is embedded), else undefined (a
// dashed placeholder is drawn — e.g. a headless thumbnail with no bytes on
// hand). `objectFit` / `radius` mirror the on-screen ImageElementView so cover
// crops, contain letterboxes, and avatars clip to a circle. `none` is a
// label-only element (text); the rest carry resolved fill + stroke. `icon` is
// a shape==='icon' element whose glyph a caller resolved (see ResolveIconArt);
// it keeps fill/stroke so the isometric extrusion can tint its silhouette
// column like any other box.
export type ExportShape =
  | { kind: 'image'; href?: string; objectFit: 'cover' | 'contain'; radius: number }
  | { kind: 'ellipse'; fill: string; stroke: string }
  | { kind: 'diamond'; fill: string; stroke: string }
  | { kind: 'rect'; fill: string; stroke: string }
  | { kind: 'icon'; art: ExportIconArt; fill: string; stroke: string }
  | { kind: 'none' };

// Resolves an image element's `imageId` to a data URL to embed, or undefined
// to fall back to the placeholder. The bytes are fetched / read by the caller
// (the browser export prefetches via the authenticated image API; a future
// worker path could read R2), keeping this renderer free of any IO.
export type ResolveImageHref = (imageId: string) => string | undefined;

// Resolved glyph art for a shape==='icon' element, in a 0..24 art box.
// `colored: false` is line art: the markup carries no colours and the
// renderer wraps it with the element's stroke colour (icons tint + theme
// like line drawings on the canvas). `colored: true` is a Technology brand
// mark: the markup is self-coloured (brand tile + white glyph) and is never
// recoloured. Matches @livediagram/icons' IconExportArt structurally — kept
// structural so this package doesn't depend on the catalogue package; each
// caller supplies a resolver (the editor from its async icon registry, the
// Workers from @livediagram/icons/resolve). No resolver, or an unknown id,
// falls back to the pre-icon output: a plain box with the centred label.
export type ExportIconArt = { markup: string; colored: boolean };
export type ResolveIconArt = (iconId: string) => ExportIconArt | undefined;

export type BoxedExport = { opacity: number; shape: ExportShape; label: ExportLabel | null };

// Bounding box of the visible content. Arrows count via free endpoints; boxed
// elements via their rectangle. Empty / degenerate tabs default to a page.
export function contentBounds(elements: Element[]): { x: number; y: number; w: number; h: number } {
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
    } else {
      consider(el.x, el.y);
      consider(el.x + el.width, el.y + el.height);
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 600, h: 400 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// Resolve a boxed element to its export descriptor: branch decision + resolved
// colours + label, using the SAME element-type defaults the editor renders so
// a theme-deferring element exports with its rendered look.
export function describeBoxedExport(
  el: BoxedElement,
  resolveImageHref?: ResolveImageHref,
  resolveIconArt?: ResolveIconArt,
): BoxedExport {
  const opacity = el.opacity ?? 1;
  if (el.type === 'image') {
    // Mirror ImageElementView: borderRadius drives the corner clip (avatar
    // 'full' → circle), objectFit defaults to 'contain'.
    const radius = el.borderRadius !== undefined ? BORDER_RADIUS_PX[el.borderRadius] : 4;
    const objectFit = el.objectFit ?? 'contain';
    const href = el.imageId ? resolveImageHref?.(el.imageId) : undefined;
    return {
      opacity,
      shape: { kind: 'image', href, objectFit, radius },
      // Only paint the alt-text placeholder label when the bitmap ISN'T
      // embedded — an inlined image shouldn't have "Image" text over it.
      label: href
        ? null
        : {
            text: el.alt ?? 'Image',
            x: el.x + el.width / 2,
            y: el.y + el.height / 2,
            anchor: 'middle',
            valign: 'middle',
            maxWidth: labelMaxWidth(el),
            color: EXPORT_IMAGE_LABEL,
            size: 12,
            bold: true,
            italic: false,
          },
    };
  }
  const fill = el.fillColor ?? defaultFillColor(el);
  const stroke = el.strokeColor ?? defaultStrokeColor(el);
  // Icon elements (spec/09 "Icons" line art + spec/41 Technology marks): when
  // a caller supplies the glyph resolver AND the id resolves, export the real
  // art with the caption in the bottom band (mirroring IconGlyph /
  // TechIconGlyph's glyph-above-caption layout). Otherwise fall through to
  // the generic rect branch — the historical box-with-label output — so a
  // resolver-less caller renders exactly what it always did.
  const iconArt =
    el.type === 'shape' && el.shape === 'icon' && el.iconId
      ? resolveIconArt?.(el.iconId)
      : undefined;
  if (iconArt) {
    const size = fontSizeFor(el.textSize);
    // The caption follows the element's alignment (bottom-centre is the
    // icon default), sitting just off its edge; the glyph takes the
    // opposite band (see svgIconShape / techIconMarkBounds).
    const alignX = el.textAlignX ?? 'center';
    const alignY = el.textAlignY ?? 'bottom';
    const labelY =
      alignY === 'top'
        ? el.y + size
        : alignY === 'middle'
          ? el.y + el.height / 2
          : el.y + el.height - size;
    const labelX =
      alignX === 'left' ? el.x + 8 : alignX === 'right' ? el.x + el.width - 8 : el.x + el.width / 2;
    return {
      opacity,
      shape: { kind: 'icon', art: iconArt, fill, stroke },
      label: el.label
        ? {
            text: el.label,
            x: labelX,
            y: labelY,
            anchor: alignX === 'left' ? 'start' : alignX === 'right' ? 'end' : 'middle',
            // A multi-line caption stacks INTO the box from its anchored
            // edge (the editor's band layout) — a bottom caption grows
            // upward, not off the bottom of the element.
            valign: alignY,
            maxWidth: labelMaxWidth(el),
            color: el.textColor ?? defaultTextColor(el),
            size,
            bold: !!el.textBold,
            italic: !!el.textItalic,
          }
        : null,
    };
  }
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
  // Mirror the editor's label layout: alignment defaults per element type
  // (sticky notes are top-left), the padding preset as the inset, and the
  // vertical anchor following textAlignY — a top-aligned frame label must
  // export at the frame's top, not float at its vertical centre.
  const defaults = defaultTextAlign(el);
  const alignX = el.textAlignX ?? defaults.x;
  const alignY = el.textAlignY ?? defaults.y;
  const pad = PADDING_PX[el.padding ?? defaultPadding(el)];
  const label: ExportLabel | null = el.label
    ? {
        text: el.label,
        x:
          alignX === 'right'
            ? el.x + el.width - pad
            : alignX === 'left'
              ? el.x + pad
              : el.x + el.width / 2,
        y:
          alignY === 'top'
            ? el.y + pad + baseSize / 2
            : alignY === 'bottom'
              ? el.y + el.height - pad - baseSize / 2
              : el.y + el.height / 2,
        anchor: alignX === 'right' ? 'end' : alignX === 'left' ? 'start' : 'middle',
        valign: alignY,
        maxWidth: labelMaxWidth(el, pad),
        color: baseColor,
        size: baseSize,
        bold: !!el.textBold,
        italic: !!el.textItalic,
        runs,
      }
    : null;
  return { opacity, shape, label };
}

// Arrowhead reference points (where each head should aim from), honouring
// curve / elbow handles so heads sit tangent to the rendered path.
export function arrowHeadRefs(
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
    const c = curveControlPoint(from, to, arrow.curveOffset, arrow.from, arrow.to);
    return { toRef: c, fromRef: c };
  }
  if (style === 'angled') {
    const elbow = angledElbow(from, to, arrow.from, arrow.to, arrow.elbowOffset);
    return { toRef: elbow, fromRef: elbow };
  }
  return { toRef: from, fromRef: to };
}

// Inline a bitmap as a clipped <image>. The data URL is embedded so the SVG
// stays self-contained when downloaded; preserveAspectRatio maps objectFit
// ('cover' → slice/crop, 'contain' → meet/letterbox) and a per-element
// clipPath rounds the corners (a 'full'-radius avatar clamps to a circle). A
// white backing rect matches the on-screen white background behind the bitmap
// so a letterboxed 'contain' image doesn't show the page colour in its margins.
export function svgImageShape(
  el: BoxedElement,
  href: string,
  objectFit: 'cover' | 'contain',
  radius: number,
): string {
  const x = r2(el.x);
  const y = r2(el.y);
  const w = r2(el.width);
  const h = r2(el.height);
  const rr = r2(Math.min(radius, el.width / 2, el.height / 2));
  const par = objectFit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet';
  // Unique, XML-id-safe clip id per element (element ids are unique per tab).
  const clipId = `lvd-img-${String(el.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rr}" ry="${rr}"/></clipPath>` +
    `<g clip-path="url(#${clipId})">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>` +
    `<image x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${par}" href="${href}"/>` +
    `</g>`
  );
}

// A shape==='icon' element's glyph as a nested <svg> positioned over the
// element box — nesting reproduces the editor's scaling exactly (the canvas
// renders the glyph as an absolutely-positioned svg over the element).
// Line art: viewBox 0 0 24 24 scaled into the glyph band opposite the
// caption (iconBandBounds — the same inverse-alignment bands as Technology
// marks, mirroring IconGlyph). The stroke width is divided by the glyph
// scale so it lands at ~2 rendered units — the on-canvas glyph strokes are
// non-scaling 2px. Technology marks: self-coloured tile art at its fixed
// preset size in the band (TechIconGlyph).
export function svgIconShape(el: BoxedElement, art: ExportIconArt, stroke: string): string {
  if (art.colored) {
    // A Technology mark renders at its fixed preset size (spec/41), centred
    // in the glyph band and clamped to the box — techIconMarkBounds is the
    // single source of that geometry (shared with the connector anchors in
    // geometry.ts), mirroring TechIconGlyph exactly. The band sits OPPOSITE
    // the caption's vertical alignment so moving the text never stacks it
    // over the mark; no label = the whole box.
    const mark = techIconMarkBounds(el);
    return (
      `<svg x="${r2(mark.x)}" y="${r2(mark.y)}" width="${r2(mark.width)}" height="${r2(mark.height)}"` +
      ` viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" overflow="visible">${art.markup}</svg>`
    );
  }
  const band = iconBandBounds(el);
  const scale = Math.min(band.width / 24, band.height / 24);
  const strokeWidth = scale > 0 ? 2 / scale : 2;
  return (
    `<svg x="${r2(band.x)}" y="${r2(band.y)}" width="${r2(band.width)}" height="${r2(band.height)}"` +
    ` viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet" overflow="visible"` +
    ` fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${r2(strokeWidth)}"` +
    ` stroke-linecap="round" stroke-linejoin="round">${art.markup}</svg>`
  );
}

export function svgBoxed(
  el: BoxedElement,
  resolveImageHref?: ResolveImageHref,
  resolveIconArt?: ResolveIconArt,
): string {
  const { opacity, shape, label } = describeBoxedExport(el, resolveImageHref, resolveIconArt);
  const opAttr = opacity !== 1 ? ` opacity="${r2(opacity)}"` : '';
  // Rotation applies to the whole element (body + label) about its centre,
  // exactly like the canvas wrapper's CSS rotate.
  const rotation = el.rotation ?? 0;
  const rotAttr = rotation
    ? ` transform="rotate(${r2(rotation)} ${r2(el.x + el.width / 2)} ${r2(el.y + el.height / 2)})"`
    : '';
  const cx = el.x + el.width / 2;
  const cy = el.y + el.height / 2;
  let shapeStr = '';
  if (el.type === 'table') {
    // The real grid (tracks / headers / zebra / per-cell text), not a
    // box-with-nothing. Tables carry no element label; the cells are the
    // content.
    return `<g${opAttr}${rotAttr}>${svgTableShape(el)}</g>`;
  }
  if (el.type === 'freehand' && shape.kind === 'rect') {
    // The sketch's actual polyline instead of its bounding box.
    return `<g${opAttr}${rotAttr}>${svgFreehandShape(el, shape.stroke, shape.fill)}</g>`;
  }
  if (shape.kind === 'image') {
    shapeStr = shape.href
      ? svgImageShape(el, shape.href, shape.objectFit, shape.radius)
      : `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="6"` +
        ` fill="${EXPORT_IMAGE_FILL}" stroke="${EXPORT_IMAGE_STROKE}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
  } else if (shape.kind === 'ellipse') {
    shapeStr = `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(el.width / 2)}" ry="${r2(el.height / 2)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`;
  } else if (shape.kind === 'diamond') {
    shapeStr = `<polygon points="${r2(cx)},${r2(el.y)} ${r2(el.x + el.width)},${r2(cy)} ${r2(cx)},${r2(el.y + el.height)} ${r2(el.x)},${r2(cy)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else if (shape.kind === 'rect') {
    // Shape silhouettes (hexagon / cylinder / document / devices / actor /
    // frame ...) mirror the editor overlay's geometry; kinds without one
    // (square / sticky / text-box / cards) stay a rounded rect, with the
    // stadium's full pill radius as the one native special case.
    const silhouette =
      el.type === 'shape' && hasShapeSilhouette(el.shape)
        ? svgShapeSilhouette(el, shape.fill, shape.stroke)
        : null;
    const rx =
      el.type === 'shape' && el.shape === 'stadium' ? Math.min(el.width, el.height) / 2 : 6;
    shapeStr =
      silhouette ??
      `<rect x="${r2(el.x)}" y="${r2(el.y)}" width="${r2(el.width)}" height="${r2(el.height)}" rx="${r2(rx)}" fill="${xmlEscape(shape.fill)}" stroke="${xmlEscape(shape.stroke)}" stroke-width="1.5"/>`;
  } else if (shape.kind === 'icon') {
    shapeStr = svgIconShape(el, shape.art, shape.stroke);
  }
  const labelStr = !label
    ? ''
    : label.runs
      ? svgRichWrappedLabel(
          label.runs,
          label.x,
          label.y,
          label.anchor,
          label.maxWidth,
          label.valign,
        )
      : svgWrappedLabel(
          wrapLabel(label.text, label.maxWidth, labelMeasure(label.size, label.bold, label.italic)),
          label.x,
          label.y,
          label.anchor,
          label.color,
          label.size,
          label.bold,
          label.italic,
          label.valign,
        );
  return `<g${opAttr}${rotAttr}>${shapeStr}${labelStr}</g>`;
}

// True when svgBoxed draws something the PNG canvas drawers (drawBoxed)
// can't reproduce natively — the caller then rasterises this element's
// svgBoxed markup instead. Tables, freehand sketches, shape silhouettes,
// rotation, and resolved icon art all fall in.
export function boxedNeedsSvgRaster(el: BoxedElement, resolveIconArt?: ResolveIconArt): boolean {
  if (el.rotation) return true;
  if (el.type === 'table' || el.type === 'freehand') return true;
  if (el.type === 'shape' && (hasShapeSilhouette(el.shape) || el.shape === 'stadium')) return true;
  if (el.type === 'shape' && el.shape === 'icon' && el.iconId && resolveIconArt?.(el.iconId))
    return true;
  return false;
}

export function svgArrowhead(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  // The head-shape + size presets (spec/09): the canvas renders all seven
  // shapes via SVG markers, so the export has to reproduce them or a UML
  // diagram's hollow-triangle inheritance / diamond aggregation flattens
  // into generic filled triangles. Defaults match the canvas defaults.
  shape: ArrowheadShape = 'triangle',
  sizePx: number = ARROWHEAD_SIZE_PX.medium,
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  // The legacy export drew an 8px triangle for the 6px (medium) marker
  // preset; keep that visual weight and scale the other presets from it.
  const size = (8 / ARROWHEAD_SIZE_PX.medium) * sizePx;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const fill = xmlEscape(color);
  // Hollow variants paint white over the line beneath; `line` is an open V.
  const hollow = ` fill="#ffffff" stroke="${fill}" stroke-width="1.5" stroke-linejoin="round"`;
  const pt = (x: number, y: number) => `${r2(x)},${r2(y)}`;
  const tip = pt(to.x, to.y);
  const wingA = pt(
    to.x - size * Math.cos(angle - Math.PI / 6),
    to.y - size * Math.sin(angle - Math.PI / 6),
  );
  const wingB = pt(
    to.x - size * Math.cos(angle + Math.PI / 6),
    to.y - size * Math.sin(angle + Math.PI / 6),
  );
  switch (shape) {
    case 'triangle':
      return `<polygon points="${tip} ${wingA} ${wingB}" fill="${fill}"/>`;
    case 'triangle-hollow':
      return `<polygon points="${tip} ${wingA} ${wingB}"${hollow}/>`;
    case 'line':
      return `<polyline points="${wingA} ${tip} ${wingB}" fill="none" stroke="${fill}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'circle':
    case 'circle-hollow': {
      const radius = size * 0.45;
      const c = { x: to.x - radius * ux, y: to.y - radius * uy };
      return shape === 'circle'
        ? `<circle cx="${r2(c.x)}" cy="${r2(c.y)}" r="${r2(radius)}" fill="${fill}"/>`
        : `<circle cx="${r2(c.x)}" cy="${r2(c.y)}" r="${r2(radius)}"${hollow}/>`;
    }
    case 'diamond':
    case 'diamond-hollow': {
      const length = size * 1.5;
      const width = size * 0.85;
      const mid = { x: to.x - (length / 2) * ux, y: to.y - (length / 2) * uy };
      const points = [
        tip,
        pt(mid.x - (width / 2) * uy, mid.y + (width / 2) * ux),
        pt(to.x - length * ux, to.y - length * uy),
        pt(mid.x + (width / 2) * uy, mid.y - (width / 2) * ux),
      ].join(' ');
      return shape === 'diamond'
        ? `<polygon points="${points}" fill="${fill}"/>`
        : `<polygon points="${points}"${hollow}/>`;
    }
  }
}

export function svgArrow(arrow: ArrowElement, elements: Element[]): string {
  const from = endpointPosition(arrow.from, elements);
  const to = endpointPosition(arrow.to, elements);
  const stroke = arrow.strokeColor ?? defaultArrowStrokeColor();
  const lw = arrow.strokeWidth ?? 2;
  const op = arrow.opacity ?? 1;
  const opAttr = op !== 1 ? ` opacity="${r2(op)}"` : '';
  const style = arrowStyleOf(arrow);
  const parts = [`<g${opAttr}>`];
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
  const headShape = arrowheadShapeOf(arrow);
  const headSize = ARROWHEAD_SIZE_PX[arrowheadSizeOf(arrow)];
  if (ends === 'to' || ends === 'both')
    parts.push(svgArrowhead(toRef, to, stroke, headShape, headSize));
  if (ends === 'from' || ends === 'both')
    parts.push(svgArrowhead(fromRef, from, stroke, headShape, headSize));
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

const isFrameEl = (el: Element): boolean => el.type === 'shape' && el.shape === 'frame';

// Render a tab's elements to a complete SVG string on a solid background, sized
// to the content bounds with padding. Frame sections render behind their
// contents, then boxed elements, then arrows on top. No isometric projection or
// backdrop pattern — those are in-app export extras (apps/live/lib/export-tab).
// This is the renderer the MCP worker rasterises for its inline images.
export function renderElementsToSvg(
  tab: Tab,
  opts: {
    padding?: number;
    background?: string;
    resolveImageHref?: ResolveImageHref;
    resolveIconArt?: ResolveIconArt;
  } = {},
): string {
  const padding = opts.padding ?? EXPORT_PADDING;
  const bounds = contentBounds(tab.elements);
  const vbX = bounds.x - padding;
  const vbY = bounds.y - padding;
  const vbW = bounds.w + padding * 2;
  const vbH = bounds.h + padding * 2;
  const bg = opts.background ?? tab.backgroundColor ?? EXPORT_BG;
  const ordered = tab.elements.some(isFrameEl)
    ? [...tab.elements.filter(isFrameEl), ...tab.elements.filter((el) => !isFrameEl(el))]
    : tab.elements;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bg)}"/>`,
  ];
  for (const el of ordered) {
    if (el.type !== 'arrow') parts.push(svgBoxed(el, opts.resolveImageHref, opts.resolveIconArt));
  }
  for (const el of tab.elements) {
    if (el.type === 'arrow') parts.push(svgArrow(el, tab.elements));
  }
  parts.push('</svg>');
  return parts.join('\n');
}
