// Elements coming into an article's writing (docs/specs/007-editor/article-pages.md "Zones",
// "Into the writing"): an element added onto an article page outside every zone goes into a new
// zone of the writing, at the block boundary nearest it. Which kind of zone, how big, and where its
// elements sit in it are decided here; where in the writing it goes is the editor's (it alone
// knows where the lines fall). Pure.
import {
  ARTICLE_ZONE_MAX,
  ARTICLE_ZONE_MIN,
  articlesOf,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleZoneAlign,
  type ArticleZoneBlock,
  type ArticleZoneKind,
  type ArticleZoneWrap,
} from './article-flow';
import { withArticleFlow, withArticlePageCount } from './article-pages';
import { zoneAnchorOf, zoneCanvasRect, zoneMemberIds } from './article-zones';
import { isBoxed, type BoxedElement, type Element, type Tab } from './index';
import {
  illustratePagesOf,
  layOutIllustratePages,
  type LaidOutPage,
  type PageRect,
} from './illustrate-page';
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
  'mind-node',
  'lane',
  'entity',
  'stadium',
  'actor',
  'cloud',
  'triangle',
  'trapezoid',
  'star',
  'speech-bubble',
  'frame',
]);

/** Whether an element is drawn with (and so goes into a drawing zone). A sticky note is an object
 *  of its own (an object zone: in line, wrapped or floating, no boundary), though one dropped into
 *  a drawing joins it there. */
export function isDrawingElement(el: Element): boolean {
  if (el.type === 'arrow' || el.type === 'text') return true;
  if (el.type === 'freehand' || el.type === 'path') return true;
  return el.type === 'shape' && DRAWING_SHAPES.has(el.shape);
}

// A drawing zone's room around what is drawn in it, and the least height it starts with.
export const ARTICLE_DRAWING_PAD = 24;
export const ARTICLE_DRAWING_MIN_HEIGHT = 200;

const boundsOf = (els: readonly Element[], all: readonly Element[]): PageRect => {
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
): ZonePlan {
  const bounds = boundsOf(added, all);
  const single = added.length === 1 ? added[0]! : null;
  if (single && isBoxed(single) && !isDrawingElement(single)) {
    const scale = Math.min(1, textWidth / single.width);
    return {
      zone: 'object',
      width: Math.round(single.width * scale),
      height: Math.round(single.height * scale),
      bounds,
      scale,
    };
  }
  const width = Math.round(textWidth);
  const height = Math.round(
    Math.max(ARTICLE_DRAWING_MIN_HEIGHT, bounds.height + 2 * ARTICLE_DRAWING_PAD),
  );
  const scale = Math.min(1, (width - 2 * ARTICLE_DRAWING_PAD) / bounds.width);
  return { zone: 'drawing', width, height, bounds, scale };
}

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
      } as BoxedElement;
    }
    const end = (ep: typeof el.from) => (ep.kind === 'free' ? { ...ep, ...map(ep) } : ep);
    return { ...el, from: end(el.from), to: end(el.to) };
  });
}

/** Of `ids` (just added), the ones on an article page and inside no zone of its article, grouped
 *  by article. An arrow pinned at both ends to elements already in a zone is left alone. */
export function looseOnArticles(
  elements: readonly Element[],
  ids: readonly string[],
  pages: readonly LaidOutPage[],
  articles: Readonly<Record<string, ArticleFlow>>,
): Map<string, string[]> {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const zones = new Map<string, PageRect[]>();
  for (const [flow, doc] of Object.entries(articles)) {
    const own = pages.filter((p) => p.flow === flow);
    zones.set(
      flow,
      doc.blocks.flatMap((b) => {
        if (b.type !== 'zone') return [];
        const r = zoneCanvasRect(own, b);
        return r ? [r] : [];
      }),
    );
  }
  const out = new Map<string, string[]>();
  for (const id of ids) {
    const el = byId.get(id);
    if (!el) continue;
    const at = zoneAnchorOf(el, elements as Element[]);
    const page = pages.find(
      (p) =>
        at.x >= p.rect.x &&
        at.x <= p.rect.x + p.rect.width &&
        at.y >= p.rect.y &&
        at.y <= p.rect.y + p.rect.height,
    );
    if (!page?.flow || !articles[page.flow]) continue;
    const inZone = (zones.get(page.flow) ?? []).some(
      (r) => at.x >= r.x && at.x <= r.x + r.width && at.y >= r.y && at.y <= r.y + r.height,
    );
    if (inZone) continue;
    const list = out.get(page.flow);
    if (list) list.push(id);
    else out.set(page.flow, [id]);
  }
  return out;
}

