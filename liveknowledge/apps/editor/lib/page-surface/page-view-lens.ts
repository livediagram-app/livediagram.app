// The narrow view (docs/specs/030-knowledgebase/blueprints/page-surface.md "The narrow view"): a page in a window too
// narrow for its 760 px column is drawn through this lens, its writing re-wrapped to the room the window gives. The
// page is drawn narrower and as tall as this browser measured it; each zone is drawn scaled to fit the column at the
// place this browser measured, its elements through the transform from the stored zone box to the drawn one; margin
// notes at their measured corners. Every change made through the lens is lowered back (lowerPageView): the stored
// page keeps its width, its height and where its zones and their elements stand, so nothing of the narrow layout is
// ever stored or synced. Pure, cached by tab as lens.ts is.
import {
  articleMarginPx,
  articlesOf,
  asViewPage,
  continuousPageHeight,
  isBoxed,
  isContinuousPage,
  layOutPages,
  pagesOf,
  withNotesSettled,
  zoneCanvasRect,
  zoneMemberIds,
  type ArticleFlow,
  type ArticleNotePlace,
  type ArticleZoneAt,
  type ArticleZoneBlock,
  type Element,
  type LaidOutPage,
  type Page,
  type Tab,
} from '@liveknowledge/document';
import type { NarrowLayout, PageViewState } from './page-view-store';

/** The least column the narrow view draws, canvas px: narrower than any phone leaves. */
export const PAGE_VIEW_MIN_COLUMN = 120;

type Point = { x: number; y: number };
/** A move from a stored place to a drawn one, scaled by `s` about it. */
type Transform = { from: Point; to: Point; s: number };
type ZoneLens = { real: ArticleZoneBlock; lens: ArticleZoneBlock; s: number; t: Transform };
type LensMeta = {
  real: Tab;
  flow: string;
  page: Page;
  lensPage: Page;
  realDoc: ArticleFlow | undefined;
  lensDoc: ArticleFlow | undefined;
  laidLens: LaidOutPage[];
  zones: Map<string, ZoneLens>;
  /** Each element the lens moved: a zone's (by the zone's id), or a margin note (null). */
  moved: Map<string, { t: Transform; zone: string | null }>;
};

const lenses = new WeakMap<Tab, { room: number; layout: NarrowLayout | undefined; lens: Tab }>();
const metas = new WeakMap<Tab, LensMeta>();

const forward = (p: Point, t: Transform): Point => ({
  x: t.to.x + t.s * (p.x - t.from.x),
  y: t.to.y + t.s * (p.y - t.from.y),
});
const backward = (p: Point, t: Transform): Point => ({
  x: t.from.x + (p.x - t.to.x) / t.s,
  y: t.from.y + (p.y - t.to.y) / t.s,
});

/** An element through a transform (or its inverse): a box's corner and size, an arrow's free ends. */
function transformed(el: Element, t: Transform, inverse: boolean): Element {
  const move = inverse ? backward : forward;
  const k = inverse ? 1 / t.s : t.s;
  if (isBoxed(el)) {
    const at = move(el, t);
    return k === 1
      ? { ...el, x: at.x, y: at.y }
      : { ...el, x: at.x, y: at.y, width: el.width * k, height: el.height * k };
  }
  const end = <E extends Element & { type: 'arrow' }>(ep: E['from']): E['from'] =>
    ep.kind === 'free' ? { ...ep, ...move(ep, t) } : ep;
  return { ...el, from: end(el.from), to: end(el.to) };
}

/** Whether two values are the same but for floating point noise in their numbers. */
function nearlyEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-6;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    nearlyEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

