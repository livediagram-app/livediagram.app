// A draw.io edge as a livediagram arrow
// (docs/specs/020-import-export/blueprints/drawio-import.md step 12): ends
// pinned to the anchor nearest where draw.io attached them, the route and its
// waypoints, the heads, the stroke, and one label from the edge and its
// label children.

import {
  anchorPosition,
  offeredAnchors,
  type Anchor,
  type ArrowElement,
  type ArrowheadShape,
  type ArrowStyle,
  type BoxedElement,
  type Endpoint,
} from '@livediagram/document';
import type { DrawioCell, Pt } from './cells';
import { readInk } from './colour';
import { cellLabel } from './label';
import { DRAWIO_DEFAULT_MARKER_SIZE, DRAWIO_LABEL_CENTRE_EPSILON } from './limits';
import type { DrawioStyle } from './style';
import { arrowheadSizePreset, dashStyle, elementLink, textProps } from './vertex-props';
import type { PageContext } from './vertices';

/** draw.io's routers; any of them draws a right-angled route. */
export const DRAWIO_ANGLED_EDGE_STYLES = new Set([
  'orthogonalEdgeStyle',
  'elbowEdgeStyle',
  'entityRelationEdgeStyle',
  'segmentEdgeStyle',
  'isometricEdgeStyle',
  'sideToSideEdgeStyle',
  'topToBottomEdgeStyle',
]);

type Marker = { shape: ArrowheadShape; exact: boolean };

/** draw.io marker names to livediagram heads; `exact: false` is approximated. */
export const DRAWIO_MARKERS: Record<string, Marker> = {
  classic: { shape: 'triangle', exact: true },
  classicThin: { shape: 'triangle', exact: true },
  block: { shape: 'triangle', exact: true },
  blockThin: { shape: 'triangle', exact: true },
  open: { shape: 'line', exact: true },
  openThin: { shape: 'line', exact: true },
  oval: { shape: 'circle', exact: true },
  circle: { shape: 'circle', exact: true },
  diamond: { shape: 'diamond', exact: true },
  diamondThin: { shape: 'diamond', exact: true },
  async: { shape: 'triangle', exact: false },
  openAsync: { shape: 'line', exact: false },
  doubleBlock: { shape: 'triangle', exact: false },
  box: { shape: 'diamond', exact: false },
  halfCircle: { shape: 'circle', exact: false },
  circlePlus: { shape: 'circle', exact: false },
};

const HOLLOW: Partial<Record<ArrowheadShape, ArrowheadShape>> = {
  triangle: 'triangle-hollow',
  circle: 'circle-hollow',
  diamond: 'diamond-hollow',
};

function marker(style: DrawioStyle, end: 'start' | 'end'): Marker | null {
  const name = style.str(`${end}Arrow`) ?? '';
  if (name === '' || name === 'none') return null;
  const m = DRAWIO_MARKERS[name] ?? { shape: 'line', exact: false };
  const filled = style.str(`${end}Fill`) !== '0';
  return filled ? m : { ...m, shape: HOLLOW[m.shape] ?? m.shape };
}

/** Where an edge end attaches, as the converter resolved it. */
export type EndTarget =
  { kind: 'element'; element: BoxedElement } | { kind: 'point'; at: Pt; loosened: boolean };

export type EdgeInput = {
  cell: DrawioCell;
  source: EndTarget;
  target: EndTarget;
  /** Waypoints, absolute. */
  waypoints: Pt[];
  /** The edge's label children. */
  labels: DrawioCell[];
};

const centre = (el: BoxedElement): Pt => ({ x: el.x + el.width / 2, y: el.y + el.height / 2 });

