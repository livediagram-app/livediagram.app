// The pages Infographic mode draws on the canvas (docs/specs/007-editor/editor-modes.md "The
// pages"): A4 sheets in a row, each portrait or landscape on its own. The first is centred on the
// canvas origin and each further one sits a gap to the right of the one before. The pages are the
// tab's (`Tab.pages`), so everyone lays out on the same ones; the sheets themselves are a view,
// never elements. A tab from before multiple pages carries one `pageOrientation` instead, read as
// a single page.
import { isBoxed, type Element, type Tab } from './index';

export type PageOrientation = 'portrait' | 'landscape';

export const PAGE_ORIENTATIONS: readonly PageOrientation[] = ['portrait', 'landscape'];

// A4 is 210 x 297 mm; at the CSS 96 px per inch that is 793.7 x 1122.5, rounded to whole pixels.
export const A4_SHORT_SIDE = 794;
export const A4_LONG_SIDE = 1123;

// The space between two pages in the row, in canvas px.
export const INFOGRAPHIC_PAGE_GAP = 96;

// The most pages a tab holds: a row past this is a document, not an infographic.
export const MAX_INFOGRAPHIC_PAGES = 20;

export type InfographicPage = { id: string; orientation: PageOrientation };

export type PageRect = { x: number; y: number; width: number; height: number };

export type LaidOutPage = InfographicPage & { index: number; rect: PageRect };

// The id the first page of a tab that never stored its pages answers to.
const FIRST_PAGE_ID = 'page-1';

export function isPageOrientation(v: unknown): v is PageOrientation {
  return v === 'portrait' || v === 'landscape';
}

function isPage(v: unknown): v is InfographicPage {
  const p = v as InfographicPage | null;
  return (
    !!p && typeof p === 'object' && typeof p.id === 'string' && isPageOrientation(p.orientation)
  );
}

/** The tab's pages, in order: its stored ones, or one page in its legacy orientation (portrait
 *  unless it said landscape). Never empty; malformed entries are skipped. */
export function infographicPagesOf(
  tab: { pages?: unknown; pageOrientation?: unknown } | undefined,
): InfographicPage[] {
  const stored = Array.isArray(tab?.pages) ? tab.pages.filter(isPage) : [];
  if (stored.length > 0) return stored.slice(0, MAX_INFOGRAPHIC_PAGES);
  const orientation = isPageOrientation(tab?.pageOrientation) ? tab.pageOrientation : 'portrait';
  return [{ id: FIRST_PAGE_ID, orientation }];
}

function pageSize(orientation: PageOrientation): { width: number; height: number } {
  return orientation === 'portrait'
    ? { width: A4_SHORT_SIDE, height: A4_LONG_SIDE }
    : { width: A4_LONG_SIDE, height: A4_SHORT_SIDE };
}

/** Where each page sits: the first centred on the origin, each further one a gap to the right,
 *  every page centred on the row's horizontal axis (y = 0). */
export function layOutInfographicPages(pages: readonly InfographicPage[]): LaidOutPage[] {
  let x = 0;
  return pages.map((page, index) => {
    const { width, height } = pageSize(page.orientation);
    if (index === 0) x = -width / 2;
    const rect = { x, y: -height / 2, width, height };
    x += width + INFOGRAPHIC_PAGE_GAP;
    return { ...page, index, rect };
  });
}

/** The box the view fits to frame the first page: a square of the long side, centred on the
 *  origin, so either orientation fits at the same zoom and turning it never moves the view. */
export function infographicPageFitBox(): PageRect {
  return { x: -A4_LONG_SIDE / 2, y: -A4_LONG_SIDE / 2, width: A4_LONG_SIDE, height: A4_LONG_SIDE };
}

function contains(r: PageRect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** The page a canvas point lies on (edges included), if any. */
export function infographicPageAt(
  pages: readonly LaidOutPage[],
  point: { x: number; y: number },
): LaidOutPage | undefined {
  return pages.find((p) => contains(p.rect, point));
}

/** A new page's id: unique among the tab's pages. */
export function nextInfographicPageId(pages: readonly InfographicPage[]): string {
  const taken = new Set(pages.map((p) => p.id));
  let n = pages.length + 1;
  while (taken.has(`page-${n}`)) n += 1;
  return `page-${n}`;
}

/**
 * The tab with its pages replaced by `next`, every element moving with its page: an element whose
 * centre lies on a page that `next` keeps moves by however far that page moved (a page before it
 * turned, or was removed). Elements on a removed page, or on no page, stay where they are. One
 * tab edit, so one undo step. The legacy `pageOrientation` is dropped once pages are stored.
 */
export function withInfographicPages<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  next: readonly InfographicPage[],
): T & { pages: InfographicPage[] } {
  const before = layOutInfographicPages(infographicPagesOf(tab));
  const after = new Map(layOutInfographicPages(next).map((p) => [p.id, p.rect]));
  const shift = (point: { x: number; y: number }): { dx: number; dy: number } | null => {
    const page = infographicPageAt(before, point);
    const moved = page && after.get(page.id);
    if (!page || !moved) return null;
    // Re-centred on the page's centre, so a page that turned keeps its content about its middle.
    const dx = moved.x + moved.width / 2 - (page.rect.x + page.rect.width / 2);
    const dy = moved.y + moved.height / 2 - (page.rect.y + page.rect.height / 2);
    return dx === 0 && dy === 0 ? null : { dx, dy };
  };
  const elements = tab.elements.map((el): Element => {
    if (isBoxed(el)) {
      const d = shift({ x: el.x + el.width / 2, y: el.y + el.height / 2 });
      return d ? { ...el, x: el.x + d.dx, y: el.y + d.dy } : el;
    }
    // An arrow's free ends move with the page they sit on; pinned ends follow their element.
    const from = el.from.kind === 'free' ? shift(el.from) : null;
    const to = el.to.kind === 'free' ? shift(el.to) : null;
    if (!from && !to) return el;
    return {
      ...el,
      from:
        from && el.from.kind === 'free'
          ? { ...el.from, x: el.from.x + from.dx, y: el.from.y + from.dy }
          : el.from,
      to:
        to && el.to.kind === 'free' ? { ...el.to, x: el.to.x + to.dx, y: el.to.y + to.dy } : el.to,
    };
  });
  const { pageOrientation: _legacy, ...rest } = tab;
  void _legacy;
  return { ...(rest as T), elements, pages: [...next] };
}
