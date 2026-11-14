// The pages Pages mode draws on the canvas (docs/specs/007-editor/pages-mode.md "The
// pages"): sheets in a row, each its own size
// (A4 unless it says otherwise), orientation, background and name. The first is centred on the
// row anchor (the canvas origin unless a page carries one) and each further one sits a gap to the right of the one before. The pages are the
// tab's (`Tab.pages`), so everyone lays out on the same ones; the sheets themselves are a view,
// never elements. A tab from before multiple pages carries one `pageOrientation` instead, read as
// a single page.
import { cutText } from '@liveworkspace/model-core/text-cut';
import { isBoxed, type Element, type Tab } from './index';
import {
  parsePageSides,
  parseRowAt,
  type PageSides,
  type RowAt,
} from '@liveworkspace/model-core/page-fit';
import {
  parseColourFill,
  parsePagePattern,
  type PageColourFill,
  type PagePattern,
} from '@liveworkspace/page-background';
import { parsePageImageFill, type PageImageFill } from './page-image';
import {
  FLASHCARD_PAGE_SIZE_IDS,
  MAX_PAGES,
  PAPER_AND_SCREEN_SIZE_IDS,
  type PageOrientation,
  type PageSizeId,
  SLIDE_PAGE_SIZE_IDS,
  isPageSizeId,
  pageHasOrientation,
  pageSizeLabel,
} from './page-sizes';
import { layOutPages, rowPageAt } from './page-layout';

export {
  A4_LONG_SIDE,
  A4_SHORT_SIDE,
  FLASHCARD_PAGE_SIZE_IDS,
  MAX_PAGES,
  PAGE_GAP,
  PAGE_ORIENTATIONS,
  PAGE_SIZES,
  PAGE_SIZE_IDS,
  SLIDE_PAGE_SIZE_IDS,
  pageDimensions,
  pageHasOrientation,
  pageSizeLabel,
} from './page-sizes';
export type { PageOrientation, PageSizeId } from './page-sizes';
export {
  layOutPages,
  pageAt,
  pageContentBox,
  pageFitBox,
  pageMargin,
  rowAnchorOf,
  rowPageAt,
} from './page-layout';

export function pageSizesFor(kind: PageKind): readonly PageSizeId[] {
  if (kind === 'slide') return SLIDE_PAGE_SIZE_IDS;
  if (kind === 'flashcard') return FLASHCARD_PAGE_SIZE_IDS;
  return PAPER_AND_SCREEN_SIZE_IDS;
}

/** The size tiles a page's panel shows: its kind's sizes (pageSizesFor), Fit to Content first on
 *  a page already in it, and never two tiles of one shape: turned landscape, the Story (9:16) is
 *  the 16:9 Slide, so only one of the two is offered (the one the page is in, else the Slide). */
export function pageSizeChoices(
  page: Pick<Page, 'kind' | 'size' | 'orientation'>,
): readonly PageSizeId[] {
  const current = page.size ?? 'a4';
  let sizes = pageSizesFor(pageKindOf(page));
  // A page already in a size its kind no longer offers (an infographic made on the Slide size)
  // keeps that tile until it moves off it.
  if (current !== 'fit' && !sizes.includes(current)) sizes = [...sizes, current];
  if (page.orientation === 'landscape' && sizes.includes('wide') && sizes.includes('slide')) {
    const drop: PageSizeId = current === 'wide' ? 'slide' : 'wide';
    sizes = sizes.filter((id) => id !== drop);
  }
  return current === 'fit' ? ['fit', ...sizes] : sizes;
}

export {
  PAGE_MOTIONS,
  PAGE_MOTION_SPEED_MAX,
  PAGE_MOTION_SPEED_MIN,
  PAGE_PATTERNS,
  isPageMotion,
  type PageColourFill,
  type PageMotion,
  type PagePattern,
} from '@liveworkspace/page-background';
export type PageFill = PageColourFill | PageImageFill;
export type PageBackground = { fill?: PageFill; pattern?: PagePattern };

