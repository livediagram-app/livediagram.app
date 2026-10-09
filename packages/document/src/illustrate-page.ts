// The pages Illustrate mode draws on the canvas (docs/specs/007-editor/editor-modes.md "The
// pages", docs/specs/007-editor/illustrate-pages.md): sheets in a row, each its own size
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
export const ILLUSTRATE_PAGE_GAP = 96;

// The most pages a tab holds (docs/specs/007-editor/illustrate-pages.md "Page actions"): room
// for a long document's pages beside a set of infographic ones.
export const MAX_ILLUSTRATE_PAGES = 100;

// A page's format (docs/specs/007-editor/illustrate-pages.md "Sizes"): its short and long side.
export type PageSizeId =
  'a4' | 'letter' | 'a3' | 'square' | 'social' | 'wide' | 'slide' | 'slide-classic' | 'logo';

// A logo page's artboard (docs/specs/007-editor/logo-pages.md "A logo page"): the common
// app-icon master, square.
export const LOGO_SIDE = 1024;

// A logo page's margin, its safe area, as a share of its side (docs/specs/007-editor/logo-pages.md).
export const LOGO_SAFE_FRACTION = 0.1;

export const PAGE_SIZES: Readonly<
  Record<
    PageSizeId,
    {
      short: number;
      long: number;
      portrait: string;
      landscape: string;
      // A slide size is landscape whatever the page's stored orientation, and offers no turn.
      landscapeOnly?: true;
      // The logo artboard: offered by logo pages alone.
      logoOnly?: true;
    }
  >
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
  slide: {
    short: 1080,
    long: 1920,
    portrait: 'Slide (16:9)',
    landscape: 'Slide (16:9)',
    landscapeOnly: true,
  },
  'slide-classic': {
    short: 1080,
    long: 1440,
    portrait: 'Classic slide (4:3)',
    landscape: 'Classic slide (4:3)',
    landscapeOnly: true,
  },
  logo: {
    short: LOGO_SIDE,
    long: LOGO_SIDE,
    portrait: '1024 x 1024',
    landscape: '1024 x 1024',
    logoOnly: true,
  },
};

export const PAGE_SIZE_IDS = Object.keys(PAGE_SIZES) as PageSizeId[];

// The sizes a slide page may take (docs/specs/007-editor/illustrate-pages.md "Sizes"), the first
// its default.
export const SLIDE_PAGE_SIZE_IDS: readonly PageSizeId[] = ['slide', 'slide-classic'];
const PAPER_AND_SCREEN_SIZE_IDS: readonly PageSizeId[] = [
  'a4',
  'letter',
  'a3',
  'square',
  'social',
  'wide',
];

// The one size a logo page takes (docs/specs/007-editor/logo-pages.md "A logo page").
export const LOGO_PAGE_SIZE_IDS: readonly PageSizeId[] = ['logo'];

/** The sizes a page of this kind offers in its panel: a slide page only the slide sizes, a logo
 *  page only the artboard, an article page the paper and screen ones, an infographic page those
 *  and the 16:9 slide. */
export function pageSizesFor(kind: PageKind): readonly PageSizeId[] {
  if (kind === 'slide') return SLIDE_PAGE_SIZE_IDS;
  if (kind === 'logo') return LOGO_PAGE_SIZE_IDS;
  if (kind === 'article') return PAPER_AND_SCREEN_SIZE_IDS;
  return [...PAPER_AND_SCREEN_SIZE_IDS, 'slide'];
}

export function isPageSizeId(v: unknown): v is PageSizeId {
  return typeof v === 'string' && v in PAGE_SIZES;
}

// What a page is painted with (docs/specs/007-editor/illustrate-pages.md "Backgrounds"): a fill
// (absent is the paper) and a pattern over it.
export type PageFill =
  { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number };
export type PagePattern = 'dots' | 'grid' | 'lines';
export const PAGE_PATTERNS: readonly PagePattern[] = ['dots', 'grid', 'lines'];
export type PageBackground = { fill?: PageFill; pattern?: PagePattern };

// The longest page name kept: a label, not a caption.
export const PAGE_NAME_MAX = 60;

