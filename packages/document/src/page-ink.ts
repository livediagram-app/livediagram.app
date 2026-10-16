// Re-inking a page's content for a new fill (docs/specs/007-editor/illustrate-pages.md
// "Re-inking"): every colour of its own on the page measured against what it sits on (its card,
// else the page), and only what falls under its floor moved, the least that reaches its target,
// keeping its hue. With a memory of what earlier re-inking replaced, a colour still as re-inking
// left it is judged from the author's own. Pure: tab in, tab out.
import {
  canvasSurface,
  defaultArrowStrokeColor,
  defaultStrokeColor,
  defaultTextColor,
  type CanvasSurface,
} from './colors';
import { elementIndexFor, endpointPosition, type ElementIndex } from './geometry';
import {
  illustratePagesOf,
  rowPageAt,
  layOutIllustratePages,
  type IllustratePage,
  type PageRect,
} from './illustrate-page';
import { elementAnchorPoint, pageFillTone } from './illustrate-page-content';
import { layerBands } from './layers';
import { inkToward, isOpaqueHex, worstContrast } from './page-ink-contrast';
import { PAPER_TONE, pageGroundUnder, type PageGround } from './page-ink-ground';
import {
  boxBorder,
  boxFill,
  hasInkStroke,
  hasLabel,
  inkKindOf,
  INK_ROLE_CONTRAST,
  keptCover,
  labelFill,
  type InkField,
  type InkRole,
} from './page-ink-rules';
import { isBoxed, type BoxedElement, type Element, type Tab } from './index';
import { pointInRect, type Rect } from './geometry-primitives';

/** A colour re-inking replaced (`from`, the author's) and what it wrote (`to`). */
export type InkRecall = { from: string; to: string };
/** What re-inking has replaced, by element id and field: the editor's session memory, never
 *  stored in the document. */
export type InkMemory = ReadonlyMap<string, Readonly<Partial<Record<InkField, InkRecall>>>>;

export const EMPTY_INK_MEMORY: InkMemory = new Map();

// A ground and, when it is a card's, the card's tone.
type Ground = PageGround & { card: string | null };
// Fields to write; undefined takes a colour of its own away.
type Patch = Record<string, string | undefined>;
// A recall's `from` for a field that had no colour of its own.
const UNSET = '';
const hasPen = (el: Element, key: 'penColour' | 'penTextColour') =>
  (el as Partial<Record<typeof key, string>>)[key] !== undefined;
// A surface under later elements: its box and tone, or null for a surface of unknown tone.
type Cover = { box: Rect; tone: string | null };

function boxOf(el: Element, elements: ElementIndex): Rect {
  if (isBoxed(el)) return { x: el.x, y: el.y, width: el.width, height: el.height };
  const a = endpointPosition(el.from, elements);
  const b = endpointPosition(el.to, elements);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

type TabLike = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  layers?: Tab['layers'];
};

/** A page and the background it now wears, for pagesInkFor. */
export type PageInk = { pageId: string; background: IllustratePage['background'] };

/**
 * The tab re-inked for page `pageId`'s background `background` (its background after the change),
 * and the memory after it. `memory` is what earlier re-inking replaced; absent, colours are judged
 * as they are.
 */
export function pageInkFor<T extends TabLike>(
  tab: T,
  pageId: string,
  background: IllustratePage['background'],
  memory: InkMemory = EMPTY_INK_MEMORY,
): { tab: T; memory: InkMemory } {
  return pagesInkFor(tab, [{ pageId, background }], memory);
}

/**
 * pageInkFor for several pages in one walk (Apply to All on a full deck): the pages laid out, the
 * elements indexed and sorted onto their pages once, not once a page, so a deck at the page cap
 * costs O(elements x log pages + pages) rather than O(pages x elements x pages): each element finds its page by
 * halving along the row (rowPageAt). Only colours change, never a
 * box, so the one index stays true for every page's pass. Each page is inked as pageInkFor would,
 * in `inks` order, one memory carried through.
 */
