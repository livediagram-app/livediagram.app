// Arrow SVG emitters (docs/specs/015-api/mcp-server.md §5), split from svg-render.ts alongside
// the -primitives / -shapes / -table / -labels siblings: the arrowhead
// <marker> builder, the per-arrow path + label emitter, and the
// head-reference resolution that keeps heads tangent to curved / angled
// paths. svg-render re-exports everything so importers keep resolving.
import { angledElbow, arrowPathD, curveAnchorPoints, curveControlPoint } from './arrow-path';
import {
  ARROWHEAD_SIZE_PX,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  type ArrowheadShape,
} from './arrow-style';
import { BORDER_DASH_ARRAY } from './border-style';
import { defaultArrowLabelColor, defaultArrowStrokeColor, type CanvasSurface } from './colors';
import { arrowEndpointSpread } from './arrow-endpoint-spread';
import { endpointPosition } from './geometry';
import { svgWrappedLabel } from './svg-render-labels';
import { KNOCKOUT_RADIUS_PX, arrowLabelPass, type ArrowLabelPass } from './arrow-label-layout';
import type { Rect } from './geometry-primitives';
import { resolveFontStack } from './fonts';
import { r2, xmlEscape } from './svg-render-primitives';
import type { ArrowElement, Element } from './index';

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

export function svgArrowhead(
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  // The head-shape + size presets (docs/specs/008-canvas/canvas-and-palette.md): the canvas renders all seven
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

export function svgArrow(
  arrow: ArrowElement,
  elements: Element[],
  surface: CanvasSurface = 'light',
  // The tab's font, for a caption that has not chosen one of its own
  // (docs/specs/004-interface-design/fonts.md), so an exported caption reads in the same face as the board.
  tabFont?: string,
  // The tab's label pass (layouts + knockouts), computed once per render by the caller.
  labels: ArrowLabelPass = arrowLabelPass(elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont),
  }),
  // Mask ids live in the document once the markup is inlined; a caller that
  // inlines several renders of the same arrow (thumbnails, the minimap) gives
  // each its own prefix so no render borrows another's mask.
  maskIdPrefix = 'lvd-ko-',
): string {
  // Same converging-fan offset the live canvas applies (see
  // arrow-endpoint-spread.ts), so exports match what's on screen.
  const rawFrom = endpointPosition(arrow.from, elements);
  const rawTo = endpointPosition(arrow.to, elements);
  const fromSpread = arrowEndpointSpread(arrow.id, 'from', elements);
  const toSpread = arrowEndpointSpread(arrow.id, 'to', elements);
  const from = { x: rawFrom.x + fromSpread.x, y: rawFrom.y + fromSpread.y };
  const to = { x: rawTo.x + toSpread.x, y: rawTo.y + toSpread.y };
  const stroke = arrow.strokeColor ?? defaultArrowStrokeColor(surface);
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
  const knockouts = labels.knockoutsOf(arrow.id);
  const maskId =
    knockouts.length > 0
      ? `${maskIdPrefix}${String(arrow.id)}`.replace(/[^a-zA-Z0-9_-]/g, '')
      : null;
  if (maskId) parts.push(svgKnockoutMask(maskId, knockouts));
  const maskAttr = maskId ? ` mask="url(#${xmlEscape(maskId)})"` : '';
  parts.push(
    `<path d="${d}" fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${dashAttr}${maskAttr}/>`,
  );
  const { toRef, fromRef } = arrowHeadRefs(arrow, from, to);
  const ends = arrow.arrowEnds ?? 'to';
  const headShape = arrowheadShapeOf(arrow);
  const headSize = ARROWHEAD_SIZE_PX[arrowheadSizeOf(arrow)];
  if (ends === 'to' || ends === 'both')
    parts.push(svgArrowhead(toRef, to, stroke, headShape, headSize));
  if (ends === 'from' || ends === 'both')
    parts.push(svgArrowhead(fromRef, from, stroke, headShape, headSize));
  const layout = labels.layouts.get(arrow.id);
  if (layout) {
    // The caption as it is actually styled (docs/specs/008-canvas/arrow-labels.md): laid out by the
    // same engine as the canvas, so it wraps at the same words and sits at the same spot.
    const { center, width, height } = layout;
    if (arrow.labelFill && arrow.labelFill !== 'transparent') {
      parts.push(
        `<rect x="${r2(center.x - width / 2)}" y="${r2(center.y - height / 2)}"` +
          ` width="${r2(width)}" height="${r2(height)}" rx="${KNOCKOUT_RADIUS_PX}"` +
          ` fill="${xmlEscape(arrow.labelFill)}"/>`,
      );
    }
    parts.push(
      svgWrappedLabel(
        layout.lines,
        center.x,
        center.y,
        'middle',
        // The same colour the canvas paints it (defaultArrowLabelColor).
        defaultArrowLabelColor(arrow, surface),
        layout.fontPx,
        !!arrow.textBold,
        !!arrow.textItalic,
        'middle',
        arrowLabelFontStack(arrow, tabFont),
      ),
    );
  }
  parts.push('</g>');
  return parts.join('');
}

// The font stack a caption paints in: its own face, else the tab's
// (docs/specs/004-interface-design/fonts.md). The layout measures with the same stack.
export function arrowLabelFontStack(arrow: ArrowElement, tabFont?: string): string | undefined {
  return resolveFontStack(arrow.font) ?? resolveFontStack(tabFont);
}

// A mask that paints the line everywhere except the label knockouts. The
// region is stated explicitly: the default is the path's bbox plus 10%, which
// collapses to a hairline on a straight horizontal line.
const MASK_ORIGIN = -1e6;
const MASK_SIZE = 2e6;
function svgKnockoutMask(id: string, rects: Rect[]): string {
  const holes = rects
    .map(
      (k) =>
        `<rect x="${r2(k.x)}" y="${r2(k.y)}" width="${r2(k.width)}" height="${r2(k.height)}" rx="${KNOCKOUT_RADIUS_PX}" fill="black"/>`,
    )
    .join('');
  return (
    `<mask id="${xmlEscape(id)}" maskUnits="userSpaceOnUse" x="${MASK_ORIGIN}" y="${MASK_ORIGIN}" width="${MASK_SIZE}" height="${MASK_SIZE}">` +
    `<rect x="${MASK_ORIGIN}" y="${MASK_ORIGIN}" width="${MASK_SIZE}" height="${MASK_SIZE}" fill="white"/>${holes}</mask>`
  );
}
