// A retired arrow (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4): a stored `arrow`
// element, kept exactly as stored. livehuddle no longer draws, routes, bends or edits arrows; it reads only the two
// ends to know where the line ran, and draws a faint dashed straight line between them with the placeholder card on
// its middle (docs/specs/002-project-scope/blueprints/element-engine.md D21). Nothing here writes to the arrow, so
// every field it carries (its heads, style, bends, label layout, flow) rides through a save, a sync and a copy.

import type { CommentThread } from './comments';
import type { ElementAction } from './element-action';
import type { ElementId, ElementLink } from './index';
import type { TextRun } from '@liveworkspace/model-core/rich-text';
import type { Point, Rect } from '@liveworkspace/model-core/geometry-primitives';

// The sixteen compass anchors an end could be pinned to, as stored.
export type RetiredAnchor =
  | 'n'
  | 'nne'
  | 'ne'
  | 'ene'
  | 'e'
  | 'ese'
  | 'se'
  | 'sse'
  | 's'
  | 'ssw'
  | 'sw'
  | 'wsw'
  | 'w'
  | 'wnw'
  | 'nw'
  | 'nnw';

// Where each anchor sits across its element's box, as fractions of the width and height.
export const ANCHOR_FRACTIONS: Readonly<Record<RetiredAnchor, readonly [number, number]>> = {
  n: [0.5, 0],
  nne: [0.75, 0],
  ne: [1, 0],
  ene: [1, 0.25],
  e: [1, 0.5],
  ese: [1, 0.75],
  se: [1, 1],
  sse: [0.75, 1],
  s: [0.5, 1],
  ssw: [0.25, 1],
  sw: [0, 1],
  wsw: [0, 0.75],
  w: [0, 0.5],
  wnw: [0, 0.25],
  nw: [0, 0],
  nnw: [0.25, 0],
};

// One end of a stored arrow: a free point, pinned to an element's anchor, or a point along another arrow.
export type RetiredEndpoint =
  | { kind: 'free'; x: number; y: number }
  | { kind: 'pinned'; elementId: ElementId; anchor: RetiredAnchor }
  | { kind: 'on-arrow'; arrowId: ElementId; t: number };

// A stored arrow (or line). Only the ends and the shared fields the generic paths read are typed; everything else
// it stored stays on the object at run time.
export type RetiredArrowElement = {
  id: ElementId;
  type: 'arrow';
  from: RetiredEndpoint;
  to: RetiredEndpoint;
  // Which ends had heads: 'none' was a line, and is named Line.
  arrowEnds?: 'from' | 'to' | 'both' | 'none';
  label?: string;
  opacity?: number;
  link?: ElementLink;
  commentThread?: CommentThread;
  action?: ElementAction;
  note?: string;
  noteRich?: TextRun[];
};

// The card's size, in canvas units, centred on the line's middle (D21).
export const RETIRED_ARROW_CARD_WIDTH = 160;
export const RETIRED_ARROW_CARD_HEIGHT = 96;
// The line, in canvas units: dashes long enough to read as a line, broken enough to read as not a real one, faint.
export const RETIRED_ARROW_DASH = '6 6';
export const RETIRED_ARROW_STROKE_WIDTH = 1.5;
export const RETIRED_ARROW_OPACITY = 0.7;
// How many arrows an `on-arrow` end may hop through before it counts as unresolved (a cycle, say).
export const RETIRED_ARROW_MAX_HOPS = 4;

export function isRetiredArrow(el: { type: string }): el is RetiredArrowElement {
  return el.type === 'arrow';
}

type Lookup = (id: ElementId) => unknown;
type Box = { x: number; y: number; width: number; height: number; rotation?: number };

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function asBox(el: unknown): Box | null {
  if (!el || typeof el !== 'object') return null;
  const b = el as Partial<Box> & { type?: unknown };
  if (b.type === 'arrow') return null;
  if (!finite(b.x) || !finite(b.y) || !finite(b.width) || !finite(b.height)) return null;
  return b as Box;
}

function anchorPoint(box: Box, anchor: unknown): Point | null {
  if (typeof anchor !== 'string' || !Object.hasOwn(ANCHOR_FRACTIONS, anchor)) return null;
  const [fx, fy] = ANCHOR_FRACTIONS[anchor as RetiredAnchor];
  const p = { x: box.x + fx * box.width, y: box.y + fy * box.height };
  const deg = finite(box.rotation) ? box.rotation : 0;
  if (!deg) return p;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
    y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
  };
}