type DocsTab = Pick<Tab, 'elements'> & { pages?: unknown; articles?: unknown };

/**
 * An article's zones fitted to their elements (docs/specs/007-editor/article-pages.md "Zones"):
 * an object zone takes its object's size and keeps it at its corner (a resize from any handle);
 * an object zone whose object is gone leaves the writing; a drawing zone grows down and across (to
 * the text width) to keep its elements inside with ARTICLE_DRAWING_PAD to spare, and never shrinks past
 * them. The same tab back when nothing changes.
 */
export function withZonesFitted<T extends DocsTab>(tab: T, flow: string, textWidth: number): T {
  const doc = articlesOf(tab)[flow];
  if (!doc) return tab;
  const pages = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  let elements = tab.elements as Element[];
  let changed = false;
  const blocks: ArticleBlock[] = [];
  for (const b of doc.blocks) {
    if (b.type !== 'zone') {
      blocks.push(b);
      continue;
    }
    const rect = zoneCanvasRect(pages, b);
    if (!rect) {
      blocks.push(b);
      continue;
    }
    const members = elements.filter((el) => insideRect(rect, zoneAnchorOf(el, elements)));
    if (b.zone === 'object') {
      const obj = members.find(isBoxed);
      if (!obj) {
        changed = true;
        continue;
      }
      const width = Math.round(Math.min(obj.width, textWidth));
      const height = Math.round(obj.height * (width / obj.width));
      const sized = Math.abs(width - b.width) > 0.5 || Math.abs(height - b.height) > 0.5;
      const placed = Math.abs(obj.x - rect.x) > 0.5 || Math.abs(obj.y - rect.y) > 0.5;
      const scaled = Math.abs(width - obj.width) > 0.5;
      if (placed || scaled)
        elements = elements.map((el) =>
          el.id === obj.id ? ({ ...el, x: rect.x, y: rect.y, width, height } as Element) : el,
        );
      if (sized) {
        blocks.push({ ...b, width, height });
        changed = true;
      } else blocks.push(b);
      if (placed || scaled) changed = true;
      continue;
    }
    if (members.length === 0) {
      blocks.push(b);
      continue;
    }
    const box = boundsOf(members, elements);
    const width = Math.round(
      Math.min(textWidth, Math.max(b.width, box.x + box.width + ARTICLE_DRAWING_PAD - rect.x)),
    );
    const height = Math.round(
      Math.max(b.height, box.y + box.height + ARTICLE_DRAWING_PAD - rect.y),
    );
    if (width !== b.width || height !== b.height) {
      blocks.push({ ...b, width, height });
      changed = true;
    } else blocks.push(b);
  }
  if (!changed) return tab;
  const nextDoc: ArticleFlow = doc.style ? { blocks, style: doc.style } : { blocks };
  return {
    ...tab,
    elements,
    articles: { ...(tab.articles as Record<string, ArticleFlow>), [flow]: nextDoc },
  };
}

/** The elements of zones that left the writing (each where it last stood) removed with them, and
 *  any arrow pinned to one, in turn. */
export function withZoneContentsRemoved<T extends DocsTab>(
  tab: T,
  flow: string,
  gone: readonly ArticleZoneBlock[],
): T {
  const pages = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  const els = tab.elements as Element[];
  const ids = new Set<string>();
  for (const z of gone) {
    const rect = zoneCanvasRect(pages, z);
    if (!rect) continue;
    for (const id of zoneMemberIds(els, rect)) ids.add(id);
  }
  if (ids.size === 0) return tab;
  let grew = true;
  while (grew) {
    grew = false;
    for (const el of els) {
      if (ids.has(el.id) || el.type !== 'arrow') continue;
      const tied = [el.from, el.to].some(
        (ep) =>
          (ep.kind === 'pinned' && ids.has(ep.elementId)) ||
          (ep.kind === 'on-arrow' && ids.has(ep.arrowId)),
      );
      if (tied) {
        ids.add(el.id);
        grew = true;
      }
    }
  }
  return { ...tab, elements: els.filter((el) => !ids.has(el.id)) };
}

const insideRect = (r: PageRect, p: { x: number; y: number }) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/** A zone the editor has just put into the writing, and where it measured it landing. */
export type LandedZone = {
  id: string;
  blocks: ArticleBlock[];
  index: number;
  x: number;
  y: number;
};

/** The tab with the writing as the editor left it after putting a zone in: the zone placed where it
 *  landed (`at`), the article grown to the page it landed on. With the zone's canvas rect, or
 *  null when the article is gone. */
