// Connectors and headed lines (docs/specs/020-import-export/board-scene.md "Kinds"): an arrow whose
// ends pin to the items they were bound to (the nearest anchor) when those landed as boxes, with its
// heads, label and bends. Shared by both profiles; the diagram profile keeps the width verbatim.
import {
  anchorPosition,
  isBoxed,
  offeredAnchors,
  type Anchor,
  type ArrowElement,
  type ArrowheadShape,
  type BoxedElement,
  type Element,
  type Endpoint,
} from '@livediagram/document';
import { lineColourFields, textColourFields, type ResolvedColour } from './colour';
import { commonFields, turnPoints } from './common';
import { LANDING_RULES, type LandContext } from './context';
import type { SceneConnector, SceneHead, ScenePolyline } from './scene';
import { labelFields } from './text';
import { arrowWidthPx } from './width';
import { strokeOpacity } from './land-marks';
import { diagramColourHex } from './land-diagram';

const HEADS: Readonly<Record<SceneHead, ArrowheadShape>> = {
  arrow: 'line',
  bar: 'line',
  triangle: 'triangle',
  'triangle-hollow': 'triangle-hollow',
  circle: 'circle',
  'circle-hollow': 'circle-hollow',
  diamond: 'diamond',
  'diamond-hollow': 'diamond-hollow',
};

type Point = { x: number; y: number };

const withHex = <K extends string>(key: K, hex: string | undefined) =>
  (hex ? { [key]: hex } : {}) as Partial<Record<K, string>>;

/** The anchor on `target` nearest `point`: how a source's binding becomes one of our pins. */
export function nearestAnchor(target: BoxedElement, point: Point): Anchor {
  let best: Anchor = 'e';
  let bestDistance = Infinity;
  for (const anchor of offeredAnchors(target)) {
    const at = anchorPosition(target, anchor);
    const d = (at.x - point.x) ** 2 + (at.y - point.y) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = anchor;
    }
  }
  return best;
}

export type ArrowProfile = 'whiteboard' | 'diagram';

const sameColour = (a: ResolvedColour | null, b: ResolvedColour | null) =>
  JSON.stringify(a ?? { kind: 'ink' }) === JSON.stringify(b ?? { kind: 'ink' });

/**
 * A connector (or a headed polyline) as an arrow. `landed` maps item keys to the elements they
 * became, for the bound ends. On the diagram profile colours are verbatim and the width is the
 * source's px.
 */
export function landArrow(
  item: SceneConnector | ScenePolyline,
  id: string,
  ctx: LandContext,
  landed: ReadonlyMap<string, Element>,
  profile: ArrowProfile,
): ArrowElement {
  const points = turnPoints(item.points, item.rotationDeg);
  const first = points[0]!;
  const last = points[points.length - 1]!;
  const heads = item.heads ?? {};
  const connector = item.kind === 'connector' ? item : null;

  const endpoint = (key: string | undefined, at: Point): Endpoint => {
    const target = key ? landed.get(key) : undefined;
    return target && isBoxed(target)
      ? { kind: 'pinned', elementId: target.id, anchor: nearestAnchor(target, at) }
      : { kind: 'free', x: at.x, y: at.y };
  };

  const arrowEnds =
    heads.start && heads.end ? 'both' : heads.start ? 'from' : heads.end ? 'to' : 'none';
  const head = heads.end ?? heads.start;
  if (heads.start === 'bar' || heads.end === 'bar') ctx.degrade(LANDING_RULES.barHead);
  if (heads.start && heads.end && heads.start !== heads.end) ctx.degrade(LANDING_RULES.twoHeads);
  const shape = head ? HEADS[head] : undefined;

  const mid = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
  const bends = points.slice(1, -1).map((p) => ({ dx: p.x - mid.x, dy: p.y - mid.y }));
  if (bends.length > 0 && !item.curved) ctx.degrade(LANDING_RULES.bentArrow);

  const lineColour = profile === 'whiteboard' ? ctx.colour(item.stroke.colour) : null;
  const colourFields =
    profile === 'whiteboard'
      ? lineColourFields(lineColour)
      : withHex('strokeColor', diagramColourHex(item.stroke.colour, ctx));

  const label = connector?.label && connector.label.text.trim() !== '' ? connector.label : null;
  let labelPart: Partial<ArrowElement> = {};
  if (label) {
    const f = labelFields(label, ctx);
    const own = profile === 'whiteboard' ? ctx.colour(label.colour) : null;
    labelPart = {
      label: f.label,
      textSize: f.textSize,
      ...(f.font ? { font: f.font } : {}),
      ...(f.textBold ? { textBold: true } : {}),
      ...(f.textItalic ? { textItalic: true } : {}),
      ...(f.textUnderline ? { textUnderline: true } : {}),
      ...(f.textStrikethrough ? { textStrikethrough: true } : {}),
      ...(profile === 'whiteboard'
        ? sameColour(own, lineColour)
          ? {}
          : textColourFields(own)
        : withHex('textColor', diagramColourHex(label.colour, ctx))),
    };
  }

  const { rotation: _turned, ...common } = commonFields(item, ctx, strokeOpacity(item.stroke));
  return {
    id,
    type: 'arrow',
    from: endpoint(connector?.from, first),
    to: endpoint(connector?.to, last),
    ...(arrowEnds !== 'to' ? { arrowEnds } : {}),
    ...(shape && shape !== 'triangle' ? { arrowheadShape: shape } : {}),
    ...(bends.length > 0 ? { arrowStyle: 'curved' as const, curvePoints: bends } : {}),
    strokeWidth: profile === 'whiteboard' ? arrowWidthPx(item.stroke.widthPx) : item.stroke.widthPx,
    ...(item.stroke.dash === 'dashed' || item.stroke.dash === 'dotted'
      ? { strokeStyle: item.stroke.dash }
      : {}),
    ...colourFields,
    ...labelPart,
    ...common,
  };
}
