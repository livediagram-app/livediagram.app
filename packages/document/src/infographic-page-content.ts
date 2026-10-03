// What sits on an Infographic page, and the page edits that touch it
// (docs/specs/007-editor/infographic-pages.md): duplicating a page with everything on it, and
// replacing a page's content with a layout. Plus the page's own surface, so elements with no colour
// of their own are inked for a dark page. Pure: tab in, tab out, one tab edit each.
import { canvasSurface, isLightColor, type CanvasSurface } from './colors';
import { endpointPosition } from './geometry';
import {
  infographicPageAt,
  infographicPagesOf,
  layOutInfographicPages,
  withInfographicPages,
  type InfographicPage,
  type LaidOutPage,
  type PageFill,
} from './infographic-page';
import { isBoxed, type Element, type Endpoint, type Tab } from './index';

type Point = { x: number; y: number };

/** Where an element sits for the purpose of "which page is it on": a box's centre, an arrow's
 *  midpoint between its resolved ends. */
export function elementAnchorPoint(el: Element, elements: Element[]): Point {
  if (isBoxed(el)) return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const a = endpointPosition(el.from, elements);
  const b = endpointPosition(el.to, elements);
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
    const page = infographicPageAt(pages, elementAnchorPoint(el, elements));
    if (page?.id === pageId) ids.add(el.id);
  }
  return ids;
}

const pinnedTo = (ep: Endpoint): string | null => (ep.kind === 'pinned' ? ep.elementId : null);

/**
 * The tab with a copy of a page right after it: the same size, orientation and background, its name
 * marked as a copy, and a copy of every element on it, moved onto the copy. Pages after it move
 * along with their content. An arrow pinned only to copied elements is copied pinned to the copies;
 * one pinned to anything off the page stays behind. `newPageId` names the copy; `newId` mints
 * element ids.
 */
export function withDuplicatedPage<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  pageId: string,
  newPageId: string,
  newId: () => string,
): T & { pages: InfographicPage[] } {
  const pages = infographicPagesOf(tab);
  const index = pages.findIndex((p) => p.id === pageId);
  if (index < 0) return { ...tab, pages };
  const source = pages[index]!;
  const copy: InfographicPage = {
    ...source,
    id: newPageId,
    ...(source.name ? { name: `${source.name} copy` } : {}),
  };
  const next = [...pages.slice(0, index + 1), copy, ...pages.slice(index + 1)];
  const before = layOutInfographicPages(pages);
  const onPage = elementIdsOnPage(tab.elements, before, pageId);
  // Everything else first: the pages after it, and their content, move along.
  const moved = withInfographicPages(tab, next);
  const after = layOutInfographicPages(next);
  const from = before[index]!.rect;
  const to = after[index + 1]!.rect;
  const dx = to.x + to.width / 2 - (from.x + from.width / 2);
  const dy = to.y + to.height / 2 - (from.y + from.height / 2);
  const idMap = new Map<string, string>();
  for (const el of tab.elements) if (onPage.has(el.id)) idMap.set(el.id, newId());
  const shiftEnd = (ep: Endpoint): Endpoint | null => {
    if (ep.kind === 'free') return { ...ep, x: ep.x + dx, y: ep.y + dy };
    if (ep.kind === 'pinned') {
      const id = idMap.get(ep.elementId);
      return id ? { ...ep, elementId: id } : null;
    }
    return null;
  };
  const copies: Element[] = [];
  for (const el of tab.elements) {
    const id = idMap.get(el.id);
    if (!id) continue;
    if (isBoxed(el)) {
      copies.push({ ...el, id, x: el.x + dx, y: el.y + dy } as Element);
      continue;
    }
    const fromEnd = shiftEnd(el.from);
    const toEnd = shiftEnd(el.to);
    // An arrow tied to something left behind (or riding another arrow) stays with the original.
    if (!fromEnd || !toEnd) continue;
    copies.push({ ...el, id, from: fromEnd, to: toEnd });
  }
  return { ...moved, elements: [...moved.elements, ...copies] };
}

/**
 * The tab with everything on a page removed (and every arrow pinned to something removed), then
 * `placed` added: a layout put onto a page that had content (docs/specs/007-editor/
 * infographic-pages.md "Layouts"). One tab edit.
 */
export function withPageContentReplaced<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  pageId: string,
  placed: Element[],
): T {
  const pages = layOutInfographicPages(infographicPagesOf(tab));
  const gone = elementIdsOnPage(tab.elements, pages, pageId);
  const kept = tab.elements.filter((el) => {
    if (gone.has(el.id)) return false;
    if (isBoxed(el)) return true;
    const a = pinnedTo(el.from);
    const b = pinnedTo(el.to);
    return !(a && gone.has(a)) && !(b && gone.has(b));
  });
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
export function pageSurface(page: Pick<InfographicPage, 'background'>): CanvasSurface | null {
  const fill = page.background?.fill;
  return fill ? canvasSurface(pageFillTone(fill)) : null;
}

/** Whether a page's fill is dark: its elements with no colour of their own take light ink. */
export function pageIsDark(page: Pick<InfographicPage, 'background'>): boolean {
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
    const page = infographicPageAt(pages, elementAnchorPoint(el, elements));
    const surface = page && pageSurface(page);
    if (surface) out.set(el.id, surface);
  }
  return out;
}
