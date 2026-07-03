// Arrow SVG emitters (spec/62 §5), split from svg-render.ts alongside
// the -primitives / -shapes / -table / -labels siblings: the arrowhead
// <marker> builder, the per-arrow path + label emitter, and the
// head-reference resolution that keeps heads tangent to curved / angled
// paths. svg-render re-exports everything so importers keep resolving.
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
import { BORDER_DASH_ARRAY } from './border-style';
import { defaultArrowStrokeColor } from './colors';
import { endpointPosition } from './geometry';
import { svgLabel } from './svg-render-labels';
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