const sameKeys = <T extends object>(a: T, b: T): boolean => {
  const ka = Object.keys(a) as (keyof T)[];
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

/** The page the lens narrows: a continuous page holding writing, with its size, as the tab stores it (pagesOf answers
 *  read copies; lowering hands back the stored objects themselves). */
function narrowedPage(tab: Tab): Page | undefined {
  const read = pagesOf(tab).find((p) => isContinuousPage(p) && !!p.flow && !!p.fit);
  return read && tab.pages?.find((p) => p.id === read.id && p.fit);
}

/** An article's writing as the tab stores it, when it is well formed; else as read. */
function storedFlow(tab: Tab, flow: string): ArticleFlow | undefined {
  const raw = tab.articles?.[flow];
  return raw && Array.isArray(raw.blocks) ? raw : articlesOf(tab)[flow];
}

function build(tab: Tab, room: number, layout: NarrowLayout | undefined): Tab {
  const page = narrowedPage(tab);
  if (!page || !page.flow) return tab;
  const flow = page.flow;
  const doc = storedFlow(tab, flow);
  const margin = articleMarginPx(doc?.style);
  const fit = page.fit!;
  if (room >= fit.width - 2 * margin) return tab;
  const column = Math.max(PAGE_VIEW_MIN_COLUMN, room);
  // Read at its own sides (a stored continuous page is read at the continuous width whatever it says).
  const lensPage: Page = asViewPage({
    ...page,
    fit: { width: column + 2 * margin, height: layout?.height ?? fit.height },
  });
  const pages = tab.pages!;
  const lensPages = pages.map((p) => (p === page ? lensPage : p));
  const laidReal = layOutPages(pages);
  const laidLens = layOutPages(lensPages);
  const zones = new Map<string, ZoneLens>();
  const moved = new Map<string, { t: Transform; zone: string | null }>();
  let blocks = doc?.blocks;
  if (doc) {
    const out = doc.blocks.map((b) => {
      if (b.type !== 'zone' || !b.at || !(b.width > 0) || !(b.height > 0)) return b;
      const was = zoneCanvasRect(laidReal, b);
      if (!was) return b;
      const s = Math.min(1, column / b.width);
      const width = b.width * s;
      const height = b.height * s;
      const at: ArticleZoneAt = layout?.zones.get(b.id) ?? {
        page: b.at.page,
        x: Math.min(Math.max(b.at.x, margin), margin + column - width),
        y: b.at.y,
      };
      const now = zoneCanvasRect(laidLens, { at, width, height });
      if (!now) return b;
      const lens: ArticleZoneBlock = { ...b, width, height, at };
      const t: Transform = { from: was, to: now, s };
      zones.set(b.id, { real: b, lens, s, t });
      for (const id of zoneMemberIds(tab.elements, was))
        if (!moved.has(id)) moved.set(id, { t, zone: b.id });
      return lens;
    });
    if (zones.size > 0) blocks = out;
  }
  // Margin notes: at the corner this browser measured, else as far from the page's right edge as they were.
  const realRect = laidReal.find((p) => p.id === page.id)?.rect;
  const lensRect = laidLens.find((p) => p.id === page.id)?.rect;
  const shift =
    realRect && lensRect ? lensRect.x + lensRect.width - (realRect.x + realRect.width) : 0;
  for (const el of tab.elements) {
    if (el.type !== 'article-note' || moved.has(el.id)) continue;
    const to = layout?.notes.get(el.id) ?? { x: el.x + shift, y: el.y };
    if (to.x !== el.x || to.y !== el.y) moved.set(el.id, { t: { from: el, to, s: 1 }, zone: null });
  }
  const elements =
    moved.size === 0
      ? tab.elements
      : tab.elements.map((el) => {
          const m = moved.get(el.id);
          return m ? transformed(el, m.t, false) : el;
        });
  const lensDoc = doc && blocks !== doc.blocks ? { ...doc, blocks: blocks! } : doc;
  const lens: Tab = {
    ...tab,
    pages: lensPages,
    elements,
    ...(lensDoc !== doc ? { articles: { ...tab.articles, [flow]: lensDoc! } } : {}),
  };
  metas.set(lens, {
    real: tab,
    flow,
    page,
    lensPage,
    realDoc: doc,
    lensDoc,
    laidLens,
    zones,
    moved,
  });
  return lens;
}

/**
 * The page as this window draws it: the tab itself while the room holds its column (or before a page surface has
 * measured the room), else the narrow lens. The same lens for the same tab, room and measured layout.
 */
export function pageViewLens(tab: Tab, room: number | null, layout?: NarrowLayout): Tab {
  if (room === null) return tab;
  const cached = lenses.get(tab);
  if (cached && cached.room === room && cached.layout === layout) return cached.lens;
  const lens = build(tab, room, layout);
  lenses.set(tab, { room, layout, lens });
  return lens;
}

/** Whether a tab is a narrow lens: what it lays out is this window's own. */
export const isPageViewLens = (tab: Tab): boolean => metas.has(tab);

/** Whether the room holds a page's column, so a page drawn there is the stored page itself. */
export function pageViewNarrows(tab: Tab, room: number | null): boolean {
  return room !== null && pageViewLens(tab, room) !== tab;
}

/**
 * The real tab after a change made through the lens: the page keeps its stored size, each zone its stored place and
 * (unless the change resized it) size, each element the lens moved goes back through the inverse transform, the
 * stored element itself when it comes back unchanged. Writing is lowered as it was made. The real tab itself when
 * the change made nothing but what the narrow layout works out, so no commit follows from a layout alone.
 */
export function lowerPageView(real: Tab, lens: Tab, mapped: Tab): Tab {
  if (mapped === lens) return real;
  const m = metas.get(lens);
  if (!m || m.real !== real) return mapped;
  const out: Tab = { ...mapped };
  if (mapped.pages === lens.pages) out.pages = real.pages;
  else if (mapped.pages) {
    const pages = mapped.pages.map((p) => {
      if (p.id !== m.page.id) return p;
      if (p === m.lensPage) return m.page;
      const kept = { ...p, fit: m.page.fit };
      return sameKeys(kept, m.page) ? m.page : kept;
    });
    out.pages =
      real.pages &&
      pages.length === real.pages.length &&
      pages.every((p, i) => p === real.pages![i])
        ? real.pages
        : pages;
  }
  if (mapped.articles === lens.articles) out.articles = real.articles;
  else if (mapped.articles) {
    const doc = mapped.articles[m.flow];
    const back = doc === m.lensDoc ? m.realDoc : doc && lowerDoc(doc, m);
    const articles = back ? { ...mapped.articles, [m.flow]: back } : mapped.articles;
    out.articles = real.articles && sameKeys(articles, real.articles) ? real.articles : articles;
  }
  if (mapped.elements === lens.elements) out.elements = real.elements;
  else {
    const realById = new Map(real.elements.map((el) => [el.id, el]));
    const lensById = new Map(lens.elements.map((el) => [el.id, el]));
    const zoneTo = zonesNowOf(mapped, m);
    const elements = mapped.elements.map((el) => {
      const was = realById.get(el.id);
      if (lensById.get(el.id) === el) return was ?? el;
      const moved = m.moved.get(el.id);
      if (!moved) return el;
      // A margin note stands where the writing puts it: never moved by a change made here.
      const back =
        moved.zone === null
          ? was && el.type === 'article-note'
            ? ({ ...el, x: (was as { x: number }).x, y: (was as { y: number }).y } as Element)
            : transformed(el, moved.t, true)
          : transformed(el, zoneTo.get(moved.zone) ?? moved.t, true);
      return was && nearlyEqual(back, was) ? was : back;
    });
    out.elements =
      elements.length === real.elements.length && elements.every((el, i) => el === real.elements[i])
        ? real.elements
        : elements;
  }
  return sameKeys(out, real) ? real : out;
}

/** Where each zone the lens drew stands after the change: moved with its elements (a settle, a drag), its transform
 *  goes to the new place, so the elements come back to the stored zone as they stand in it. */
function zonesNowOf(mapped: Tab, m: LensMeta): Map<string, Transform> {
  const out = new Map<string, Transform>();
  const doc = mapped.articles?.[m.flow];
  if (!doc || doc === m.lensDoc || !Array.isArray(doc.blocks)) return out;
  for (const b of doc.blocks) {
    if (b.type !== 'zone') continue;
    const z = m.zones.get(b.id);
    if (!z || b === z.lens || !b.at) continue;
    const now = zoneCanvasRect(m.laidLens, { at: b.at, width: b.width, height: b.height });
    if (now) out.set(b.id, { ...z.t, to: now });
  }
  return out;
}

function lowerDoc(doc: ArticleFlow, m: LensMeta): ArticleFlow {
  const blocks = doc.blocks.map((b) => {
    if (b.type !== 'zone') return b;
    const z = m.zones.get(b.id);
    if (!z) return b;
    if (b === z.lens) return z.real;
    const kept: ArticleZoneBlock = {
      ...b,
      width: b.width === z.lens.width ? z.real.width : Math.round(b.width / z.s),
      height: b.height === z.lens.height ? z.real.height : Math.round(b.height / z.s),
      ...(z.real.at ? { at: z.real.at } : {}),
    };
    return nearlyEqual(kept, z.real) ? z.real : kept;
  });
  const realDoc = m.realDoc;
  // The engine's own settles hand back read copies of the blocks they did not move: the same writing, so the stored
  // flow itself (a typed change stops the walk at its block).
  if (
    realDoc &&
    nearlyEqual(doc.style, realDoc.style) &&
    blocks.length === realDoc.blocks.length &&
    blocks.every((b, i) => b === realDoc.blocks[i] || nearlyEqual(b, realDoc.blocks[i]))
  )
    return realDoc;
  return { ...doc, blocks };
}

/** The tabs with the page `tabId` through its narrow lens. The same array when it draws as it is stored. */
export function liftViewTabs(ts: Tab[], tabId: string, view: PageViewState): Tab[] {
  const i = ts.findIndex((t) => t.id === tabId);
  if (i < 0) return ts;
  const lens = pageViewLens(ts[i]!, view.room, view.layouts.get(tabId));
  if (lens === ts[i]) return ts;
  const out = ts.slice();
  out[i] = lens;
  return out;
}

/** The real tabs after a map over the lifted ones: the page lowered (lowerPageView), the rest as mapped. The real
 *  array itself when nothing of it changed. */
export function lowerViewTabs(real: Tab[], lifted: Tab[], mapped: Tab[], tabId: string): Tab[] {
  if (mapped === lifted) return real;
  const lens = lifted.find((t) => t.id === tabId);
  const before = real.find((t) => t.id === tabId);
  const out = mapped.map((t) =>
    t.id === tabId && lens && before && lens !== before ? lowerPageView(before, lens, t) : t,
  );
  return out.length === real.length && out.every((t, i) => t === real[i]) ? real : out;
}

/**
 * What a layout of the narrow lens measured, for the store (page-view-store.ts notePageViewLayout): the page's
 * height, each zone's place on its page, each margin note's corner (the article engine's own settling, run on the
 * drawn page). Null when the layout is not of the lens's page.
 */
export function narrowLayoutOf(
  lens: Tab,
  layout: {
    flow: string;
    heightNeeded?: number;
    zones: readonly { id: string; index: number; x: number; y: number }[];
    notes: readonly ArticleNotePlace[];
  },
): NarrowLayout | null {
  const m = metas.get(lens);
  if (!m || m.flow !== layout.flow) return null;
  const own: LaidOutPage[] = layOutPages(pagesOf(lens)).filter((p) => p.flow === layout.flow);
  const zones = new Map<string, ArticleZoneAt>();
  for (const z of layout.zones) {
    const page = own[z.index];
    if (page && z.id) zones.set(z.id, { page: page.id, x: z.x, y: z.y });
  }
  const notes = new Map<string, Point>();
  if (layout.notes.length > 0) {
    const settled = withNotesSettled(lens, layout.flow, layout.notes);
    for (const el of settled.elements)
      if (el.type === 'article-note') notes.set(el.id, { x: el.x, y: el.y });
  }
  return {
    ...(layout.heightNeeded !== undefined
      ? { height: continuousPageHeight(layout.heightNeeded) }
      : {}),
    zones,
    notes,
  };
}
