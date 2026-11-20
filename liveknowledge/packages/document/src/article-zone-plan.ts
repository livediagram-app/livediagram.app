// A new zone's plan (article-intake.ts, docs/specs/007-editor/article-pages.md "Zones"): which kind of zone the
// elements coming in make (a drawing or an object), how big it is, and where they sit in it. Pure.

import { ARTICLE_ZONE_MAX, ARTICLE_ZONE_MIN, type ArticleZoneKind } from './article-flow';
import { zoneAnchorOf } from './article-zones';
import { isBoxed, type Element } from './index';
import { type PageRect } from './page';
import type { ShapeKind } from './shape-kind';

// The shapes a diagram is drawn with: these, arrows, text, sticky notes and pen strokes go into a
// drawing zone; everything else (a chart, a table, an image, a component) is an object.
const DRAWING_SHAPES: ReadonlySet<ShapeKind> = new Set<ShapeKind>([
  'square',
  'circle',
  'diamond',
  'cylinder',
  'parallelogram',
  'hexagon',
  'document',
  'stadium',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
]);

/** Whether an element is drawn with (and so goes into a drawing zone). A sticky note is an object
 *  of its own (an object zone: in line, wrapped or floating, no boundary), though one dropped into
 *  a drawing joins it there. */
export function isDrawingElement(el: Element): boolean {
  if (el.type === 'arrow' || el.type === 'text') return true;
  if (el.type === 'freehand') return true;
  return el.type === 'shape' && DRAWING_SHAPES.has(el.shape);
}

// A drawing zone's room around what is drawn in it, and the least height it starts with.
export const ARTICLE_DRAWING_PAD = 24;
const ARTICLE_DRAWING_MIN_HEIGHT = 200;

export const boundsOf = (els: readonly Element[], all: readonly Element[]): PageRect => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const el of els) {
    if (isBoxed(el)) {
      x0 = Math.min(x0, el.x);
      y0 = Math.min(y0, el.y);
      x1 = Math.max(x1, el.x + el.width);
      y1 = Math.max(y1, el.y + el.height);
    } else {
      const p = zoneAnchorOf(el, all);
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  }
  return { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) };
};

export type ZonePlan = {
  zone: ArticleZoneKind;
  width: number;
  height: number;
  // Where the zone's elements were, as one box: they keep their arrangement inside the zone.
  bounds: PageRect;
  // An object wider than the text is scaled down to it.
  scale: number;
};

/** The zone a set of newly added elements goes into: an object zone hugging a single object, else
 *  a drawing zone the text's width, tall enough for them with room to spare. */
export function zonePlanFor(
  added: readonly Element[],
  all: readonly Element[],
  textWidth: number,
  textHeight: number = ARTICLE_ZONE_MAX,
): ZonePlan {
  const bounds = boundsOf(added, all);
  const single = added.length === 1 ? added[0]! : null;
  if (single && isBoxed(single) && !isDrawingElement(single)) {
    const scale = objectZoneScale(single, textWidth, textHeight);
    return {
      zone: 'object',
      width: zoneSide(single.width * scale),
      height: zoneSide(single.height * scale),
      bounds,
      scale,
    };
  }
  const width = Math.round(textWidth);
  const height = Math.round(
    Math.min(
      zoneHeightMax(textHeight),
      Math.max(ARTICLE_DRAWING_MIN_HEIGHT, bounds.height + 2 * ARTICLE_DRAWING_PAD),
    ),
  );
  const scale = Math.min(1, (width - 2 * ARTICLE_DRAWING_PAD) / bounds.width);
  return { zone: 'drawing', width, height, bounds, scale };
}

/** How much an object is scaled to sit in its zone: never past the text width, nor past the text area's height
 *  or the tallest a zone is (ARTICLE_ZONE_MAX, which a stored zone is read back within), so a tall picture never
 *  runs over the writing after it or off its page. Never grown. */
export function objectZoneScale(
  obj: { width: number; height: number },
  textWidth: number,
  textHeight: number,
): number {
  return Math.min(1, textWidth / obj.width, zoneHeightMax(textHeight) / obj.height);
}

/** The tallest a zone may be: one page's text area (a taller one could never sit on a page), never past
 *  ARTICLE_ZONE_MAX. */
export function zoneHeightMax(textHeight: number = ARTICLE_ZONE_MAX): number {
  return Math.max(ARTICLE_ZONE_MIN, Math.min(ARTICLE_ZONE_MAX, Math.floor(textHeight)));
}

/** A zone's side as the writing stores it (parseArticleBlock's bounds), so a fitted zone reads back the same. */
export const zoneSide = (v: number): number =>
  Math.min(ARTICLE_ZONE_MAX, Math.max(ARTICLE_ZONE_MIN, Math.round(v)));

/** The elements moved (and an object scaled) into a zone standing at `rect`: an object filling it,
 *  drawn elements centred in it, keeping their arrangement. */
export function withElementsIntoZone(
  elements: readonly Element[],
  ids: ReadonlySet<string>,
  plan: ZonePlan,
  rect: PageRect,
): Element[] {
  const { bounds, scale } = plan;
  // Where the box of elements lands: centred in the zone, scaled about its own corner.
  const ox = rect.x + (rect.width - bounds.width * scale) / 2;
  const oy = rect.y + (rect.height - bounds.height * scale) / 2;
  const map = (p: { x: number; y: number }) => ({
    x: ox + (p.x - bounds.x) * scale,
    y: oy + (p.y - bounds.y) * scale,
  });
  return elements.map((el): Element => {
    if (!ids.has(el.id)) return el;
    if (isBoxed(el)) {
      const at = map(el);
      return {
        ...el,
        x: at.x,
        y: at.y,
        width: el.width * scale,
        height: el.height * scale,
      };
    }
    const end = (ep: typeof el.from) => (ep.kind === 'free' ? { ...ep, ...map(ep) } : ep);
    return { ...el, from: end(el.from), to: end(el.to) };
  });
}