// Where the segment from the box centre towards `toward` leaves the box, and
// through which side.
function boxExit(el: BoxedElement, toward: Pt): { at: Pt; side: Anchor } {
  const c = centre(el);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return { at: c, side: 'e' };
  const sx = dx === 0 ? Infinity : el.width / 2 / Math.abs(dx);
  const sy = dy === 0 ? Infinity : el.height / 2 / Math.abs(dy);
  const s = Math.min(sx, sy);
  const side: Anchor = sx <= sy ? (dx > 0 ? 'e' : 'w') : dy > 0 ? 's' : 'n';
  return { at: { x: c.x + dx * s, y: c.y + dy * s }, side };
}

function nearestAnchor(el: BoxedElement, point: Pt): Anchor {
  let best: Anchor = 'e';
  let bestD = Infinity;
  for (const anchor of offeredAnchors(el)) {
    const at = anchorPosition(el, anchor);
    const d = (at.x - point.x) ** 2 + (at.y - point.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = anchor;
    }
  }
  return best;
}

const referenceOf = (end: EndTarget): Pt => (end.kind === 'element' ? centre(end.element) : end.at);

function endpoint(
  end: EndTarget,
  style: DrawioStyle,
  prefix: 'exit' | 'entry',
  toward: Pt,
  routed: boolean,
  ctx: PageContext,
): Endpoint {
  if (end.kind === 'point') {
    if (end.loosened) ctx.tally.add('connection-loosened');
    return { kind: 'free', x: end.at.x, y: end.at.y };
  }
  const el = end.element;
  const fx = style.num(`${prefix}X`);
  const fy = style.num(`${prefix}Y`);
  const fixed = fx !== undefined && fy !== undefined;
  if (fixed) {
    const point = { x: el.x + fx * el.width, y: el.y + fy * el.height };
    return { kind: 'pinned', elementId: el.id, anchor: nearestAnchor(el, point) };
  }
  const exit = boxExit(el, toward);
  // An orthogonal route leaves square to the side it crosses: that side's middle.
  const anchor =
    routed && offeredAnchors(el).includes(exit.side) ? exit.side : nearestAnchor(el, exit.at);
  return { kind: 'pinned', elementId: el.id, anchor };
}

const positionOf = (ep: Endpoint, end: EndTarget): Pt =>
  ep.kind === 'pinned' && end.kind === 'element'
    ? anchorPosition(end.element, ep.anchor)
    : ep.kind === 'free'
      ? { x: ep.x, y: ep.y }
      : referenceOf(end);

// Right-angle corners between consecutive points that differ in both axes.
// `vertical` is the direction the next segment leaves in: a corner keeps it
// (the leg into the next point turns), a straight leg flips it.
function orthogonal(points: Pt[], firstVertical: boolean): Pt[] {
  const out: Pt[] = [points[0]!];
  let vertical = firstVertical;
  for (const q of points.slice(1)) {
    const p = out[out.length - 1]!;
    if (p.x !== q.x && p.y !== q.y) {
      out.push(vertical ? { x: p.x, y: q.y } : { x: q.x, y: p.y });
    } else {
      vertical = p.y === q.y;
    }
    out.push(q);
  }
  return out;
}

