// What sits on an Illustrate page, and the page edits that touch it
// (docs/specs/007-editor/illustrate-pages.md): duplicating a page with everything on it, and
// replacing a page's content with a layout. Plus the page's own surface, so elements with no colour
// of their own are inked for a dark page. Pure: tab in, tab out, one tab edit each.
import {
  canvasSurface,
  contrastRatio,
  isLightColor,
  shade,
  tint,
  type CanvasSurface,
} from './colors';
import { duplicateElements } from './duplicate';
import { endpointPosition, type ElementIndex } from './geometry';
import {
  illustratePageAt,
  illustratePagesOf,
  layOutIllustratePages,
  PAGE_NAME_MAX,
  pageMargin,
  withIllustratePages,
  type IllustratePage,
  type LaidOutPage,
  type PageFill,
} from './illustrate-page';
import { isBoxed, type Element, type Endpoint, type ShapeElement, type Tab } from './index';

type Point = { x: number; y: number };

/** Where an element sits for the purpose of "which page is it on": a box's centre, an arrow's
 *  midpoint between its resolved ends. */
export function elementAnchorPoint(
  el: Element,
  elements: readonly Element[] | ElementIndex,
): Point {
  if (isBoxed(el)) return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const all = elements as Element[] | ElementIndex;
  const a = endpointPosition(el.from, all);
  const b = endpointPosition(el.to, all);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** The ids of every element on the page: whose anchor point lies on it. */
export function elementIdsOnPage(
  elements: Element[],
  pages: readonly LaidOutPage[],
  pageId: string,
): Set<string> {
  const ids = new Set<string>();
  for (const el of elements) {
    const page = illustratePageAt(pages, elementAnchorPoint(el, elements));
    if (page?.id === pageId) ids.add(el.id);
  }
  return ids;
}

/**
 * The tab with a copy of a page right after it: the same size, orientation and background, its name
 * marked as a copy, and a copy of every element on it, moved onto the copy. Pages after it move
 * along with their content. An arrow pinned only to copied elements is copied pinned to the copies;
 * one pinned to anything off the page stays behind. `newPageId` names the copy.
 */
export function withDuplicatedPage<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  pageId: string,
  newPageId: string,
): T & { pages: IllustratePage[] } {
  const pages = illustratePagesOf(tab);
  const index = pages.findIndex((p) => p.id === pageId);
  if (index < 0) return { ...tab, pages };
  const source = pages[index]!;
  const copy: IllustratePage = {
    ...source,
    id: newPageId,
    // A copy is unlocked (docs/specs/007-editor/illustrate-pages.md "Locking a page").
    locked: undefined,
    ...(source.name ? { name: `${source.name} copy`.slice(0, PAGE_NAME_MAX) } : {}),
  };
  const next = [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)];
  const before = layOutIllustratePages(pages);
  const onPage = elementIdsOnPage(tab.elements, before, pageId);
  // Everything else first: the pages after it, and their content, move along.
  const moved = withIllustratePages(tab, next);
  const after = layOutIllustratePages(next);
  const from = before[index]!.rect;
  const to = after[index + 1]!.rect;
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  // The shared duplication (ids, links, mind-map parents, portals, arrow-on-arrow ends remapped),
  // less any arrow tied to something left behind: pinned to an element off the page, or riding an
  // arrow that is not copied. Settled as a fixpoint, since leaving one arrow behind can leave its
  // riders behind too. Those stay with the original.
  const copied = new Set(onPage);
  let dropped = true;
  while (dropped) {
    dropped = false;
    for (const el of tab.elements) {
      if (!copied.has(el.id) || el.type !== 'arrow') continue;
      const tied = [el.from, el.to].some(
        (ep) =>
          (ep.kind === 'pinned' && !onPage.has(ep.elementId)) ||
          (ep.kind === 'on-arrow' && !copied.has(ep.arrowId)),
      );
      if (tied) {
        copied.delete(el.id);
        dropped = true;
      }
    }
  }
  const { newElements, idMap } = duplicateElements(tab.elements, copied, dx, dy);
  // In the source page's own paint order, so an arrow under a card stays under its copy.
  const rank = new Map(tab.elements.map((el, i) => [el.id, i]));
  const sourceOf = new Map([...idMap].map(([from, to]) => [to, from]));
  const copies = [...newElements].sort(
    (x, y) => (rank.get(sourceOf.get(x.id) ?? '') ?? 0) - (rank.get(sourceOf.get(y.id) ?? '') ?? 0),
  );
  return { ...moved, elements: [...moved.elements, ...copies] };
}

/**
 * The tab with everything on a page removed (and every arrow pinned to something removed), then
 * `placed` added: a layout put onto a page that had content (docs/specs/007-editor/
 * illustrate-pages.md "Layouts"). One tab edit.
 */