export function withZoneLanded<T extends DocsTab>(
  tab: T,
  flow: string,
  landed: LandedZone,
): { tab: T; rect: PageRect | null } {
  const own = illustratePagesOf(tab).filter((p) => p.flow === flow).length;
  if (own === 0) return { tab, rect: null };
  const grown = withArticlePageCount(tab, flow, Math.max(own, landed.index + 1));
  const page = layOutIllustratePages(illustratePagesOf(grown)).filter((p) => p.flow === flow)[
    landed.index
  ];
  const doc = articlesOf(grown)[flow];
  if (!page || !doc) return { tab, rect: null };
  const blocks = landed.blocks.map((b) =>
    b.id === landed.id ? { ...b, at: { page: page.id, x: landed.x, y: landed.y } } : b,
  );
  const zone = blocks.find((b) => b.id === landed.id);
  const next = withArticleFlow(grown, flow, doc.style ? { blocks, style: doc.style } : { blocks });
  const rect =
    zone && zone.type === 'zone'
      ? {
          x: page.rect.x + landed.x,
          y: page.rect.y + landed.y,
          width: zone.width,
          height: zone.height,
        }
      : null;
  return { tab: next, rect };
}

// A wrapped zone is at most this share of the text width.
export const ARTICLE_WRAP_MAX_SHARE = 2 / 3;

/**
 * A zone's wrap or place across the text changed (docs/specs/007-editor/article-pages.md "Zones"):
 * one wrapped to the side is scaled down (its elements with it, about its corner) to at most two
 * thirds of the text width. The writing then lays it out anew and its elements follow.
 */
export function withZoneWrap<T extends DocsTab>(
  tab: T,
  flow: string,
  zoneId: string,
  change: { wrap?: ArticleZoneWrap; align?: ArticleZoneAlign },
  textWidth: number,
): T {
  const doc = articlesOf(tab)[flow];
  const zone = doc?.blocks.find((b): b is ArticleZoneBlock => b.id === zoneId && b.type === 'zone');
  if (!doc || !zone) return tab;
  const wrap = change.wrap ?? zone.wrap ?? 'inline';
  const align = change.align ?? zone.align ?? 'center';
  // Already so: the same tab back (no edit, no undo step).
  if (wrap === (zone.wrap ?? 'inline') && align === (zone.align ?? 'center')) return tab;
  const max = wrap === 'inline' ? textWidth : textWidth * ARTICLE_WRAP_MAX_SHARE;
  const scale = Math.min(1, max / zone.width);
  let elements = tab.elements as Element[];
  if (scale < 1) {
    const pages = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
    const rect = zoneCanvasRect(pages, zone);
    if (rect) {
      const ids = zoneMemberIds(elements, rect);
      const plan: ZonePlan = { zone: zone.zone, width: 0, height: 0, bounds: rect, scale };
      elements = withElementsIntoZone(elements, ids, plan, {
        x: rect.x,
        y: rect.y,
        width: rect.width * scale,
        height: rect.height * scale,
      });
    }
  }
  const { wrap: _w, align: _a, ...rest } = zone;
  void _w;
  void _a;
  const next: ArticleZoneBlock = {
    ...rest,
    ...(wrap !== 'inline' ? { wrap } : {}),
    ...(align !== 'center' ? { align } : {}),
    width: Math.round(zone.width * scale),
    height: Math.round(zone.height * scale),
  };
  const blocks = doc.blocks.map((b) => (b.id === zoneId ? next : b));
  return {
    ...withArticleFlow(tab, flow, doc.style ? { blocks, style: doc.style } : { blocks }),
    elements,
  };
}

/** A zone taken out of the writing with its elements. */
export function withZoneRemoved<T extends DocsTab>(tab: T, flow: string, zoneId: string): T {
  const doc = articlesOf(tab)[flow];
  const zone = doc?.blocks.find((b): b is ArticleZoneBlock => b.id === zoneId && b.type === 'zone');
  if (!doc || !zone) return tab;
  const emptied = withZoneContentsRemoved(tab, flow, [zone]);
  const blocks = doc.blocks.filter((b) => b.id !== zoneId);
  return withArticleFlow(emptied, flow, doc.style ? { blocks, style: doc.style } : { blocks });
}

/** A zone let go of by the writing (Float): its block leaves the writing, its elements stay where
 *  they are, in front of the text, as loose elements of the page. */
export function withZoneReleased<T extends DocsTab>(tab: T, flow: string, zoneId: string): T {
  const doc = articlesOf(tab)[flow];
  if (!doc || !doc.blocks.some((b) => b.id === zoneId && b.type === 'zone')) return tab;
  const blocks = doc.blocks.filter((b) => b.id !== zoneId);
  return withArticleFlow(tab, flow, doc.style ? { blocks, style: doc.style } : { blocks });
}