export function buildArrow(input: EdgeInput, ctx: PageContext, id: string): ArrowElement {
  const { cell, source, target, waypoints } = input;
  const s = cell.style;
  const edgeStyle = s.str('edgeStyle') ?? '';
  // A routed edge leaves and enters through side middles. `curved=1` wins over the router:
  // draw.io smooths the routed path into a curve.
  const routed = DRAWIO_ANGLED_EDGE_STYLES.has(edgeStyle);
  const route: ArrowStyle = s.flag('curved') ? 'curved' : routed ? 'angled' : 'straight';
  const angled = route === 'angled';

  const from = endpoint(source, s, 'exit', waypoints[0] ?? referenceOf(target), routed, ctx);
  const to = endpoint(
    target,
    s,
    'entry',
    waypoints[waypoints.length - 1] ?? referenceOf(source),
    routed,
    ctx,
  );

  const fromAt = positionOf(from, source);
  const toAt = positionOf(to, target);
  let bends: Pt[] = [];
  if (waypoints.length > 0) {
    if (angled) {
      const firstVertical = from.kind === 'pinned' && (from.anchor === 'n' || from.anchor === 's');
      bends = orthogonal([fromAt, ...waypoints, toAt], firstVertical).slice(1, -1);
    } else {
      bends = waypoints;
    }
  }
  const mid = { x: (fromAt.x + toAt.x) / 2, y: (fromAt.y + toAt.y) / 2 };
  const curvePoints = bends.map((p) => ({ dx: p.x - mid.x, dy: p.y - mid.y }));
  // A bent straight edge is a polyline: an angled arrow through its points.
  const arrowStyle: ArrowStyle = curvePoints.length > 0 && route === 'straight' ? 'angled' : route;

  const start = marker(s, 'start');
  const end = marker(s, 'end');
  const arrowEnds = start && end ? 'both' : start ? 'from' : end ? 'to' : 'none';
  const head = (end ?? start)?.shape;
  if (
    (start && !start.exact) ||
    (end && !end.exact) ||
    (start && end && start.shape !== end.shape)
  ) {
    ctx.tally.add('arrowhead-approximated');
  }
  const stroke = readInk(s.str('strokeColor'));
  const width = s.num('strokeWidth') ?? 1;
  const headSize = arrowheadSizePreset(
    s.num(end ? 'endSize' : 'startSize') ?? DRAWIO_DEFAULT_MARKER_SIZE,
    width,
  );
  const opacity = s.num('opacity');
  const strokeStyle = dashStyle(s);
  const link = elementLink(cell.link, ctx);

  // One label: the edge's own, then its label children, one per line.
  const parts = [cell, ...input.labels].map((c) => cellLabel(c).plain).filter((t) => t !== '');
  if (parts.length > 1) ctx.tally.add('label-moved');
  const styled = cell.value.trim() === '' && input.labels[0] ? input.labels[0] : cell;
  const text = textProps(styled, ctx, { scale: 'arrow', rich: false, outsideMovesIn: false });
  const placed = input.labels.find((c) => cellLabel(c).plain !== '')?.geometry;
  const offsetT =
    placed && Math.abs(placed.x) > DRAWIO_LABEL_CENTRE_EPSILON ? (placed.x + 1) / 2 : undefined;

  return {
    id,
    type: 'arrow',
    from,
    to,
    ...(arrowEnds !== 'to' ? { arrowEnds } : {}),
    ...(head && head !== 'triangle' ? { arrowheadShape: head } : {}),
    ...(headSize !== 'medium' ? { arrowheadSize: headSize } : {}),
    ...(arrowStyle !== 'straight' ? { arrowStyle } : {}),
    ...(curvePoints.length > 0 ? { curvePoints } : {}),
    ...(stroke.kind === 'hex' ? { strokeColor: stroke.value } : {}),
    ...(width !== 2 ? { strokeWidth: width } : {}),
    ...(strokeStyle ? { strokeStyle } : {}),
    ...(stroke.kind === 'none'
      ? { opacity: 0 }
      : opacity !== undefined && opacity < 100
        ? { opacity: Math.max(0, opacity) / 100 }
        : {}),
    ...(s.flag('locked') ? { locked: true } : {}),
    ...(link ? { link } : {}),
    ...(parts.length > 0
      ? {
          label: parts.join('\n'),
          textSize: text.textSize,
          ...(text.textBold ? { textBold: true } : {}),
          ...(text.textItalic ? { textItalic: true } : {}),
          ...(text.textUnderline ? { textUnderline: true } : {}),
          ...(text.textStrikethrough ? { textStrikethrough: true } : {}),
          ...(text.textColor ? { textColor: text.textColor } : {}),
          ...(text.font ? { font: text.font } : {}),
          ...(offsetT !== undefined ? { labelOffset: { t: offsetT, offset: placed!.y } } : {}),
        }
      : {}),
  };
}