export function withPageContentReplaced<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  pageId: string,
  placed: Element[],
): T {
  const pages = layOutIllustratePages(illustratePagesOf(tab));
  const gone = elementIdsOnPage(tab.elements, pages, pageId);
  // Arrows pinned to anything removed go too, and so, in turn, do arrows riding a removed arrow
  // (on-arrow ends), until nothing more goes.
  const ends = (el: Element) => (el.type === 'arrow' ? [el.from, el.to] : []);
  let grew = true;
  while (grew) {
    grew = false;
    for (const el of tab.elements) {
      if (gone.has(el.id) || el.type !== 'arrow') continue;
      const tied = ends(el).some(
        (ep) =>
          (ep.kind === 'pinned' && gone.has(ep.elementId)) ||
          (ep.kind === 'on-arrow' && gone.has(ep.arrowId)),
      );
      if (tied) {
        gone.add(el.id);
        grew = true;
      }
    }
  }
  const kept = tab.elements.filter((el) => !gone.has(el.id));
  return { ...tab, elements: [...kept, ...placed] };
}

/** The colour a page's fill reads as: a solid's colour, a gradient's two stops averaged. */
export function pageFillTone(fill: PageFill): string {
  if (fill.kind === 'solid') return fill.color;
  const rgb = (hex: string) => {
    const h = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const a = rgb(fill.from);
  const b = rgb(fill.to);
  return (
    '#' +
    a
      .map((v, i) =>
        Math.round((v + b[i]!) / 2)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** The surface a page's own fill makes, or null for the plain paper (which leaves elements inked
 *  as the canvas inks them). */
export function pageSurface(page: Pick<IllustratePage, 'background'>): CanvasSurface | null {
  const fill = page.background?.fill;
  return fill ? canvasSurface(pageFillTone(fill)) : null;
}

/** Whether a page's fill is dark: its elements with no colour of their own take light ink. */
export function pageIsDark(page: Pick<IllustratePage, 'background'>): boolean {
  const fill = page.background?.fill;
  return !!fill && !isLightColor(pageFillTone(fill));
}

/** The surface of every element on a page with a fill of its own, by element id: what that
 *  element's uncoloured parts are inked for. Elements on the paper, or on no page, are absent and
 *  take the canvas's surface. */
export function elementPageSurfaces(
  elements: Element[],
  pages: readonly LaidOutPage[],
): Map<string, CanvasSurface> {
  const out = new Map<string, CanvasSurface>();
  if (!pages.some((p) => p.background?.fill)) return out;
  for (const el of elements) {
    const page = illustratePageAt(pages, elementAnchorPoint(el, elements));
    const surface = page && pageSurface(page);
    if (surface) out.set(el.id, surface);
  }
  return out;
}

/** What a move or resize in Illustrate mode snaps to besides other elements: each page's edges
 *  and centre lines, and its margins (docs/specs/007-editor/illustrate-pages.md "Snapping to the
 *  page"). Never drawn or stored: stand-in boxes the alignment snap measures, one for the sheet
 *  and one for its margin box, with ids no element can take. */
export function illustratePageSnapBoxes(pages: readonly LaidOutPage[]): ShapeElement[] {
  return pages.flatMap((page) => {
    const m = pageMargin(page);
    const { x, y, width, height } = page.rect;
    const box = (id: string, bx: number, by: number, w: number, h: number): ShapeElement => ({
      id,
      type: 'shape',
      shape: 'square',
      x: bx,
      y: by,
      width: w,
      height: h,
    });
    return [
      box(`page-snap:${page.id}`, x, y, width, height),
      box(`page-margin:${page.id}`, x + m, y + m, width - 2 * m, height - 2 * m),
    ];
  });
}

// The least contrast a re-inked colour reaches against its page (WCAG AA for text).
const PAGE_INK_CONTRAST = 4.5;
// Below this contrast a colour of its own is re-inked: a colour that still reads is kept as chosen.
const PAGE_INK_FLOOR = 3;

/** A colour that reads on `tone`: the same hue lightened on a dark tone or darkened on a light one,
 *  stepwise until it reaches AA contrast; unchanged while it already clears the floor. */
export function legibleOn(color: string, tone: string): string {
  const ratio = contrastRatio(color, tone);
  if (Number.isNaN(ratio) || ratio >= PAGE_INK_FLOOR) return color;
  const lighten = !isLightColor(tone);
  for (let amount = 0.2; amount <= 1.0001; amount += 0.1) {
    const next = lighten ? tint(color, amount) : shade(color, amount);
    if (contrastRatio(next, tone) >= PAGE_INK_CONTRAST) return next;
  }
  return lighten ? '#ffffff' : '#0f172a';
}

/**
 * The tab with the colours of its own that sit straight on a page re-inked to read on the page's
 * new background (docs/specs/007-editor/illustrate-pages.md "A dark page has light ink"): a text
 * element's text, an arrow's line, an icon's glyph. Anything on a fill of its own (a card, a
 * shape) reads against that fill and is left alone, as is every element with no colour of its own
 * (the page's surface inks those). `background` is the page's background after the change.
 */
export function withPageInkFor<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  pageId: string,
  background: IllustratePage['background'],
): T {
  const pages = layOutIllustratePages(illustratePagesOf(tab));
  const on = elementIdsOnPage(tab.elements, pages, pageId);
  const tone = background?.fill ? pageFillTone(background.fill) : '#ffffff';
  let changed = false;
  const elements = tab.elements.map((el) => {
    if (!on.has(el.id)) return el;
    if (el.type === 'arrow') {
      if (!el.strokeColor) return el;
      const next = legibleOn(el.strokeColor, tone);
      if (next === el.strokeColor) return el;
      changed = true;
      return { ...el, strokeColor: next };
    }
    if (el.type === 'text' && el.textColor) {
      const next = legibleOn(el.textColor, tone);
      if (next === el.textColor) return el;
      changed = true;
      return { ...el, textColor: next };
    }
    if (el.type === 'shape' && el.shape === 'icon' && el.strokeColor) {
      const next = legibleOn(el.strokeColor, tone);
      if (next === el.strokeColor) return el;
      changed = true;
      return { ...el, strokeColor: next };
    }
    return el;
  });
  return changed ? { ...tab, elements } : tab;
}

/**
 * The tab with the given elements (a page's content from before a change of size or orientation)
 * fitted into that page's margin box as it now is (docs/specs/007-editor/illustrate-pages.md
 * "Sizes"): content that already fits stays its size, centred where the re-centring put it;
 * content that no longer fits is scaled down as one, about the page's centre, until it does. Text
 * scales with it (textScale), so a scaled page reads as the same page, smaller. Pinned arrows
 * follow their ends; a free end moves with the content.
 */
export function withContentFittedToPage<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  ids: ReadonlySet<string>,
  pageId: string,
  // Centre the content on the page even when it already fits (laying content out into pages).
  { centre = false }: { centre?: boolean } = {},
): T {
  const page = layOutIllustratePages(illustratePagesOf(tab)).find((p) => p.id === pageId);
  if (!page || ids.size === 0) return tab;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const take = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const el of tab.elements) {
    if (!ids.has(el.id)) continue;
    if (isBoxed(el)) {
      take(el.x, el.y);
      take(el.x + el.width, el.y + el.height);
    } else {
      for (const ep of [el.from, el.to]) if (ep.kind === 'free') take(ep.x, ep.y);
    }
  }
  if (!Number.isFinite(minX)) return tab;
  const m = pageMargin(page);
  const roomW = page.rect.width - 2 * m;
  const roomH = page.rect.height - 2 * m;
  const s = Math.min(1, roomW / Math.max(1, maxX - minX), roomH / Math.max(1, maxY - minY));
  const cx = page.rect.x + page.rect.width / 2;
  const cy = page.rect.y + page.rect.height / 2;
  // The content's centre lands on the page's (scaled about it); unscaled content keeps its place
  // unless it pokes out of the margin box, when it is nudged back in.
  const ox = (minX + maxX) / 2;
  const oy = (minY + maxY) / 2;
  const scaled = s < 1;
  const toX = scaled || centre ? cx : ox;
  const toY = scaled || centre ? cy : oy;
  const halfW = ((maxX - minX) * s) / 2;
  const halfH = ((maxY - minY) * s) / 2;
  const nudgeX = clampInto(toX, halfW, page.rect.x + m, page.rect.x + page.rect.width - m) - toX;
  const nudgeY = clampInto(toY, halfH, page.rect.y + m, page.rect.y + page.rect.height - m) - toY;
  if (!scaled && nudgeX === 0 && nudgeY === 0 && toX === ox && toY === oy) return tab;
  const mapX = (x: number) => toX + nudgeX + (x - ox) * s;
  const mapY = (y: number) => toY + nudgeY + (y - oy) * s;
  const r = (n: number) => Math.round(n * 100) / 100;
  const elements = tab.elements.map((el): Element => {
    if (!ids.has(el.id)) return el;
    if (isBoxed(el)) {
      const next = {
        ...el,
        x: r(mapX(el.x)),
        y: r(mapY(el.y)),
        width: r(el.width * s),
        height: r(el.height * s),
      } as Element;
      if (scaled && next.type === 'text') {
        return { ...next, textScale: r((next.textScale ?? 1) * s) };
      }
      return next;
    }
    const end = (ep: Endpoint): Endpoint =>
      ep.kind === 'free' ? { ...ep, x: r(mapX(ep.x)), y: r(mapY(ep.y)) } : ep;
    // Bends are deltas from the line, so they scale with it.
    const bend = (d: { dx: number; dy: number }) => ({ dx: r(d.dx * s), dy: r(d.dy * s) });
    return {
      ...el,
      from: end(el.from),
      to: end(el.to),
      ...(scaled && el.curveOffset ? { curveOffset: bend(el.curveOffset) } : {}),
      ...(scaled && el.curvePoints ? { curvePoints: el.curvePoints.map(bend) } : {}),
      ...(scaled && el.elbowOffset ? { elbowOffset: bend(el.elbowOffset) } : {}),
    };
  });
  return { ...tab, elements };
}

// A centre that keeps a half-extent inside [lo, hi] (centred when it cannot).
function clampInto(c: number, half: number, lo: number, hi: number): number {
  if (hi - lo <= 2 * half) return (lo + hi) / 2;
  return Math.min(hi - half, Math.max(lo + half, c));
}
