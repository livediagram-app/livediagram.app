// The pages Infographic mode draws on the canvas (docs/specs/007-editor/editor-modes.md "The
// pages", docs/specs/007-editor/infographic-pages.md): sheets in a row, each its own size
// (A4 unless it says otherwise), orientation, background and name. The first is centred on the
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

// A page's format (docs/specs/007-editor/infographic-pages.md "Sizes"): its short and long side.
export type PageSizeId = 'a4' | 'letter' | 'a3' | 'square' | 'social' | 'wide';

export const PAGE_SIZES: Readonly<
  Record<PageSizeId, { short: number; long: number; portrait: string; landscape: string }>
> = {
  a4: { short: A4_SHORT_SIDE, long: A4_LONG_SIDE, portrait: 'A4', landscape: 'A4' },
  letter: { short: 816, long: 1056, portrait: 'US Letter', landscape: 'US Letter' },
  a3: { short: 1123, long: 1587, portrait: 'A3', landscape: 'A3' },
  square: { short: 1080, long: 1080, portrait: 'Square', landscape: 'Square' },
  social: {
    short: 1080,
    long: 1350,
    portrait: 'Portrait post (4:5)',
    landscape: 'Landscape post (5:4)',
  },
  wide: { short: 1080, long: 1920, portrait: 'Story (9:16)', landscape: 'Slide (16:9)' },
};

export const PAGE_SIZE_IDS = Object.keys(PAGE_SIZES) as PageSizeId[];

export function isPageSizeId(v: unknown): v is PageSizeId {
  return typeof v === 'string' && v in PAGE_SIZES;
}

// What a page is painted with (docs/specs/007-editor/infographic-pages.md "Backgrounds"): a fill
// (absent is the paper) and a pattern over it.
export type PageFill =
  { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number };
export type PagePattern = 'dots' | 'grid' | 'lines';
export const PAGE_PATTERNS: readonly PagePattern[] = ['dots', 'grid', 'lines'];
export type PageBackground = { fill?: PageFill; pattern?: PagePattern };

// The longest page name kept: a label, not a caption.
export const PAGE_NAME_MAX = 60;

export type InfographicPage = {
  id: string;
  orientation: PageOrientation;
  // Absent is A4.
  size?: PageSizeId;
  // Absent is the plain paper.
  background?: PageBackground;
  // Absent shows the page's place ("Page 2").
  name?: string;
};

export type PageRect = { x: number; y: number; width: number; height: number };

export type LaidOutPage = InfographicPage & { index: number; rect: PageRect };

// The id the first page of a tab that never stored its pages answers to.
const FIRST_PAGE_ID = 'page-1';

export function isPageOrientation(v: unknown): v is PageOrientation {
  return v === 'portrait' || v === 'landscape';
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const isHex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);

function parseFill(v: unknown): PageFill | undefined {
  const f = v as Record<string, unknown> | null;
  if (!f || typeof f !== 'object') return undefined;
  if (f.kind === 'solid' && isHex(f.color)) return { kind: 'solid', color: f.color };
  if (f.kind === 'gradient' && isHex(f.from) && isHex(f.to)) {
    const raw = typeof f.angle === 'number' && Number.isFinite(f.angle) ? f.angle : 180;
    return {
      kind: 'gradient',
      from: f.from,
      to: f.to,
      angle: ((Math.round(raw) % 360) + 360) % 360,
    };
  }
  return undefined;
}

function parseBackground(v: unknown): PageBackground | undefined {
  const b = v as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return undefined;
  const fill = parseFill(b.fill);
  const pattern = PAGE_PATTERNS.includes(b.pattern as PagePattern)
    ? (b.pattern as PagePattern)
    : undefined;
  if (!fill && !pattern) return undefined;
  return { ...(fill ? { fill } : {}), ...(pattern ? { pattern } : {}) };
}

/** A stored page, or undefined when it has no valid id or orientation. Its optional fields keep
 *  what is valid and drop the rest. */
function parsePage(v: unknown): InfographicPage | undefined {
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !isPageOrientation(p.orientation))
    return undefined;
  const background = parseBackground(p.background);
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, PAGE_NAME_MAX) : '';
  return {
    id: p.id,
    orientation: p.orientation,
    ...(isPageSizeId(p.size) && p.size !== 'a4' ? { size: p.size } : {}),
    ...(background ? { background } : {}),
    ...(name ? { name } : {}),
  };
}

/** The tab's pages, in order: its stored ones, or one page in its legacy orientation (portrait
 *  unless it said landscape). Never empty; malformed entries, and a repeat of an id already seen,
 *  are skipped. */