// The longest page name kept: a label, not a caption.
export const PAGE_NAME_MAX = 60;

// What a page is for, fixed when it is made (docs/specs/007-editor/pages-mode.md "Page
// kinds"): an infographic page to lay out, an article page to write on, a slide of a deck, or a
// flashcard to speak from (docs/specs/007-editor/flashcards.md).
export type PageKind = 'infographic' | 'article' | 'slide' | 'flashcard';

export type Page = {
  id: string;
  orientation: PageOrientation;
  // Absent is A4.
  size?: PageSizeId;
  // A Fit to Content page's own sides, whole canvas px; present exactly when `size` is 'fit'.
  fit?: PageSides;
  // The row anchor (docs/specs/007-editor/pages-mode.md "A page"): where the first page's
  // centre sits, whole canvas px. A property of the row, carried by one page (any one); absent on
  // every page is the canvas origin.
  rowAt?: RowAt;
  // Absent is the plain paper.
  background?: PageBackground;
  // Absent shows the page's place ("Page 2").
  name?: string;
  // Absent is an infographic page nobody has chosen yet (the first page offers the choice while
  // it is the only page and empty); 'infographic' once chosen; 'article' for an article page;
  // 'slide' for a slide, always landscape in a slide size; 'flashcard' for a card, always the card size.
  kind?: PageKind;
  // The article an article page belongs to (`Tab.articles[flow]`); present exactly on article pages
  // and flashcards (a card's own one-page writing, never shared with another card).
  flow?: string;
  // Locked (docs/specs/007-editor/pages-mode.md "Locking a page"): it and what is on it stay
  // as they are. Absent is unlocked.
  locked?: true;
};

export type PageRect = { x: number; y: number; width: number; height: number };

export type LaidOutPage = Page & { index: number; rect: PageRect };

// The id the first page of a tab that never stored its pages answers to.
const FIRST_PAGE_ID = 'page-1';

function isPageOrientation(v: unknown): v is PageOrientation {
  return v === 'portrait' || v === 'landscape';
}

function parseFill(v: unknown): PageFill | undefined {
  const f = v as Record<string, unknown> | null;
  if (f && typeof f === 'object' && f.kind === 'image') return parsePageImageFill(f);
  return parseColourFill(v);
}

function parseBackground(v: unknown): PageBackground | undefined {
  const b = v as Record<string, unknown> | null;
  if (!b || typeof b !== 'object') return undefined;
  const fill = parseFill(b.fill);
  const pattern = parsePagePattern(b.pattern);
  if (!fill && !pattern) return undefined;
  return { ...(fill ? { fill } : {}), ...(pattern ? { pattern } : {}) };
}

/** A stored page, or undefined when it has no valid id or orientation. Its optional fields keep
 *  what is valid and drop the rest. */
function parsePage(v: unknown): Page | undefined {
  const page = parsePageFields(v);
  const rowAt = page && parseRowAt((v as Record<string, unknown>).rowAt);
  return page && rowAt ? { ...page, rowAt } : page;
}

function parsePageFields(v: unknown): Page | undefined {
  const p = v as Record<string, unknown> | null;
  if (!p || typeof p !== 'object' || typeof p.id !== 'string' || !isPageOrientation(p.orientation))
    return undefined;
  const background = parseBackground(p.background);
  const name = typeof p.name === 'string' ? cutText(p.name.trim(), PAGE_NAME_MAX) : '';
  const lock = p.locked === true ? { locked: true as const } : {};
  // An article page (or a card) without a readable flow is an article of its own.
  const ownFlow =
    typeof p.flow === 'string' && p.flow.length > 0 && p.flow.length <= 64 ? p.flow : p.id;
  if (p.kind === 'flashcard') {
    // A card is always the card size, landscape.
    return {
      id: p.id,
      orientation: 'landscape',
      size: 'card',
      ...(background ? { background } : {}),
      ...(name ? { name } : {}),
      kind: 'flashcard',
      flow: ownFlow,
      ...lock,
    };
  }
  const kindFields =
    p.kind === 'article'
      ? { kind: 'article' as const, flow: ownFlow }
      : p.kind === 'infographic'
        ? { kind: 'infographic' as const }
        : p.kind === 'slide'
          ? { kind: 'slide' as const }
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
  // Fit to Content is an infographic page's, and only with its sides.
  const fit = p.size === 'fit' && kindFields.kind !== 'article' ? parsePageSides(p.fit) : undefined;
  const ownSize =
    isPageSizeId(p.size) && p.size !== 'a4' && (p.size !== 'fit' || fit !== undefined);
  return {
    id: p.id,
    orientation: p.orientation,
    ...(ownSize ? { size: p.size as PageSizeId } : {}),
    ...(ownSize && fit ? { fit } : {}),
    ...(background ? { background } : {}),
    ...(name ? { name } : {}),
    ...kindFields,
    ...lock,
  };
}