// What a page is for, fixed when it is made (docs/specs/007-editor/illustrate-pages.md "Page
// kinds"): an infographic page to lay out, an article page to write on, a slide of a deck, or a
// logo's artboard.
export type PageKind = 'infographic' | 'article' | 'slide' | 'logo';

export type IllustratePage = {
  id: string;
  orientation: PageOrientation;
  // Absent is A4.
  size?: PageSizeId;
  // Absent is the plain paper.
  background?: PageBackground;
  // Absent shows the page's place ("Page 2").
  name?: string;
  // Absent is an infographic page nobody has chosen yet (the first page offers the choice while
  // it is the only page and empty); 'infographic' once chosen; 'article' for an article page;
  // 'slide' for a slide, always landscape in a slide size; 'logo' for a logo's artboard, always
  // the `logo` size and never patterned.
  kind?: PageKind;
  // The article an article page belongs to (`Tab.articles[flow]`); present exactly on article pages.
  flow?: string;
  // Locked (docs/specs/007-editor/illustrate-pages.md "Locking a page"): it and what is on it stay
  // as they are. Absent is unlocked.
  locked?: true;
  // Started blank (Start From Scratch on its Start From a Layout card): the card is not offered on it
  // again; its panel's Layouts still are. Absent while it may be offered.
  startedBlank?: true;
};

export type PageRect = { x: number; y: number; width: number; height: number };

export type LaidOutPage = IllustratePage & { index: number; rect: PageRect };

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
function parsePage(v: unknown): IllustratePage | undefined {
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !isPageOrientation(p.orientation))
    return undefined;
  const background = parseBackground(p.background);
  const name = typeof p.name === 'string' ? p.name.trim().slice(0, PAGE_NAME_MAX) : '';
  const lock = {
    ...(p.locked === true ? { locked: true as const } : {}),
    ...(p.startedBlank === true ? { startedBlank: true as const } : {}),
  };
  // An article page without a readable flow is an article of its own.
  const kindFields =
    p.kind === 'article'
      ? {
          kind: 'article' as const,
          flow:
            typeof p.flow === 'string' && p.flow.length > 0 && p.flow.length <= 64 ? p.flow : p.id,
        }
      : p.kind === 'infographic'
        ? { kind: 'infographic' as const }
        : p.kind === 'slide'
          ? { kind: 'slide' as const }
          : p.kind === 'logo'
            ? { kind: 'logo' as const }
            : {};
  // A slide is landscape in a slide size, whatever was stored.
  if (kindFields.kind === 'slide') {
    const size = isPageSizeId(p.size) && SLIDE_PAGE_SIZE_IDS.includes(p.size) ? p.size : 'slide';
    return {
      id: p.id,
      orientation: 'landscape',
      size,
      ...(background ? { background } : {}),
      ...(name ? { name } : {}),
      kind: 'slide',
      ...lock,
    };
  }
  // A logo page is the artboard, never patterned (docs/specs/007-editor/logo-pages.md).
  if (kindFields.kind === 'logo') {
    const fill = background?.fill;
    return {
      id: p.id,
      orientation: 'portrait',
      size: 'logo',
      ...(fill ? { background: { fill } } : {}),
      ...(name ? { name } : {}),
      kind: 'logo',
      ...lock,
    };
  }
  // The artboard is the logo kind's alone: any other page stored in it is read as A4.
  const ownSize = isPageSizeId(p.size) && p.size !== 'a4' && !PAGE_SIZES[p.size].logoOnly;
  return {
    id: p.id,
    orientation: p.orientation,
    ...(ownSize ? { size: p.size as PageSizeId } : {}),
    ...(background ? { background } : {}),
    ...(name ? { name } : {}),
    ...kindFields,
    ...lock,
  };
}

/** The page's kind: an article, a slide or a logo page, or else an infographic page. */
export function pageKindOf(page: Pick<IllustratePage, 'kind'>): PageKind {
  return page.kind === 'article' || page.kind === 'slide' || page.kind === 'logo'
    ? page.kind
    : 'infographic';
}

/** A new logo page (docs/specs/007-editor/logo-pages.md "A logo page"): the 1024 artboard on
 *  plain paper. */
