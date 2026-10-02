// A draw.io edge as a livediagram arrow
// (docs/specs/020-import-export/blueprints/drawio-import.md step 12): ends
// pinned to the anchor nearest where draw.io attached them, the route and its
// waypoints, the heads, the stroke, and one label from the edge and its
// label children.

import {
  anchorPosition,
  arrowLabelFontSize,
  projectToArrow,
  type ArrowElement,
  type ArrowheadShape,
  type BoxedElement,
  type Endpoint,
  type TextSize,
} from '@livediagram/document';
import { debugLog } from '@/lib/debug-log';
import { exitSide, nearestAnchor, routeShape, simplifyRoute, snapRouteEnds } from './arrow-route';
import type { DrawioCell, Pt } from './cells';
import { readInk } from './colour';
import { cellLabel } from './label';
import { DRAWIO_DEFAULT_MARKER_SIZE } from './limits';
import { labelTextWidth } from './text-size';
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

/** Where an edge end attaches, as the converter resolved it: an element, another edge's arrow,
 *  or nothing (a free end at the route's point; `loosened` when it had a cell). */
export type EndTarget =
  | { kind: 'element'; element: BoxedElement }
  | { kind: 'arrow'; arrowId: string }
  | { kind: 'point'; loosened: boolean };

export type EdgeInput = {
  cell: DrawioCell;
  source: EndTarget;
  target: EndTarget;
  /** draw.io's route as it paints it, both ends included, absolute (route/page.ts). */
  route: Pt[];
  /** The edge's label children. */
  labels: DrawioCell[];
  /** Where draw.io centres the label (route/label.ts), absolute. */
  labelAt?: Pt;
};

/** How much wider than its estimate a caption line may be before it wraps: the estimate is the
 *  label face's mean advance, and a line of wide letters runs past it (D43). Safe range: 1.1 to 1.4. */
export const DRAWIO_CAPTION_WIDTH_SLACK = 1.2;

/** The caption's own wrap width (blueprint step 12.13): its widest line at its size, with slack, so
 *  it breaks only where the author broke it. */
function captionWidth(label: string, size: TextSize | undefined): number {
  const px = arrowLabelFontSize(size ?? 'sm');
  const widest = Math.max(...label.split('\n').map((line) => labelTextWidth(line.length, px)));
  return Math.ceil(widest * DRAWIO_CAPTION_WIDTH_SLACK);
}

/** The one colour every run of a label is set in, when they share one: an arrow caption has no runs,
 *  so a label coloured whole keeps its colour, and one coloured in part is drawn in one. */
function soleRunColour(cell: DrawioCell): string | undefined {
  const runs = cellLabel(cell).runs?.filter((r) => r.text.trim() !== '');
  const first = runs?.[0]?.color;
  return first && runs!.every((r) => r.color === first) ? first : undefined;
}

// A pinned end on the anchor nearest the route's end, on the axis the route leaves along; an end
// on another edge on that edge's arrow (its place along it is resolved once every arrow exists);
// anything else free at the route's end.
function endpoint(end: EndTarget, at: Pt, next: Pt, ctx: PageContext) {
  if (end.kind === 'element') {
    const anchor = nearestAnchor(end.element, at, exitSide(at, next));
    return {
      endpoint: { kind: 'pinned', elementId: end.element.id, anchor } as Endpoint,
      at: anchorPosition(end.element, anchor),
    };
  }
  if (end.kind === 'arrow') {
    return { endpoint: { kind: 'on-arrow', arrowId: end.arrowId, t: 0 } as Endpoint, at };
  }
  if (end.loosened) ctx.tally.add('connection-loosened');
  return { endpoint: { kind: 'free', x: at.x, y: at.y } as Endpoint, at };
}

export function buildArrow(input: EdgeInput, ctx: PageContext, id: string): ArrowElement {
  const { cell, source, target } = input;
  const s = cell.style;
  const orthogonal = DRAWIO_ANGLED_EDGE_STYLES.has(s.str('edgeStyle') ?? '');
  const route = simplifyRoute(input.route);
  const n = route.length;
  const from = endpoint(source, route[0]!, route[1]!, ctx);
  const to = endpoint(target, route[n - 1]!, route[n - 2]!, ctx);
  const points = snapRouteEnds(route, from.at, to.at, orthogonal);
  const shape = routeShape(points, s.flag('curved'));
  debugLog('[drawio-route] arrow', {
    edge: cell.id,
    style: shape.arrowStyle,
    bends: points.length - 2,
    from: from.endpoint.kind === 'pinned' ? from.endpoint.anchor : from.endpoint.kind,
    to: to.endpoint.kind === 'pinned' ? to.endpoint.anchor : to.endpoint.kind,
  });

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

  // One label: the edge's own, then its label children, one per line, styled by the first.
  const labelled = [cell, ...input.labels].filter((c) => cellLabel(c).plain !== '');
  const parts = labelled.map((c) => cellLabel(c).plain);
  if (parts.length > 1) ctx.tally.add('label-moved');
  const styled = labelled[0] ?? cell;
  const text = textProps(styled, ctx, { scale: 'arrow', rich: false, outsideMovesIn: false });
  const textColor = text.textColor ?? soleRunColour(styled);
  const label = parts.join('\n');
  const placement =
    parts.length > 0 && input.labelAt
      ? projectToArrow(
          shape.arrowStyle,
          from.at,
          to.at,
          from.endpoint,
          to.endpoint,
          shape.curveOffset,
          undefined,
          input.labelAt,
          shape.curvePoints,
        )
      : undefined;

  return {
    id,
    type: 'arrow',
    from: from.endpoint,
    to: to.endpoint,
    // draw.io's ends meet where it draws them, and its lines cross what they cross.
    ...(from.endpoint.kind === 'pinned' ? { exactStart: true } : {}),
    ...(to.endpoint.kind === 'pinned' ? { exactEnd: true } : {}),
    routeBehind: false,
    ...(arrowEnds !== 'to' ? { arrowEnds } : {}),
    ...(head && head !== 'triangle' ? { arrowheadShape: head } : {}),
    ...(headSize !== 'medium' ? { arrowheadSize: headSize } : {}),
    ...(shape.arrowStyle !== 'straight' ? { arrowStyle: shape.arrowStyle } : {}),
    ...(shape.curvePoints ? { curvePoints: shape.curvePoints } : {}),
    ...(shape.curveOffset ? { curveOffset: shape.curveOffset } : {}),
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
          label,
          textSize: text.textSize,
          ...(text.textBold ? { textBold: true } : {}),
          ...(text.textItalic ? { textItalic: true } : {}),
          ...(text.textUnderline ? { textUnderline: true } : {}),
          ...(text.textStrikethrough ? { textStrikethrough: true } : {}),
          ...(textColor ? { textColor } : {}),
          ...(text.font ? { font: text.font } : {}),
          ...(placement ? { labelOffset: placement } : {}),
          labelMaxWidth: captionWidth(label, text.textSize),
        }
      : {}),
  };
}