export function pagesInkFor<T extends TabLike>(
  tab: T,
  inks: readonly PageInk[],
  memory: InkMemory = EMPTY_INK_MEMORY,
): { tab: T; memory: InkMemory } {
  if (inks.length === 0) return { tab, memory };
  const pages = layOutIllustratePages(illustratePagesOf(tab));
  const index = elementIndexFor(tab.elements);
  const wanted = new Set(inks.map((i) => i.pageId));
  // Each wanted page's elements, in the tab's order: one walk over the tab.
  const onPage = new Map<string, Element[]>();
  for (const el of tab.elements) {
    // Halved along the row, not a scan of every page: one lookup per element is O(log pages).
    const page = rowPageAt(pages, elementAnchorPoint(el, index));
    if (!page || !wanted.has(page.id)) continue;
    const list = onPage.get(page.id);
    if (list) list.push(el);
    else onPage.set(page.id, [el]);
  }
  const recall = new Map<string, Partial<Record<InkField, InkRecall>>>(
    [...memory].map(([id, r]) => [id, { ...r }]),
  );
  const replaced = new Map<string, Element>();
  let touched = false;
  const pageById = new Map(pages.map((p) => [p.id, p]));
  for (const { pageId, background } of inks) {
    const page = pageById.get(pageId);
    const on = onPage.get(pageId);
    if (!page || !on) continue;
    touched = true;
    const surface: CanvasSurface = background?.fill
      ? canvasSurface(pageFillTone(background.fill))
      : 'light';
    // A page inked twice in one call is judged as its first pass left it.
    const current = on.map((el) => replaced.get(el.id) ?? el);
    const painted = layerBands(current, tab.layers, { includeHidden: true }).flatMap(
      (b) => b.elements,
    );
    const anchors = painted.map((el) => elementAnchorPoint(el, index));
    const pass = inkPass(index, page.rect, background, surface, recall);
    painted.forEach((el, i) => {
      const next = pass.reink(el, anchors, i);
      if (next !== el) replaced.set(el.id, next);
    });
  }
  if (!touched) return { tab, memory };
  const nextMemory = pruned(recall, tab.elements);
  if (replaced.size === 0) return { tab, memory: nextMemory };
  const elements = tab.elements.map((el) => replaced.get(el.id) ?? el);
  return { tab: { ...tab, elements }, memory: nextMemory };
}

// The memory with what no longer applies dropped: an element gone, or nothing recalled for it.
function pruned(
  memory: Map<string, Partial<Record<InkField, InkRecall>>>,
  elements: readonly Element[],
): InkMemory {
  const ids = new Set(elements.map((e) => e.id));
  for (const [id, r] of [...memory]) {
    if (!ids.has(id) || Object.keys(r).length === 0) memory.delete(id);
  }
  return memory;
}

/** The tab re-inked for the page's new background (pageInkFor without a memory). */
export function withPageInkFor<T extends TabLike>(
  tab: T,
  pageId: string,
  background: IllustratePage['background'],
  memory?: InkMemory,
): T {
  return pageInkFor(tab, pageId, background, memory).tab;
}