/** The page's kind: an article, slide or flashcard page, or else an infographic page. */
/** How a tab's pages stand (pages-mode.md "Stacked or side by side"): one page in front with the rest fanned behind
 *  it, or side by side. */
export type PageArrangement = 'stack' | 'row';

export function isPageArrangement(v: unknown): v is PageArrangement {
  return v === 'stack' || v === 'row';
}

/** Whether a tab's pages stand as a stack: its own choice, else its kind's (its first page's, one kind a tab):
 *  flashcards stack; infographic pages and slides stand in a row. An article never stacks: its writing runs on
 *  from page to page, so it is read along the row. */
export function tabStacksPages(
  pages: readonly Pick<Page, 'kind'>[],
  arrangement?: unknown,
): boolean {
  if (!pages[0]) return false;
  const kind = pageKindOf(pages[0]);
  if (kind === 'article') return false;
  if (isPageArrangement(arrangement)) return arrangement === 'stack';
  return kind === 'flashcard';
}

/** Whether a tab's pages may be stacked or set side by side at will: every kind but an article. */
export function tabArrangesPages(pages: readonly Pick<Page, 'kind'>[]): boolean {
  return !!pages[0] && pageKindOf(pages[0]) !== 'article';
}

export function pageKindOf(page: Pick<Page, 'kind'>): PageKind {
  return page.kind === 'article' || page.kind === 'slide' || page.kind === 'flashcard'
    ? page.kind
    : 'infographic';
}

/** The tab's kind (docs/specs/007-editor/pages-mode.md "One kind a tab"): its first page's, so a
 *  deck holds only slides; infographic for a tab with no pages. A page added is of this kind. */
export function tabPageKind(pages: readonly Pick<Page, 'kind'>[]): PageKind {
  return pages[0] ? pageKindOf(pages[0]) : 'infographic';
}

/** A new slide page (docs/specs/007-editor/pages-mode.md "Page kinds"): landscape, in the
 *  given slide size (16:9 by default). */
export function newSlidePage(id: string, size: PageSizeId = 'slide'): Page {
  return {
    id,
    orientation: 'landscape',
    size: SLIDE_PAGE_SIZE_IDS.includes(size) ? size : 'slide',
    kind: 'slide',
  };
}

/** A new flashcard (docs/specs/007-editor/flashcards.md "A card"): the card size, landscape, its
 *  writing its own (`flow`). */
export function newFlashcardPage(id: string, flow: string): Page {
  return { id, orientation: 'landscape', size: 'card', kind: 'flashcard', flow };
}

/** Whether a page is a flashcard. */
export function isFlashcardPage(page: Pick<Page, 'kind'>): boolean {
  return page.kind === 'flashcard';
}

/** A tab of flashcards (docs/specs/007-editor/flashcards.md "The stack"): its first page is one. */
export function isFlashcardStack(pages: readonly Pick<Page, 'kind'>[]): boolean {
  return tabPageKind(pages) === 'flashcard';
}

