// The diagram profile (docs/specs/020-import-export/board-scene.md "Profiles"): the Excalidraw file
// importer's mapping, unchanged in meaning, expressed on scene items. Colours verbatim (the ink is
// unset, never a stock name), unfilled kept as 'transparent', widths and text sizes by the diagram
// buckets, ink as a pencil freehand, multi-point lines as straight-edged freehands.
import {
  MAX_FREEHAND_POINTS,
  type BorderStroke,
  type FreehandElement,
  type ShapeElement,
  type StickyElement,
  type TextElement,
} from '@livediagram/document';
import { colourAlpha } from './colour';
import { boxOfPoints, commonFields, endsMeet, limitPoints } from './common';
import type { LandContext } from './context';
import { CLOSED_END_EPSILON_PX, strokeOpacity } from './land-marks';
import type {
  SceneColour,
  SceneInk,
  ScenePolyline,
  SceneShape,
  SceneSticky,
  SceneStroke,
  SceneText,
  SceneTextItem,
} from './scene';
import { SCENE_FONTS, diagramTextSize } from './text';

const SHAPE_KINDS = {
  rectangle: 'square',
  ellipse: 'circle',
  diamond: 'diamond',
  triangle: 'triangle',
} as const;

/** The diagram buckets the Excalidraw importer has always used. */
export function diagramBorderStroke(px: number): BorderStroke {
  return px <= 1 ? 'thin' : px <= 2.5 ? 'medium' : 'thick';
}

const hexOf = (c: SceneColour | 'ink' | undefined) =>
  c && c !== 'ink' ? { hex: c.hex } : undefined;
const fillOf = (fill: SceneColour | undefined) =>
  fill && colourAlpha(fill) > 0 ? fill.hex : 'transparent';

function strokeFields(stroke: SceneStroke) {
  const colour = hexOf(stroke.colour);
  return {
    ...(colour ? { strokeColor: colour.hex } : {}),
    strokeWidth: diagramBorderStroke(stroke.widthPx),
    ...(stroke.dash === 'dashed' || stroke.dash === 'dotted' ? { strokeStyle: stroke.dash } : {}),
  };
}

function textFields(t: SceneText) {
  const font = SCENE_FONTS[t.family];
  const colour = hexOf(t.colour);
  return {
    label: t.text.replace(/\r\n?/g, '\n'),
    ...(colour ? { textColor: colour.hex } : {}),
    textSize: diagramTextSize(t.fontPx),
    ...(font ? { font } : {}),
    ...(t.alignX ? { textAlignX: t.alignX } : {}),
  };
}

/** Ink, or a line through three or more points, as a freehand; closed when its ends meet. */
export function diagramFreehand(
  item: SceneInk | ScenePolyline,
  id: string,
  ctx: LandContext,
): FreehandElement {
  let points = limitPoints(item.points, MAX_FREEHAND_POINTS);
  const meet = endsMeet(points, CLOSED_END_EPSILON_PX);
  if (meet) points = points.slice(0, -1);
  return {
    id,
    type: 'freehand',
    ...boxOfPoints(points),
    closed: meet || item.closed === true,
    fillColor: fillOf(item.fill),
    ...strokeFields(item.stroke),
    ...(item.kind === 'polyline' ? { straightEdges: true } : {}),
    ...commonFields(item, ctx, strokeOpacity(item.stroke)),
  };
}

export function diagramShape(item: SceneShape, id: string, ctx: LandContext): ShapeElement {
  const { stroke } = item;
  return {
    id,
    type: 'shape',
    shape: SHAPE_KINDS[item.shape],
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    ...(item.shape === 'rectangle' ? { borderRadius: item.rounded ? 'md' : 'none' } : {}),
    fillColor: fillOf(item.fill),
    ...(stroke ? strokeFields(stroke) : { strokeWidth: 'none' as const }),
    ...(item.label && item.label.text.trim() !== '' ? labelOf(item.label) : {}),
    ...commonFields(item, ctx, stroke ? strokeOpacity(stroke) : colourAlpha(item.fill)),
  };
}

// A shape label keeps its vertical alignment too, as the bound text's did.
function labelOf(t: SceneText) {
  return { ...textFields(t), ...(t.alignY ? { textAlignY: t.alignY } : {}) };
}

export function diagramText(item: SceneTextItem, id: string, ctx: LandContext): TextElement | null {
  if (item.text.text.trim() === '') return null;
  return {
    id,
    type: 'text',
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    ...textFields(item.text),
    ...commonFields(item, ctx, colourAlpha(item.text.colour)),
  };
}

export function diagramSticky(item: SceneSticky, id: string, ctx: LandContext): StickyElement {
  return {
    id,
    type: 'sticky',
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    fillColor: item.fill.hex,
    ...(item.text && item.text.text.trim() !== '' ? labelOf(item.text) : {}),
    ...commonFields(item, ctx, colourAlpha(item.fill)),
  };
}