export function infographicPagesOf(
  tab: { pages?: unknown; pageOrientation?: unknown } | undefined,
): InfographicPage[] {
  const seen = new Set<string>();
  const stored = Array.isArray(tab?.pages)
    ? tab.pages.map(parsePage).filter((p): p is InfographicPage => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
    : [];
  if (stored.length > 0) return stored.slice(0, MAX_INFOGRAPHIC_PAGES);
  const orientation = isPageOrientation(tab?.pageOrientation) ? tab.pageOrientation : 'portrait';
  return [{ id: FIRST_PAGE_ID, orientation }];
}

/** A page's width and height in canvas px: its size's sides, the long one upright in portrait.
 *  A square page is the same either way. */
export function pageDimensions(page: Pick<InfographicPage, 'orientation' | 'size'>): {
  width: number;
  height: number;
} {
  const { short, long } = PAGE_SIZES[page.size ?? 'a4'];
  return page.orientation === 'portrait'
    ? { width: short, height: long }
    : { width: long, height: short };
}

/** Whether a page has an orientation to choose (a square page has none). */
export function pageHasOrientation(page: Pick<InfographicPage, 'size'>): boolean {
  const { short, long } = PAGE_SIZES[page.size ?? 'a4'];
  return short !== long;
}

/** The size's name as this page shows it ("A4", "Slide (16:9)"). */
export function pageSizeLabel(page: Pick<InfographicPage, 'orientation' | 'size'>): string {
  return PAGE_SIZES[page.size ?? 'a4'][page.orientation];
}

/** The label above a page: its name, or "Page n" once there are several, then its size and, where
 *  it has one, its orientation ("Page 2 · A4 · Landscape", "Launch · Square"). */
export function pageLabel(
  page: Pick<InfographicPage, 'orientation' | 'size' | 'name'>,
  index: number,
  count: number,
): string {
  const parts: string[] = [];
  if (page.name) parts.push(page.name);
  else if (count > 1) parts.push(`Page ${index + 1}`);
  parts.push(pageSizeLabel(page));
  const size = page.size ?? 'a4';
  // A size whose name already says which way it faces (the social and wide formats) needs no
  // orientation after it; nor does a square.
  if (pageHasOrientation(page) && (size === 'a4' || size === 'letter' || size === 'a3')) {
    parts.push(page.orientation === 'portrait' ? 'Portrait' : 'Landscape');
  }
  return parts.join(' · ');
}

/** The page's own margin, in canvas px: what layouts keep clear and snapping offers. */
export function pageMargin(page: Pick<InfographicPage, 'orientation' | 'size'>): number {
  const { width, height } = pageDimensions(page);
  return Math.round(Math.min(width, height) * PAGE_MARGIN_FRACTION);
}

// A page's margin as a share of its short side (docs/specs/007-editor/infographic-pages.md).
export const PAGE_MARGIN_FRACTION = 0.07;

/** Where each page sits: the first centred on the origin, each further one a gap to the right,
 *  every page centred on the row's horizontal axis (y = 0). */
export function layOutInfographicPages(pages: readonly InfographicPage[]): LaidOutPage[] {
  let x = 0;
  return pages.map((page, index) => {
    const { width, height } = pageDimensions(page);
    if (index === 0) x = -width / 2;
    const rect = { x, y: -height / 2, width, height };
    x += width + INFOGRAPHIC_PAGE_GAP;
    return { ...page, index, rect };
  });
}

/** The box the view fits to frame a page (the first by default): a square of its long side,
 *  centred on the page, so either orientation fits at the same zoom and turning it never moves the
 *  view. With no page, an A4 one at the origin. */
export function infographicPageFitBox(page?: Pick<LaidOutPage, 'rect'>): PageRect {
  if (!page) {
    return {
      x: -A4_LONG_SIDE / 2,
      y: -A4_LONG_SIDE / 2,
      width: A4_LONG_SIDE,
      height: A4_LONG_SIDE,
    };
  }
  const { x, y, width, height } = page.rect;
  const side = Math.max(width, height);
  return { x: x + width / 2 - side / 2, y: y + height / 2 - side / 2, width: side, height: side };
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

/** A new page's id: never one a page has had before, so a page slide (Slide.pageId) of a deleted
 *  page stays empty rather than finding a new page under its old id. Random, checked against the
 *  tab's pages. */
export function nextInfographicPageId(pages: readonly InfographicPage[]): string {
  const taken = new Set(pages.map((p) => p.id));
  let id: string;
  do id = `page-${crypto.randomUUID().slice(0, 8)}`;
  while (taken.has(id));
  return id;
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
