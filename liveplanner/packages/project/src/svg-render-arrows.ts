// Arrow SVG emitters (docs/specs/015-api/mcp-server.md §5), split from svg-render.ts alongside
// the -primitives / -shapes / -table / -labels siblings: the arrowhead
// <marker> builder, the per-arrow path + label emitter, and the
// head-reference resolution that keeps heads tangent to curved / angled
// paths. svg-render re-exports everything so importers keep resolving.
import { arrowDashOffset } from './arrow-dash';
import {
  angledElbow,
  arrowPathD,
  angledCornerPoints,
  curveAnchorPoints,
  curveControlPoint,
} from './arrow-path';
import {
  ARROWHEAD_SIZE_PX,
  arrowheadShapeOf,
  arrowheadStartShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  type ArrowheadShape,
} from './arrow-style';
import { BORDER_DASH_ARRAY } from '@liveworkspace/model-core/border-style';
import { ER_GLYPHS } from './er-heads';
import {
  DARK_CANVAS_BACKGROUND_COLOR,
  DEFAULT_BACKGROUND_COLOR,
} from '@liveworkspace/model-core/canvas-colors';
import { defaultArrowLabelColor, defaultArrowStrokeColor, type CanvasSurface } from './colors';
import { ROUTE_BEHIND_MARGIN, routeBehindHoles, routeBehindQueryRect } from './arrow-behind';
import { elementGridFor, queryElementGrid } from './element-grid';
import { svgWrappedLabel } from './svg-render-labels';
import { resolveStockColours } from './stock-colours';
import { KNOCKOUT_RADIUS_PX, arrowLabelPass, type ArrowLabelPass } from './arrow-label-layout';
import type { Rect } from '@liveworkspace/model-core/geometry-primitives';
import { resolveFontStack } from '@liveworkspace/model-core/fonts';
import { elementFontId, finishArrowWidthPx, resolveFinish, type Finish } from './finish';
import { finishArrowEnds } from './mind-connector-route';
import { handDrawnArrow } from './hand-drawn';
import { r2, xmlEscape } from './svg-render-primitives';
import type { ArrowElement, Element } from './index';

// Arrowhead reference points (where each head should aim from), honouring
// curve / elbow handles so heads sit tangent to the rendered path.
function arrowHeadRefs(
  arrow: ArrowElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): { toRef: { x: number; y: number }; fromRef: { x: number; y: number } } {
  const style = arrowStyleOf(arrow);
  const pts = arrow.curvePoints;
  if (pts && pts.length > 0 && (style === 'curved' || style === 'angled')) {
    const anchors =
      style === 'angled'
        ? angledCornerPoints(from, to, pts, arrow.from, arrow.to)
        : curveAnchorPoints(from, to, pts);
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
  // What a hollow head is filled with: the paper beneath, as on the canvas.
  paper = '#ffffff',
): string {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  // The legacy export drew an 8px triangle for the 6px (medium) marker
  // preset; keep that visual weight and scale the other presets from it.
  const size = (8 / ARROWHEAD_SIZE_PX.medium) * sizePx;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const fill = xmlEscape(color);
  // Hollow variants paint white over the line beneath; `line` is an open V.
  const hollow = ` fill="${xmlEscape(paper)}" stroke="${fill}" stroke-width="1.5" stroke-linejoin="round"`;
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
    default: {
      // An ER end (er-heads.ts): its strokes mapped from the marker's box onto the line, x along it back from the
      // tip (10 at the table), y across it.
      const glyph = ER_GLYPHS[shape];
      // 1.5 heads long, as the canvas marker draws it on a 2px line.
      const k = (size * 1.5) / 10;
      const at = (x: number, y: number) =>
        pt(
          to.x + (x - 10) * k * ux - (y - 5) * k * uy,
          to.y + (x - 10) * k * uy + (y - 5) * k * ux,
        );
      const stroke = ` stroke="${fill}" stroke-width="1.5" stroke-linecap="round"`;
      const lines = glyph.lines
        .map(([x1, y1, x2, y2]) => {
          const [a, b] = [at(x1, y1), at(x2, y2)];
          return `<polyline points="${a} ${b}" fill="none"${stroke}/>`;
        })
        .join('');
      const rings = glyph.rings
        .map(([cx, cy, rr]) => {
          const [x, y] = at(cx, cy).split(',');
          return `<circle cx="${x}" cy="${y}" r="${r2(rr * k)}" fill="${xmlEscape(paper)}"${stroke}/>`;
        })
        .join('');
      return lines + rings;
    }
  }
}