/** A drawing zone resized (its grips dragged): `height` tall, `width` wide, never smaller than its
 *  elements need (ARTICLE_DRAWING_PAD past the furthest) nor than ARTICLE_ZONE_MIN, never taller
 *  than ARTICLE_ZONE_MAX nor wider than the text (a wrapped zone: ARTICLE_WRAP_MAX_SHARE of it). */
export function withZoneSize<T extends DocsTab>(
  tab: T,
  flow: string,
  zoneId: string,
  size: { width?: number; height?: number },
  textWidth: number,
): T {
  const doc = articlesOf(tab)[flow];
  const zone = doc?.blocks.find((b): b is ArticleZoneBlock => b.id === zoneId && b.type === 'zone');
  if (!doc || !zone) return tab;
  const pages = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  const rect = zoneCanvasRect(pages, zone);
  let leastH = ARTICLE_ZONE_MIN;
  let leastW = ARTICLE_ZONE_MIN;
  if (rect) {
    const els = tab.elements as Element[];
    const members = els.filter((el) => zoneMemberIds(els, rect).has(el.id));
    if (members.length) {
      const box = boundsOf(members, els);
      leastH = Math.max(leastH, box.y + box.height + ARTICLE_DRAWING_PAD - rect.y);
      leastW = Math.max(leastW, box.x + box.width + ARTICLE_DRAWING_PAD - rect.x);
    }
  }
  const widest =
    (zone.wrap ?? 'inline') === 'inline' ? textWidth : textWidth * ARTICLE_WRAP_MAX_SHARE;
  const height =
    size.height === undefined
      ? zone.height
      : Math.round(Math.min(ARTICLE_ZONE_MAX, Math.max(leastH, size.height)));
  const width =
    size.width === undefined
      ? zone.width
      : Math.round(Math.min(Math.max(widest, leastW), Math.max(leastW, size.width)));
  if (height === zone.height && width === zone.width) return tab;
  const blocks = doc.blocks.map((b) => (b.id === zoneId ? { ...zone, width, height } : b));
  return withArticleFlow(tab, flow, doc.style ? { blocks, style: doc.style } : { blocks });
}

/** An object dragged off its zone and dropped on its own article's pages: where it was dropped. */
export type ObjectDraggedOut = { flow: string; zoneId: string; elementId: string; at: Point };
type Point = { x: number; y: number };

/**
 * The objects an edit dragged out of their object zones and dropped on the same article's pages
 * (docs/specs/007-editor/article-pages.md "Zones"): each object zone of `before` whose object, still
 * on the tab, now has its centre off the zone and on one of the article's pages. The writing then
 * moves the zone to where the object was dropped, rather than the object leaving it.
 */
export function objectsDraggedOut(before: DocsTab, now: DocsTab): ObjectDraggedOut[] {
  const out: ObjectDraggedOut[] = [];
  const docsBefore = articlesOf(before);
  const docsNow = articlesOf(now);
  const pagesBefore = layOutIllustratePages(illustratePagesOf(before));
  const pagesNow = layOutIllustratePages(illustratePagesOf(now));
  const elsBefore = before.elements as Element[];
  const elsNow = now.elements as Element[];
  for (const [flow, doc] of Object.entries(docsBefore)) {
    const stillThere = new Set((docsNow[flow]?.blocks ?? []).map((b) => b.id));
    const ownBefore = pagesBefore.filter((p) => p.flow === flow);
    const ownNow = pagesNow.filter((p) => p.flow === flow);
    for (const z of doc.blocks) {
      if (z.type !== 'zone' || z.zone !== 'object' || !stillThere.has(z.id)) continue;
      const was = zoneCanvasRect(ownBefore, z);
      if (!was) continue;
      const objId = elsBefore.find(
        (el) => isBoxed(el) && zoneMemberIds(elsBefore, was).has(el.id),
      )?.id;
      const obj = objId ? elsNow.find((el) => el.id === objId) : undefined;
      if (!obj || !isBoxed(obj)) continue;
      const at = zoneAnchorOf(obj, elsNow);
      const inside = (r: { x: number; y: number; width: number; height: number }) =>
        at.x >= r.x && at.x <= r.x + r.width && at.y >= r.y && at.y <= r.y + r.height;
      if (inside(was)) continue;
      if (!ownNow.some((p) => inside(p.rect))) continue;
      out.push({ flow, zoneId: z.id, elementId: obj.id, at });
    }
  }
  return out;
}