export function isArticlePage(
  page: Pick<Page, 'kind'>,
): page is Pick<Page, 'kind'> & { kind: 'article'; flow: string } {
  return page.kind === 'article';
}

/** Pages in an order where each document's pages sit together (docs/specs/007-editor/
 *  pages-mode.md "A page"): a flow's pages join its first page's run, in their order, and
 *  take its size, orientation and background. Same array back when nothing needed doing. */
function withArticlesTogether(pages: Page[]): Page[] {
  const byFlow = new Map<string, Page[]>();
  for (const p of pages) {
    if (!p.flow) continue;
    const run = byFlow.get(p.flow);
    if (run) run.push(p);
    else byFlow.set(p.flow, [p]);
  }
  if (byFlow.size === 0) return pages;
  const out: Page[] = [];
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

/** Pages where no two cards share a flow (docs/specs/007-editor/flashcards.md "A card"): a card
 *  whose flow another card already holds takes its own id as its flow. Same array back when none
 *  do. */
function withOwnCardFlows(pages: Page[]): Page[] {
  const seen = new Set<string>();
  let changed = false;
  const out = pages.map((p) => {
    if (p.kind !== 'flashcard' || !p.flow) return p;
    if (!seen.has(p.flow)) {
      seen.add(p.flow);
      return p;
    }
    changed = true;
    seen.add(p.id);
    return { ...p, flow: p.id };
  });
  return changed ? out : pages;
}

/** Pages with the row anchor on the first page found carrying it, dropped from any other. Same
 *  array back when at most one carries it. */
function withOneRowAnchor(pages: Page[]): Page[] {
  if (pages.filter((p) => p.rowAt).length <= 1) return pages;
  const first = pages.findIndex((p) => p.rowAt);
  return pages.map((p, i) => {
    if (i === first || !p.rowAt) return p;
    const { rowAt: _drop, ...rest } = p;
    void _drop;
    return rest;
  });
}

// The pages read from each stored `pages` array: a tab's pages are read on every render and every keystroke's checks
// (a lock, a page's kind), and a typing commit changes the writing, never the pages, so the array is the same.
// Frozen, array and pages, so a caller that changed what it was handed would throw rather than change it for the
// next.
const parsedPages = new WeakMap<object, readonly Page[]>();

/** The row anchor the pages carry: the first page's centre (the canvas origin when none does). */
export function pagesOf(tab: { pages?: unknown; pageOrientation?: unknown } | undefined): Page[] {
  if (Array.isArray(tab?.pages)) {
    const cached = parsedPages.get(tab.pages);
    if (cached) return cached as Page[];
  }
  const seen = new Set<string>();
  const stored = Array.isArray(tab?.pages)
    ? tab.pages.map(parsePage).filter((p): p is Page => {
        if (!p || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
    : [];
  if (stored.length > 0) {
    const pages = withArticlesTogether(
      withOwnCardFlows(withOneRowAnchor(stored.slice(0, MAX_PAGES))),
    );
    for (const p of pages) Object.freeze(p);
    parsedPages.set(tab!.pages as object, Object.freeze(pages));
    return pages;
  }
  const orientation = isPageOrientation(tab?.pageOrientation) ? tab.pageOrientation : 'portrait';
  return [{ id: FIRST_PAGE_ID, orientation }];
}

/** A page's width and height in canvas px: its size's sides, the long one upright in portrait.
 *  A square page is the same either way; a slide size is always landscape. */
export function pageLabel(
  page: Pick<Page, 'orientation' | 'size' | 'name' | 'kind'>,
  index: number,
  count: number,
): string {
  const parts: string[] = [];
  if (page.name) parts.push(page.name);
  else if (count > 1) parts.push(`Page ${index + 1}`);
  const sizeLabel = pageSizeLabel(page);
  parts.push(sizeLabel);
  const size = page.size ?? 'a4';
  // A size whose name already says which way it faces (the social and wide formats) needs no
  // orientation after it; nor does a square.
  if (pageHasOrientation(page) && (size === 'a4' || size === 'letter' || size === 'a3')) {
    parts.push(page.orientation === 'portrait' ? 'Portrait' : 'Landscape');
  }
  // The kind closes it, but for an infographic page, the plain page: its title bar keeps the room. Nor where the size
  // already names it: a slide's sizes say Slide, and "Slide (16:9) · Slide" said it twice.
  const kind = pageKindOf(page);
  const kindLabel = PAGE_KIND_LABEL[kind];
  if (kind !== 'infographic' && !sizeLabel.toLowerCase().includes(kindLabel.toLowerCase()))
    parts.push(kindLabel);
  return parts.join(' · ');
}

const PAGE_KIND_LABEL: Record<PageKind, string> = {
  infographic: 'Infographic',
  article: 'Article',
  slide: 'Slide',
  flashcard: 'Flashcard',
};

/** The page's own margin, in canvas px: what layouts keep clear and snapping offers. */
export function nextPageId(pages: readonly Page[]): string {
  const taken = new Set(pages.map((p) => p.id));
  let id: string;
  do id = `page-${crypto.randomUUID().slice(0, 8)}`;
  while (taken.has(id));
  return id;
}

/** `next` carrying the row anchor `current` carries: handed to its first page when the page that
 *  carried it is gone, so the row stays where it is. Same array back when nothing is lost. */
function withRowAnchorKept(current: readonly Page[], next: readonly Page[]): readonly Page[] {
  const at = current.find((p) => p.rowAt)?.rowAt;
  if (!at || next.length === 0 || next.some((p) => p.rowAt)) return next;
  return [{ ...next[0]!, rowAt: at }, ...next.slice(1)];
}

/**
 * The tab with its pages replaced by `next`, every element moving with its page: an element whose
 * centre lies on a page that `next` keeps moves by however far that page moved (a page before it
 * turned, or was removed). Elements on a removed page, or on no page, stay where they are. One
 * tab edit, so one undo step. The legacy `pageOrientation` is dropped once pages are stored.
 */
export function withPages<T extends Pick<Tab, 'elements'>>(
  tab: T & { pages?: unknown; pageOrientation?: unknown },
  nextPages: readonly Page[],
): T & { pages: Page[] } {
  const current = pagesOf(tab);
  const next = withRowAnchorKept(current, nextPages);
  const before = layOutPages(current);
  const after = new Map(layOutPages(next).map((p) => [p.id, p.rect]));
  // A page edit that moves no page (a name, a lock, a paint) moves no element: skip the walk.
  const still = before.every((p) => {
    const r = after.get(p.id);
    return (
      !r ||
      (r.x === p.rect.x &&
        r.y === p.rect.y &&
        r.width === p.rect.width &&
        r.height === p.rect.height)
    );
  });
  const shift = (point: { x: number; y: number }): { dx: number; dy: number } | null => {
    const page = rowPageAt(before, point);
    const moved = page && after.get(page.id);
    if (!page || !moved) return null;
    // An article page's content keeps its place from the page's top-left corner, where its
    // writing starts and its zones are measured from (docs/specs/007-editor/article-pages.md
    // "Zones"); an infographic page's is re-centred on the page's centre, so a page that turned
    // keeps its content about its middle.
    const doc = !!page.flow;
    const dx = doc
      ? moved.x - page.rect.x
      : moved.x + moved.width / 2 - (page.rect.x + page.rect.width / 2);
    const dy = doc
      ? moved.y - page.rect.y
      : moved.y + moved.height / 2 - (page.rect.y + page.rect.height / 2);
    return dx === 0 && dy === 0 ? null : { dx, dy };
  };
  const elements = still
    ? tab.elements
    : tab.elements.map((el): Element => {
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
            to && el.to.kind === 'free'
              ? { ...el.to, x: el.to.x + to.dx, y: el.to.y + to.dy }
              : el.to,
        };
      });
  const { pageOrientation: _legacy, ...rest } = tab;
  void _legacy;
  return { ...(rest as T), elements, pages: [...next] };
}
