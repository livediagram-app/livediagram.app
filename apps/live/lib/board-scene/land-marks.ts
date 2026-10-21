// Ink and unheaded lines on the whiteboard profile (docs/specs/020-import-export/board-scene.md
// "Kinds"): ink becomes a marker stroke, a two-point line a line.
import {
  MAX_FREEHAND_POINTS,
  packFreehandPoints,
  penColourHex,
  type ArrowElement,
  type FreehandElement,
} from '@liveplanner/document';
import { colourAlpha, lineColourFields } from './colour';
import { commonFields, endsMeet, limitPoints, turnPoints } from './common';
import { LANDING_RULES, type LandContext } from './context';
import type { SceneInk, ScenePoint, ScenePolyline, SceneStroke } from './scene';
import { arrowWidthPx, markerWidthPx } from './width';

// A pen's width as the validator takes it (1 to 100 px, validate.ts FREEHAND_FIELD_CHECKS): a scaled-up
// highlighter (an MS Whiteboard group at scale 5) would otherwise land at 150 and make the tab unsaveable.
const PEN_WIDTH_MIN_PX = 1;
const PEN_WIDTH_MAX_PX = 100;
const clampPenWidth = (px: number) => Math.min(PEN_WIDTH_MAX_PX, Math.max(PEN_WIDTH_MIN_PX, px));

// Ends within this many px coincide (the Excalidraw importer's closure test).
export const CLOSED_END_EPSILON_PX = 1;

/** The element opacity a stroke asks for: its own times its colour's alpha. */
export function strokeOpacity(stroke: SceneStroke, colour = stroke.colour): number {
  return (stroke.opacity ?? 1) * colourAlpha(colour);
}

const dashOf = (stroke: SceneStroke) =>
  stroke.dash === 'dashed' || stroke.dash === 'dotted' ? { strokeStyle: stroke.dash } : {};

/** An ink item as a marker (or highlighter) stroke. */
export function landInk(item: SceneInk, id: string, ctx: LandContext): FreehandElement {
  const { stroke } = item;
  // Multicolour ink lands in the representative colour its parser picked (and reported); with
  // none picked (the ink), in its first stop, with the generic rule.
  const unpicked = !!stroke.stops?.length && stroke.colour === 'ink';
  const colour = unpicked ? stroke.stops![0]! : stroke.colour;
  if (unpicked) ctx.degrade(LANDING_RULES.multicolourInk);
  if (item.fill) ctx.degrade(LANDING_RULES.filledInk);
  if (stroke.dash && stroke.dash !== 'solid') ctx.degrade(LANDING_RULES.dashedInk);
  let points: ScenePoint[] = limitPoints(item.points, MAX_FREEHAND_POINTS - 1);
  if (points.length < item.points.length) ctx.degrade(LANDING_RULES.longStroke);
  if (item.closed && !endsMeet(points, CLOSED_END_EPSILON_PX)) points = [...points, points[0]!];
  const pressured = points.every((p) => p.p !== undefined && Number.isFinite(p.p));
  // The one writer of a stroke's points (docs/specs/006-document/stroke-points.md): its box and the
  // packed block, quantised by the codec.
  const packed = packFreehandPoints(
    points,
    pressured && !item.highlighter ? points.map((p) => Math.min(1, Math.max(0, p.p!))) : undefined,
  );
  const resolved = ctx.colour(colour);
  const common = commonFields(item, ctx, strokeOpacity(stroke, colour));
  if (item.highlighter) {
    // The highlighter has no named colour: a stock colour lands as its light-board version.
    const strokeColor =
      resolved?.kind === 'stock'
        ? penColourHex(resolved.name, 'light')
        : resolved?.kind === 'hex'
          ? resolved.hex
          : undefined;
    return {
      id,
      type: 'freehand',
      ...packed,
      closed: false,
      pen: 'highlighter',
      penWidth: clampPenWidth(stroke.widthPx > 0 ? stroke.widthPx : markerWidthPx(stroke.widthPx)),
      ...(strokeColor ? { strokeColor } : {}),
      ...common,
    };
  }
  return {
    id,
    type: 'freehand',
    ...packed,
    closed: false,
    penWidth: markerWidthPx(stroke.widthPx),
    // Absent reads as none, the renderer's default (freehandPenStroke).
    ...(item.streamline !== undefined && item.streamline > 0
      ? { streamline: item.streamline }
      : {}),
    ...lineColourFields(resolved),
    ...common,
  };
}

/** A two-point unheaded line: the whiteboard's Line (an arrow with no heads). */
export function landLine(item: ScenePolyline, id: string, ctx: LandContext): ArrowElement {
  // A line has no rotation of its own: its ends are turned instead.
  const turned = turnPoints(item.points, item.rotationDeg);
  const [a, b] = [turned[0]!, turned[turned.length - 1]!];
  const { rotation: _turned, ...common } = commonFields(item, ctx, strokeOpacity(item.stroke));
  return {
    id,
    type: 'arrow',
    from: { kind: 'free', x: a.x, y: a.y },
    to: { kind: 'free', x: b.x, y: b.y },
    arrowEnds: 'none',
    strokeWidth: arrowWidthPx(item.stroke.widthPx),
    ...dashOf(item.stroke),
    ...lineColourFields(ctx.colour(item.stroke.colour)),
    ...common,
  };
}