export function newLogoPage(id: string): IllustratePage {
  return { id, orientation: 'portrait', size: 'logo', kind: 'logo' };
}

/** A new slide page (docs/specs/007-editor/illustrate-pages.md "Page kinds"): landscape, in the
 *  given slide size (16:9 by default). */
export function newSlidePage(id: string, size: PageSizeId = 'slide'): IllustratePage {
  return {
    id,
    orientation: 'landscape',
    size: SLIDE_PAGE_SIZE_IDS.includes(size) ? size : 'slide',
    kind: 'slide',
  };
}

export function isArticlePage(
  page: Pick<IllustratePage, 'kind'>,
): page is Pick<IllustratePage, 'kind'> & { kind: 'article'; flow: string } {
  return page.kind === 'article';
}

/** Pages in an order where each document's pages sit together (docs/specs/007-editor/
 *  illustrate-pages.md "A page"): a flow's pages join its first page's run, in their order, and
 *  take its size, orientation and background. Same array back when nothing needed doing. */
function withArticlesTogether(pages: IllustratePage[]): IllustratePage[] {
  const byFlow = new Map<string, IllustratePage[]>();
  for (const p of pages) {
    if (!p.flow) continue;
    const run = byFlow.get(p.flow);
    if (run) run.push(p);
    else byFlow.set(p.flow, [p]);
  }
  if (byFlow.size === 0) return pages;
  const out: IllustratePage[] = [];
  let changed = false;
  for (const p of pages) {
    if (!p.flow) {
      out.push(p);
      continue;
    }
    const run = byFlow.get(p.flow);
    if (!run) continue; // already placed with its first page
    byFlow.delete(p.flow);
    const [lead, ...rest] = run;
    out.push(lead!);
    for (const q of rest) {
      const same =
        q.orientation === lead!.orientation &&
        q.size === lead!.size &&
        JSON.stringify(q.background) === JSON.stringify(lead!.background);
      if (!same) changed = true;
      const { size: _s, background: _b, ...own } = q;
      void _s;
      void _b;
      out.push(
        same
          ? q
          : {
              ...own,
              orientation: lead!.orientation,
              ...(lead!.size ? { size: lead!.size } : {}),
              ...(lead!.background ? { background: lead!.background } : {}),
            },
      );
    }
  }
  if (!changed && out.every((p, i) => p === pages[i])) return pages;
  return out;
}

/** The tab's pages, in order: its stored ones, or one page in its legacy orientation (portrait
 *  unless it said landscape). Never empty; malformed entries, and a repeat of an id already seen,
 *  are skipped. */
