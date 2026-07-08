// Headless SVG renderer for a tab's elements (spec/62 §5). Extracted from the
// editor's export pipeline (apps/live/lib/export-tab.ts) so the SAME element
// drawing serves both the in-app SVG/PNG export AND the MCP worker's inline
// render — one renderer, two callers, no DOM. The per-element drawers
// (svgBoxed / svgArrow / labels) and their pure helpers live here; the in-app
// export keeps only its isometric + backdrop-pattern orchestration on top.
//
// Text measurement degrades to a char-width estimate when there's no DOM
// (Workers / jsdom), so wrapping still works headless.
import { iconBandBounds, techIconMarkBounds } from './icon-size';
import { hasShapeSilhouette, svgFreehandShape, svgShapeSilhouette } from './svg-render-shapes';
import { svgTableShape } from './svg-render-table';
// Text/number primitives shared with the per-element emitters — re-exported
// below so existing importers of this module keep resolving.
import { labelMeasure, r2, wrapLabel, xmlEscape } from './svg-render-primitives';

export {
  fontSizeFor,
  LABEL_LINE_HEIGHT,
  labelMaxWidth,
  labelMeasure,
  r2,
  wrapLabel,
  xmlEscape,
} from './svg-render-primitives';
import { svgRichWrappedLabel, svgWrappedLabel } from './svg-render-labels';

export {
  svgLabel,
  svgRichLabel,
  svgRichWrappedLabel,
  svgWrappedLabel,
  wrapExportRuns,
  type ExportLabel,
  type ExportRun,
} from './svg-render-labels';
import { svgArrow } from './svg-render-arrows';

export { arrowHeadRefs, svgArrow, svgArrowhead } from './svg-render-arrows';
import type { BoxedElement, Element, Tab } from './index';
import { layerBands, layerOpacityOf, visibleLayerElements } from './layers';

// The export descriptor layer (constants, ExportShape / resolver types,
// describeBoxedExport) lives in svg-render-describe.ts; re-exported so
// existing importers of this module keep resolving.
export {
  describeBoxedExport,
  EXPORT_BG,
  EXPORT_IMAGE_FILL,
  EXPORT_IMAGE_LABEL,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  type BoxedExport,
  type ExportIconArt,
  type ExportShape,
  type ResolveIconArt,
  type ResolveImageHref,
} from './svg-render-describe';
import {
  describeBoxedExport,
  EXPORT_BG,
  EXPORT_IMAGE_FILL,
  EXPORT_IMAGE_STROKE,
  EXPORT_PADDING,
  type ExportIconArt,
  type ResolveIconArt,
  type ResolveImageHref,
} from './svg-render-describe';

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

// Render a tab's elements to a complete SVG string on a solid background, sized
// to the content bounds with padding. Layer bands paint bottom -> top with
// frame sections behind their band-mates (spec/74 + spec/09), boxed elements
// before arrows. Hidden layers are skipped, so server snapshots (spec/67) and
// MCP inline images match what the canvas shows. No isometric projection or
// backdrop pattern — those are in-app export extras (apps/live/lib/export-tab).
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
  const visible = visibleLayerElements(tab.elements, tab.layers);
  const bounds = contentBounds(visible);
  const vbX = bounds.x - padding;
  const vbY = bounds.y - padding;
  const vbW = bounds.w + padding * 2;
  const vbH = bounds.h + padding * 2;
  const bg = opts.background ?? tab.backgroundColor ?? EXPORT_BG;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${r2(vbW)}" height="${r2(vbH)}" viewBox="${r2(vbX)} ${r2(vbY)} ${r2(vbW)} ${r2(vbH)}">`,
    `<rect x="${r2(vbX)}" y="${r2(vbY)}" width="${r2(vbW)}" height="${r2(vbH)}" fill="${xmlEscape(bg)}"/>`,
  ];
  // Per band: boxed first, then arrows; a dimmed layer wraps its band in
  // a <g opacity> (spec/74).
  for (const band of layerBands(tab.elements, tab.layers)) {
    const inner: string[] = [];
    for (const el of band.elements) {
      if (el.type !== 'arrow') inner.push(svgBoxed(el, opts.resolveImageHref, opts.resolveIconArt));
    }
    for (const el of band.elements) {
      if (el.type === 'arrow') inner.push(svgArrow(el, tab.elements));
    }
    const opacity = layerOpacityOf(band.layer);
    parts.push(
      opacity < 1 ? `<g opacity="${r2(opacity)}">${inner.join('\n')}</g>` : inner.join('\n'),
    );
  }
  parts.push('</svg>');
  return parts.join('\n');
}
