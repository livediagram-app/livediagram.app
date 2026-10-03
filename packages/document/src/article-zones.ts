// Zones and their elements (docs/specs/007-editor/article-pages.md "Zones"): a zone is a block of
// the writing that holds canvas elements. Its elements are the ones whose centre (an arrow: the
// midpoint of its ends) lies inside it where it last stood (`ArticleZoneBlock.at`); when the writing
// moves it, they move with it. Pure: the layout is measured by the editor, settled here.
import {
  articlesOf,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleZoneBlock,
} from './article-flow';
import { endpointPosition } from './geometry';
import {
  illustratePagesOf,
  layOutIllustratePages,
  type LaidOutPage,
  type PageRect,
} from './illustrate-page';
import { isBoxed, type Element, type Tab } from './index';

/** Where a zone stood, on the canvas (null before it was first laid out, or off its pages). */
export function zoneCanvasRect(
  pages: readonly LaidOutPage[],
  zone: Pick<ArticleZoneBlock, 'at' | 'width' | 'height'>,
): PageRect | null {
  if (!zone.at) return null;
  const page = pages.find((p) => p.id === zone.at!.page);
  if (!page) return null;
  return {
    x: page.rect.x + zone.at.x,
    y: page.rect.y + zone.at.y,
    width: zone.width,
    height: zone.height,
  };
}

/** The point an element belongs to a zone by: a box's centre, an arrow's midpoint. */
export function zoneAnchorOf(el: Element, elements: readonly Element[]): { x: number; y: number } {
  if (isBoxed(el)) return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const a = endpointPosition(el.from, elements as Element[]);
  const b = endpointPosition(el.to, elements as Element[]);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

const inside = (r: PageRect, p: { x: number; y: number }) =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

/** The ids of the elements in a zone standing at `rect`. */
export function zoneMemberIds(elements: readonly Element[], rect: PageRect): Set<string> {
  const ids = new Set<string>();
  for (const el of elements) if (inside(rect, zoneAnchorOf(el, elements))) ids.add(el.id);
  return ids;
}

/** Elements moved by (dx, dy): boxes, and arrows' free ends (pinned ends follow their element). */
export function withElementsMoved(
  elements: readonly Element[],
  ids: ReadonlySet<string>,
  dx: number,
  dy: number,
): Element[] {
  if (ids.size === 0 || (dx === 0 && dy === 0)) return elements as Element[];
  return elements.map((el): Element => {
    if (!ids.has(el.id)) return el;
    if (isBoxed(el)) return { ...el, x: el.x + dx, y: el.y + dy };
    const move = <E extends Element & { type: 'arrow' }>(ep: E['from']): E['from'] =>
      ep.kind === 'free' ? { ...ep, x: ep.x + dx, y: ep.y + dy } : ep;
    return { ...el, from: move(el.from), to: move(el.to) } as Element;
  });
}

export type MeasuredZone = { id: string; index: number; x: number; y: number };

// Under this far (canvas px) a measured zone has not moved: layout noise, not a change.
const SETTLE_TOLERANCE = 0.75;

/**
 * An article's zones settled where its writing laid them out: each zone's `at` set to its measured
 * place, and its elements (those inside where it stood) moved with it. A zone measured on a page
 * the article does not have yet waits for it. The same tab back when nothing moved.
 */
export function withZonesSettled<
  T extends Pick<Tab, 'elements'> & { pages?: unknown; articles?: unknown },
>(tab: T, flow: string, measured: readonly MeasuredZone[]): T {
  const doc = articlesOf(tab)[flow];
  if (!doc || measured.length === 0) return tab;
  const pages = layOutIllustratePages(illustratePagesOf(tab)).filter((p) => p.flow === flow);
  if (pages.length === 0) return tab;
  const byId = new Map(measured.map((m) => [m.id, m]));
  // Every zone's elements are read where everything stands now, before any zone moves: a zone
  // moving into another's old place must not take that one's elements.
  const original = tab.elements as Element[];
  const moves: { ids: Set<string>; dx: number; dy: number }[] = [];
  let changed = false;
  const blocks = doc.blocks.map((b): ArticleBlock => {
    if (b.type !== 'zone') return b;
    const m = byId.get(b.id);
    const page = m ? pages[m.index] : undefined;
    if (!m || !page) return b;
    const was = zoneCanvasRect(pages, b);
    const now = { x: page.rect.x + m.x, y: page.rect.y + m.y };
    if (
      was &&
      Math.abs(was.x - now.x) < SETTLE_TOLERANCE &&
      Math.abs(was.y - now.y) < SETTLE_TOLERANCE
    )
      return b;
    if (was)
      moves.push({ ids: zoneMemberIds(original, was), dx: now.x - was.x, dy: now.y - was.y });
    changed = true;
    return { ...b, at: { page: page.id, x: m.x, y: m.y } };
  });
  let elements = original;
  for (const { ids, dx, dy } of moves) elements = withElementsMoved(elements, ids, dx, dy);
  if (!changed) return tab;
  const nextDoc: ArticleFlow = doc.style ? { blocks, style: doc.style } : { blocks };
  return {
    ...tab,
    elements,
    articles: { ...(tab.articles as Record<string, ArticleFlow>), [flow]: nextDoc },
  };
}

/**
 * The drawing-zone clips (docs/specs/007-editor/article-pages.md "Zones"): a drawing zone is a
 * window onto its drawing, so whatever of a drawing element pokes past its edge is cut off. Every
 * drawing element (`isDrawing`) whose anchor is inside a drawing zone, or a box of which overlaps
 * one, is clipped to that zone's rect. Objects (images, charts) never are: floating in front of the
 * text, they show whole.
 */
export function drawingZoneClips(
  pages: readonly LaidOutPage[],
  articles: Readonly<Record<string, ArticleFlow>>,
  elements: readonly Element[],
  isDrawing: (el: Element) => boolean,
): Map<string, PageRect> {
  const out = new Map<string, PageRect>();
  const zones: PageRect[] = [];
  for (const [flow, doc] of Object.entries(articles)) {
    const own = pages.filter((p) => p.flow === flow);
    if (own.length === 0) continue;
    for (const b of doc.blocks) {
      if (b.type !== 'zone' || b.zone !== 'drawing') continue;
      const r = zoneCanvasRect(own, b);
      if (r) zones.push(r);
    }
  }
  if (zones.length === 0) return out;
  for (const el of elements) {
    if (!isDrawing(el)) continue;
    const at = zoneAnchorOf(el, elements);
    const zone =
      zones.find(
        (r) => at.x >= r.x && at.x <= r.x + r.width && at.y >= r.y && at.y <= r.y + r.height,
      ) ??
      (isBoxed(el)
        ? zones.find(
            (r) =>
              el.x < r.x + r.width &&
              el.x + el.width > r.x &&
              el.y < r.y + r.height &&
              el.y + el.height > r.y,
          )
        : undefined);
    if (zone) out.set(el.id, zone);
  }
  return out;
}