export function illustratePagesOf(
  tab: { pages?: unknown; pageOrientation?: unknown } | undefined,
): IllustratePage[] {
  const seen = new Set<string>();
  const stored = Array.isArray(tab?.pages)
    ? tab.pages.map(parsePage).filter((p): p is IllustratePage => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
    : [];
  if (stored.length > 0) return withArticlesTogether(stored.slice(0, MAX_ILLUSTRATE_PAGES));
  const orientation = isPageOrientation(tab?.pageOrientation) ? tab.pageOrientation : 'portrait';
  return [{ id: FIRST_PAGE_ID, orientation }];
}

/** A page's width and height in canvas px: its size's sides, the long one upright in portrait.
 *  A square page is the same either way; a slide size is always landscape. */
export function pageDimensions(page: Pick<IllustratePage, 'orientation' | 'size'>): {
  width: number;
  height: number;
} {
  const { short, long, landscapeOnly } = PAGE_SIZES[page.size ?? 'a4'];
  return page.orientation === 'portrait' && !landscapeOnly
    ? { width: short, height: long }
    : { width: long, height: short };
}

/** Whether a page has an orientation to choose (a square page has none, nor a slide size). */
export function pageHasOrientation(page: Pick<IllustratePage, 'size'>): boolean {
  const { short, long, landscapeOnly } = PAGE_SIZES[page.size ?? 'a4'];
  return short !== long && !landscapeOnly;
}

/** The size's name as this page shows it ("A4", "Slide (16:9)"). */
export function pageSizeLabel(page: Pick<IllustratePage, 'orientation' | 'size'>): string {
  const size = PAGE_SIZES[page.size ?? 'a4'];
  return size[size.landscapeOnly ? 'landscape' : page.orientation];
}

/** The label above a page: its name, or "Page n" once there are several, then its size, where it
 *  has one its orientation, and its kind ("Page 2 · A4 · Landscape · Infographic",
 *  "Launch · Square · Article"). */
export function pageLabel(
  page: Pick<IllustratePage, 'orientation' | 'size' | 'name' | 'kind'>,
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
  parts.push(PAGE_KIND_LABEL[pageKindOf(page)]);
  return parts.join(' · ');
}

const PAGE_KIND_LABEL: Record<PageKind, string> = {
  infographic: 'Infographic',
  article: 'Article',
  slide: 'Slide',
  logo: 'Logo',
};

/** The page's own margin, in canvas px: what layouts keep clear and snapping offers. */
export function pageMargin(page: Pick<IllustratePage, 'orientation' | 'size'>): number {
  const { width, height } = pageDimensions(page);
  const fraction = page.size === 'logo' ? LOGO_SAFE_FRACTION : PAGE_MARGIN_FRACTION;
  return Math.round(Math.min(width, height) * fraction);
}

// A page's margin as a share of its short side (docs/specs/007-editor/illustrate-pages.md).
export const PAGE_MARGIN_FRACTION = 0.07;

/** Where each page sits: the first centred on the origin, each further one a gap to the right,
 *  every page centred on the row's horizontal axis (y = 0). */
export function layOutIllustratePages(pages: readonly IllustratePage[]): LaidOutPage[] {
  let x = 0;
  return pages.map((page, index) => {
    const { width, height } = pageDimensions(page);
    if (index === 0) x = -width / 2;
    const rect = { x, y: -height / 2, width, height };
    x += width + ILLUSTRATE_PAGE_GAP;
    return { ...page, index, rect };
  });
}

/** The box the view fits to frame a page (the first by default): the page itself, so it fills the
 *  screen whatever its shape (a landscape slide on a wide screen too). With no page, a square of
 *  an A4 long side at the origin. */
export function illustratePageFitBox(page?: Pick<LaidOutPage, 'rect'>): PageRect {
  if (!page) {
    return {
      x: -A4_LONG_SIDE / 2,
      y: -A4_LONG_SIDE / 2,
      width: A4_LONG_SIDE,
      height: A4_LONG_SIDE,
    };
  }
  return page.rect;
}

function contains(r: PageRect, p: { x: number; y: number }): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** The page a canvas point lies on (edges included), if any. */
export function illustratePageAt(
  pages: readonly LaidOutPage[],
  point: { x: number; y: number },
): LaidOutPage | undefined {
  return pages.find((p) => contains(p.rect, point));
}

/** A new page's id: never one a page has had before, so a page slide (Slide.pageId) of a deleted
 *  page stays empty rather than finding a new page under its old id. Random, checked against the
 *  tab's pages. */
export function nextIllustratePageId(pages: readonly IllustratePage[]): string {
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
export function withIllustratePages<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  next: readonly IllustratePage[],
): T & { pages: IllustratePage[] } {
  const before = layOutIllustratePages(illustratePagesOf(tab));
  const after = new Map(layOutIllustratePages(next).map((p) => [p.id, p.rect]));
  const shift = (point: { x: number; y: number }): { dx: number; dy: number } | null => {
    const page = illustratePageAt(before, point);
    const moved = page && after.get(page.id);
    if (!page || !moved) return null;
    // An article page's content keeps its place from the page's top-left corner, where its
    // writing starts and its zones are measured from (docs/specs/007-editor/article-pages.md
    // "Zones"); an infographic page's is re-centred on the page's centre, so a page that turned
    // keeps its content about its middle.
    const doc = page.kind === 'article';
    const dx = doc
      ? moved.x - page.rect.x
      : moved.x + moved.width / 2 - (page.rect.x + page.rect.width / 2);
    const dy = doc
      ? moved.y - page.rect.y
      : moved.y + moved.height / 2 - (page.rect.y + page.rect.height / 2);
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