function resolveEnd(end: unknown, lookup: Lookup, hops: number): Point | null {
  if (!end || typeof end !== 'object') return null;
  const e = end as { kind?: unknown } & Record<string, unknown>;
  if (e.kind === 'free') return finite(e.x) && finite(e.y) ? { x: e.x, y: e.y } : null;
  if (e.kind === 'pinned') {
    const box = typeof e.elementId === 'string' ? asBox(lookup(e.elementId)) : null;
    return box ? anchorPoint(box, e.anchor) : null;
  }
  if (e.kind === 'on-arrow') {
    if (hops >= RETIRED_ARROW_MAX_HOPS || typeof e.arrowId !== 'string' || !finite(e.t))
      return null;
    const target = lookup(e.arrowId);
    if (!target || typeof target !== 'object' || (target as { type?: unknown }).type !== 'arrow')
      return null;
    const ends = resolveEnds(target as RetiredArrowElement, lookup, hops + 1);
    if (!ends) return null;
    return {
      x: ends.from.x + e.t * (ends.to.x - ends.from.x),
      y: ends.from.y + e.t * (ends.to.y - ends.from.y),
    };
  }
  return null;
}

function resolveEnds(
  arrow: RetiredArrowElement,
  lookup: Lookup,
  hops: number,
): { from: Point; to: Point } | null {
  const from = resolveEnd(arrow.from, lookup, hops);
  const to = resolveEnd(arrow.to, lookup, hops);
  if (!from && !to) return null;
  return { from: from ?? to!, to: to ?? from! };
}

// A caller drawing or measuring every stored arrow of a tab passes one index (a Map) for them all: an array builds its
// own index per call, which made a tab's bounds quadratic in its arrows.
function lookupOf(elements: readonly { id: string }[] | ReadonlyMap<string, unknown>): Lookup {
  if (elements instanceof Map) {
    const index = elements as ReadonlyMap<string, unknown>;
    return (id) => index.get(id);
  }
  const list = elements as readonly { id: string }[];
  let index: Map<string, unknown> | null = null;
  return (id) => {
    if (!index) {
      index = new Map();
      for (const el of list) index.set(el.id, el);
    }
    return index.get(id);
  };
}

// Where the line runs, worked out from the stored ends each time (D22): an end that does not resolve takes the
// other end's point, and with neither the line sits at the canvas origin.
export function retiredArrowEnds(
  arrow: RetiredArrowElement,
  elements: readonly { id: string }[] | ReadonlyMap<string, unknown>,
): { from: Point; to: Point } {
  const ends = resolveEnds(arrow, lookupOf(elements), 0);
  if (ends) return ends;
  return { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } };
}

// The placeholder card's box: 160 by 96, centred on the line's middle.
export function retiredArrowCard(
  arrow: RetiredArrowElement,
  elements: readonly { id: string }[] | ReadonlyMap<string, unknown>,
): Rect {
  return retiredArrowCardOn(retiredArrowEnds(arrow, elements));
}

// The card on ends already resolved.
export function retiredArrowCardOn({ from, to }: { from: Point; to: Point }): Rect {
  return {
    x: (from.x + to.x) / 2 - RETIRED_ARROW_CARD_WIDTH / 2,
    y: (from.y + to.y) / 2 - RETIRED_ARROW_CARD_HEIGHT / 2,
    width: RETIRED_ARROW_CARD_WIDTH,
    height: RETIRED_ARROW_CARD_HEIGHT,
  };
}

// Everything a retired arrow draws: the line's box and the card, together.
export function retiredArrowBounds(
  arrow: RetiredArrowElement,
  elements: readonly { id: string }[] | ReadonlyMap<string, unknown>,
): Rect {
  const { from, to } = retiredArrowEnds(arrow, elements);
  const card = retiredArrowCardOn({ from, to });
  const x = Math.min(from.x, to.x, card.x);
  const y = Math.min(from.y, to.y, card.y);
  const right = Math.max(from.x, to.x, card.x + card.width);
  const bottom = Math.max(from.y, to.y, card.y + card.height);
  return { x, y, width: right - x, height: bottom - y };
}