// One page's pass, in paint order: each element measured against the covers drawn before it.
function inkPass(
  all: ElementIndex,
  rect: PageRect,
  background: IllustratePage['background'],
  surface: CanvasSurface,
  // The call's memory, written as the pass goes (pagesInkFor copies it first).
  memory: Map<string, Partial<Record<InkField, InkRecall>>>,
) {
  const covers: Cover[] = [];

  // The ground under an element: its topmost cover, else the page; null when a surface of unknown
  // tone covers it.
  const groundOf = (box: Rect, at: { x: number; y: number }): Ground | null => {
    for (let i = covers.length - 1; i >= 0; i -= 1) {
      const c = covers[i]!;
      if (!pointInRect(c.box, at)) continue;
      return c.tone === null ? null : { tones: [c.tone], mean: c.tone, card: c.tone };
    }
    return { ...pageGroundUnder(background, rect, box), card: null };
  };

  // One field moved for its role against the tones (memory-aware); the patch gains it when it
  // changes (undefined: back to no colour of its own). `unset` is for a field with no colour of
  // its own on a card: the ink it is drawn in now (`drawn`, the page's) and the ink its card asks
  // for (`fresh`); without it, a field with no colour of its own is left to follow the page.
  const field = (
    el: Element,
    field: InkField,
    role: InkRole,
    tones: readonly string[],
    patch: Patch,
    unset?: { drawn: string; fresh: string },
  ): string | undefined => {
    const current = (el as Partial<Record<InkField, string>>)[field];
    if (current !== undefined && !isOpaqueHex(current)) return current;
    const recalls = memory.get(el.id) ?? {};
    const recall = recalls[field];
    // The author's own: a colour, or UNSET for none.
    const own = recall && recall.to === current ? recall.from : (current ?? UNSET);
    const { floor, target } = INK_ROLE_CONTRAST[role];
    let next: string;
    if (own !== UNSET) {
      next = inkToward(own, tones, floor, target);
    } else if (unset && isOpaqueHex(unset.drawn) && isOpaqueHex(unset.fresh)) {
      const reads = worstContrast(unset.drawn, tones) >= floor;
      next = reads ? UNSET : inkToward(unset.fresh, tones, floor, target);
    } else {
      // No colour of its own and nothing to judge it by: it follows the page.
      next = UNSET;
    }
    const rest = { ...recalls };
    if (next === own) delete rest[field];
    else rest[field] = { from: own, to: next };
    memory.set(el.id, rest);
    const stored = next === UNSET ? undefined : next;
    if (stored !== current) patch[field] = stored;
    return stored ?? unset?.drawn;
  };

  const reink = (el: Element, anchors: { x: number; y: number }[], index: number): Element => {
    const kind = inkKindOf(el);
    const box = boxOf(el, all);
    if (kind === 'keep') {
      const tone = keptCover(el, surface);
      if (tone !== undefined) covers.push({ box, tone });
      return el;
    }
    const ground = groundOf(box, anchors[index]!);
    if (!ground) {
      // On a surface of unknown tone: left as it is, and what is on it too.
      if (kind === 'box' || kind === 'table') covers.push({ box, tone: null });
      return el;
    }
    const patch: Patch = {};
    if (kind === 'ink') ink(el, ground, patch);
    else if (kind === 'table') table(el as Extract<Element, { type: 'table' }>, ground, box, patch);
    else boxed(el as BoxedElement, ground, box, anchors, index, patch);
    if (Object.keys(patch).length === 0) return el;
    const next = { ...el, ...patch } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k];
    return next as Element;
  };

  // The ink an element with no colour of its own is drawn in, and the ink to judge it from, where
  // that ink may not read. On a card of the other lightness (a pale card on a dark page) the
  // page's ink is the wrong one: the card's is judged. Straight on a page with a fill of its own,
  // the page's ink is judged as it is: made for a near-white or near-black paper, it can vanish on
  // a mid-tone fill (a slate glyph on teal, a sky one on yellow). On a card of the page's own
  // lightness, and on the plain paper (or a white fill), the ink is the design's own pairing and
  // follows the page.
  const onCard = (ground: Ground, drawn: (s: CanvasSurface) => string) => {
    if (ground.card === null) {
      // A white fill is the paper as printed: its ink is the design's own there too.
      if (!background?.fill || ground.tones.every((t) => t.toLowerCase() === PAPER_TONE)) {
        return undefined;
      }
      const ink = drawn(surface);
      return { drawn: ink, fresh: ink };
    }
    const cardSurface = canvasSurface(ground.card);
    if (cardSurface === surface) return undefined;
    return { drawn: drawn(surface), fresh: drawn(cardSurface) };
  };

  const ink = (el: Element, ground: Ground, patch: Patch) => {
    const labelled = hasLabel(el);
    if (el.type === 'arrow') {
      // An arrow's label is drawn in its line's colour unless it has a text colour of its own.
      const lineIsLabel = labelled && !isOpaqueHex(el.textColor);
      const line = onCard(ground, () => defaultArrowStrokeColor(surface));
      field(el, 'strokeColor', lineIsLabel ? 'text' : 'line', ground.tones, patch, line);
      field(el, 'arrowheadColor', 'line', ground.tones, patch);
      if (labelled) field(el, 'textColor', 'text', ground.tones, patch);
      return;
    }
    const boxedEl = el;
    if (el.type !== 'text' && hasInkStroke(el)) {
      const pen = hasPen(el, 'penColour');
      const auto = pen ? undefined : onCard(ground, (s) => defaultStrokeColor(boxedEl, s));
      field(el, 'strokeColor', 'line', ground.tones, patch, auto);
    }
    if (el.type === 'text' || labelled) {
      const pen = hasPen(el, 'penTextColour');
      const auto = pen ? undefined : onCard(ground, (s) => defaultTextColor(boxedEl, s));
      field(el, 'textColor', 'text', ground.tones, patch, auto);
    }
  };

  const table = (
    el: Extract<Element, { type: 'table' }>,
    ground: Ground,
    box: Rect,
    patch: Patch,
  ) => {
    field(el, 'strokeColor', 'line', ground.tones, patch);
    const fill = isOpaqueHex(el.fillColor) ? el.fillColor : null;
    const body = fill ? [fill] : ground.tones;
    field(el, 'textColor', 'text', body, patch);
    const head = isOpaqueHex(el.headerFill) ? [el.headerFill] : body;
    field(el, 'headerTextColor', 'text', head, patch);
    if (fill) covers.push({ box, tone: fill });
  };

  const boxed = (
    el: BoxedElement,
    ground: Ground,
    box: Rect,
    anchors: { x: number; y: number }[],
    index: number,
    patch: Patch,
  ) => {
    const fill = boxFill(el, surface);
    if (!fill) {
      // Unfilled: an outline and a label straight on the ground.
      const outline = hasPen(el, 'penColour')
        ? undefined
        : onCard(ground, (s) => defaultStrokeColor(el, s));
      field(el, 'strokeColor', 'line', ground.tones, patch, outline);
      if (hasLabel(el)) {
        const text = hasPen(el, 'penTextColour')
          ? undefined
          : onCard(ground, (s) => defaultTextColor(el, s));
        field(el, 'textColor', 'text', ground.tones, patch, text);
      }
      return;
    }
    let shown = fill;
    if (isOpaqueHex(el.fillColor)) {
      const role: InkRole = hasLabel(el) || holdsAny(box, anchors, index) ? 'card' : 'mark';
      // A card is seen against its ground as a whole; a mark must read at its worst point.
      const tones = role === 'card' ? [ground.mean] : ground.tones;
      const border = boxBorder(el, surface);
      const { floor } = INK_ROLE_CONTRAST[role];
      const outlined = border !== null && worstContrast(border, tones) >= floor;
      if (outlined) shown = restore(el, 'fillColor', patch);
      else shown = field(el, 'fillColor', role, tones, patch) ?? fill;
    }
    if (el.type === 'shape' && el.shape === 'stat-row') {
      // Its figures (the stroke) and captions (the text) are written on its cards.
      const card = { ...ground, card: shown };
      const own = isOpaqueHex(el.fillColor);
      const stroke = own ? onCard(card, (s) => defaultStrokeColor(el, s)) : undefined;
      field(el, 'strokeColor', 'text', [shown], patch, stroke);
      const caption =
        own && !hasPen(el, 'penTextColour')
          ? onCard(card, (s) => defaultTextColor(el, s))
          : undefined;
      field(el, 'textColor', 'text', [shown], patch, caption);
    } else if (hasLabel(el)) {
      const under = labelFill(el, shown);
      // A label with no colour of its own on a fill of the box's own is judged like one on a card.
      const own = isOpaqueHex(el.fillColor) && !hasPen(el, 'penTextColour');
      const auto = own
        ? onCard({ ...ground, card: under }, (s) => defaultTextColor(el, s))
        : undefined;
      field(el, 'textColor', 'text', [under], patch, auto);
    }
    covers.push({ box, tone: shown });
  };

  // A field that needs no re-inking (its outline separates it): the author's own colour back when
  // re-inking left it, and its recall gone either way.
  const restore = (el: Element, field: InkField, patch: Patch): string => {
    const current = (el as Partial<Record<InkField, string>>)[field]!;
    const recalls = memory.get(el.id);
    const recall = recalls?.[field];
    if (!recall) return current;
    const rest = { ...recalls };
    delete rest[field];
    memory.set(el.id, rest);
    if (recall.to !== current) return current;
    patch[field] = recall.from;
    return recall.from;
  };
  return { reink };
}

// Whether anything drawn after the element (on the page) sits on it: its centre inside the box.
function holdsAny(box: Rect, anchors: { x: number; y: number }[], index: number): boolean {
  for (let j = index + 1; j < anchors.length; j += 1) {
    if (pointInRect(box, anchors[j]!)) return true;
  }
  return false;
}