// A flow drawn moving rather than still (docs/specs/009-elements/tab-window.md "The drawing"): the line's class,
// its own dash pattern in place of the stroke style's, an optional path length (a 'draw' reveal measures in
// 0..1), and the inline custom properties the class reads. The caller (the editor) builds it from its flow
// tables; every value is our own, never user text.
export type ArrowLineMotion = {
  className: string;
  dash?: string;
  pathLength?: number;
  style: string;
};

export function svgArrow(
  source: ArrowElement,
  elements: Element[],
  surface: CanvasSurface = 'light',
  // The tab's font, for a caption that has not chosen one of its own
  // (docs/specs/004-interface-design/fonts.md), so an exported caption reads in the same face as the canvas.
  tabFont?: string,
  // The tab's label pass (layouts + knockouts), computed once per render by the caller.
  labels: ArrowLabelPass = arrowLabelPass(elements, {
    fontFamilyOf: (a) => arrowLabelFontStack(a, tabFont, tabFinish),
  }),
  // Mask ids live in the project once the markup is inlined; a caller that
  // inlines several renders of the same arrow (thumbnails, the minimap) gives
  // each its own prefix so no render borrows another's mask.
  maskIdPrefix = 'lvd-ko-',
  // The boxes an arrow may pass behind: the ones this render draws. An export
  // that leaves hidden layers out must not break a line around a box that
  // isn't in the picture. Defaults to every element.
  occluders: Iterable<Element> = elements,
  // The paper a hollow head is filled with; the surface's default canvas colour unless the caller
  // knows the tab's own background.
  paper: string = surface === 'dark' ? DARK_CANVAS_BACKGROUND_COLOR : DEFAULT_BACKGROUND_COLOR,
  // The tab's finish (docs/specs/008-canvas/finish.md), for an arrow without its own.
  tabFinish?: Finish,
  // Its flow, drawn moving (a tab window); absent, the line is a still, as every export draws it.
  lineMotion?: ArrowLineMotion,
): string {
  // A stock colour stored by name is drawn in its version for this page.
  const stocked = resolveStockColours(source, surface);
  // Professional thins an arrow that sets no width and draws a mind map's connectors right-angled; Sketch and
  // Marker draw it by hand (docs/specs/008-canvas/finish.md).
  const finish = resolveFinish(stocked.finish, tabFinish);
  // The same ends the live canvas resolves (the converging-fan offset of arrow-endpoint-spread.ts, or a
  // finish's exact route), so exports match what's on screen.
  const { arrow, from, to } = finishArrowEnds(stocked, elements, finish);
  const stroke = arrow.strokeColor ?? defaultArrowStrokeColor(surface);
  const lw = finishArrowWidthPx(arrow.strokeWidth, finish);
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
  // A shared end's pattern is anchored there, so every arrow into it runs in step (arrow-dash.ts).
  const dashOffset = arrowDashOffset(arrow, from, to);
  // A moving flow marches its own pattern, as ArrowView draws it.
  const dashAttr = lineMotion?.dash
    ? ` stroke-dasharray="${xmlEscape(lineMotion.dash)}"`
    : dash
      ? ` stroke-dasharray="${dash}"${dashOffset ? ` stroke-dashoffset="${dashOffset}"` : ''}`
      : '';
  const motionAttr = lineMotion
    ? ` class="${xmlEscape(lineMotion.className)}"` +
      (lineMotion.pathLength ? ` pathLength="${lineMotion.pathLength}"` : '') +
      (lineMotion.style ? ` style="${xmlEscape(lineMotion.style)}"` : '')
    : '';
  // The line breaks around unrelated boxes it crosses, as on the canvas
  // (docs/specs/008-canvas/arrow-route-behind.md), and around the label knockouts. Both go in one
  // mask, the same one ArrowView mints, so the export shows the same gaps.
  const holes = [
    ...routeBehindHoles(arrow, from, to, nearOccluders(occluders, from, to)).map((h) => ({
      ...h,
      rx: ROUTE_BEHIND_MARGIN,
    })),
    ...labels.knockoutsOf(arrow.id).map((k) => ({ ...k, rx: KNOCKOUT_RADIUS_PX })),
  ];
  const maskId =
    holes.length > 0 ? `${maskIdPrefix}${String(arrow.id)}`.replace(/[^a-zA-Z0-9_-]/g, '') : null;
  if (maskId) parts.push(svgArrowMask(maskId, holes));
  const maskAttr = maskId ? ` mask="url(#${xmlEscape(maskId)})"` : '';
  const ends = arrow.arrowEnds ?? 'to';
  const headShape = arrowheadShapeOf(arrow);
  const startShape = arrowheadStartShapeOf(arrow);
  // Two different heads (an ER relationship): the sketch draws one shape for both, so it draws only the line and the
  // heads are drawn exactly.
  const mixed = startShape !== headShape;
  const headPreset = arrowheadSizeOf(arrow);
  const sketched = handDrawnArrow(finish, arrow.id, d, {
    strokePx: lw,
    headSize: headPreset,
    headShape,
    startHead: !mixed && (ends === 'from' || ends === 'both'),
    endHead: !mixed && (ends === 'to' || ends === 'both'),
    // The export is a still: no flow runs, so every pass.
    flowing: false,
  });
  // Marker's ink is see-through, each layer its own path, so where strokes cross it pools darker.
  const ink = sketched && sketched.inkOpacity < 1 ? ` stroke-opacity="${sketched.inkOpacity}"` : '';
  const lineAttrs = ` fill="none" stroke="${xmlEscape(stroke)}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"${ink}`;
  parts.push(`<path d="${sketched?.line ?? d}"${lineAttrs}${dashAttr}${motionAttr}${maskAttr}/>`);
  if (sketched?.lineOver)
    parts.push(`<path d="${sketched.lineOver}"${lineAttrs}${dashAttr}${maskAttr}/>`);
  if (sketched?.heads) {
    const headAttrs = sketched.headFill
      ? lineAttrs.replace(
          ' fill="none"',
          ` fill="${xmlEscape(stroke)}" fill-opacity="${sketched.inkOpacity}"`,
        )
      : lineAttrs;
    parts.push(`<path d="${sketched.heads}"${headAttrs}/>`);
  }
  if (!sketched?.sketchedHeads || mixed) {
    const { toRef, fromRef } = arrowHeadRefs(arrow, from, to);
    const headSize = ARROWHEAD_SIZE_PX[headPreset];
    if (ends === 'to' || ends === 'both')
      parts.push(svgArrowhead(toRef, to, stroke, headShape, headSize, paper));
    if (ends === 'from' || ends === 'both')
      parts.push(svgArrowhead(fromRef, from, stroke, startShape, headSize, paper));
  }
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
        arrowLabelFontStack(arrow, tabFont, tabFinish),
      ),
    );
  }
  parts.push('</g>');
  return parts.join('');
}

// The font stack a caption paints in: its own face, else the handwriting font under Sketch, else the tab's
// (docs/specs/004-interface-design/fonts.md, docs/specs/008-canvas/finish.md). The layout measures with the
// same stack.
export function arrowLabelFontStack(
  arrow: ArrowElement,
  tabFont?: string,
  tabFinish?: Finish,
): string | undefined {
  return (
    resolveFontStack(arrow.font) ??
    resolveFontStack(elementFontId({ finish: arrow.finish }, tabFont, tabFinish))
  );
}

// A mask that paints the line everywhere except its holes (label knockouts and
// the boxes it passes behind). The region is stated explicitly: the default is
// the path's bbox plus 10%, which collapses to a hairline on a straight
// horizontal line.
const MASK_ORIGIN = -1e6;
const MASK_SIZE = 2e6;
function svgArrowMask(id: string, rects: (Rect & { rx: number })[]): string {
  const holes = rects
    .map(
      (k) =>
        `<rect x="${r2(k.x)}" y="${r2(k.y)}" width="${r2(k.width)}" height="${r2(k.height)}" rx="${r2(k.rx)}" fill="black"/>`,
    )
    .join('');
  return (
    `<mask id="${xmlEscape(id)}" maskUnits="userSpaceOnUse" x="${MASK_ORIGIN}" y="${MASK_ORIGIN}" width="${MASK_SIZE}" height="${MASK_SIZE}">` +
    `<rect x="${MASK_ORIGIN}" y="${MASK_ORIGIN}" width="${MASK_SIZE}" height="${MASK_SIZE}" fill="white"/>${holes}</mask>`
  );
}

// The occluders worth testing for one arrow: from a list, its neighbours through the list's element
// grid, so a render of every arrow costs each arrow its neighbourhood rather than the whole board
// (docs/specs/008-canvas/canvas-performance.md).
function nearOccluders(
  occluders: Iterable<Element>,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Iterable<Element> {
  if (!Array.isArray(occluders)) return occluders;
  return queryElementGrid(elementGridFor(occluders), routeBehindQueryRect(from, to));
}
