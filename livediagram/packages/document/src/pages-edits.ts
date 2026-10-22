// The edits to a Pages tab's pages, as pure tab changes (docs/specs/007-editor/pages-mode.md
// "The page panel", "Page actions", docs/specs/007-editor/article-pages.md "An article"): turn,
// resize, rename, paint and lock a page; add, duplicate, move, delete and lay one out. On an article
// page the edits that reach its look (a turn, a size, its paint) and its place (a move, a delete) act
// on every page of the article. Shared by the page panel (apps/editor page-edits) and the
// agents' page changes (docs/specs/024-agents/pages-for-agents.md), so an agent's edit is the
// panel's. Each answers the next tab (the same one when nothing changes) or why it was refused.
import {
  pageUnits,
  withArticleAdded,
  withArticleDuplicated,
  withArticleRemoved,
  withUnitMoved,
} from './article-pages';
import type { Element, Tab } from './index';
import {
  pagesOf,
  layOutPages,
  MAX_PAGES,
  newLogoPage,
  newSlidePage,
  newWireframePage,
  PAGE_NAME_MAX,
  pageHasOrientation,
  pageKindOf,
  pageSizesFor,
  withPages,
  type Page,
  type PageBackground,
  type PageKind,
  type PageOrientation,
  type PageSizeId,
} from './page';
import {
  elementIdsOnPage,
  withContentFittedToPage,
  withDuplicatedPage,
  withPageContentReplaced,
} from './page-content';
import { pagesInkFor, type InkMemory, type PageInk } from './page-ink';
import { sameFill, withBackgroundPatch } from './page-paint';
import {
  WIREFRAME_DEVICES,
  deviceHasSystemBars,
  type WireframeDeviceId,
  type WireframeFrameLook,
} from './wireframe-device';

export type PageEditRefusal =
  | 'unknown_page'
  | 'locked'
  | 'no_orientation'
  | 'size_not_offered'
  | 'pattern_not_offered'
  | 'page_limit'
  | 'last_page'
  | 'not_a_wireframe';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
};

export type PageEdit<T> = { tab: T } | { refused: PageEditRefusal };

const refused = (why: PageEditRefusal): { refused: PageEditRefusal } => ({ refused: why });

/** The pages a page-wide change reaches: the page, or every page of its article. */
export function pagesSharing(pages: readonly Page[], pageId: string): Set<string> {
  const target = pages.find((p) => p.id === pageId);
  if (!target) return new Set();
  return new Set(
    target.flow ? pages.filter((p) => p.flow === target.flow).map((p) => p.id) : [pageId],
  );
}

/** Whether a lock holds an edit of this page (docs/specs/007-editor/pages-mode.md "Locking a
 *  page"): its own lock, or, for an edit that reaches its whole article (`shared`), any lock on the
 *  article's pages. A page's own edits (its name) reach only the page itself. */
export function pageLockRefuses(pages: readonly Page[], pageId: string, shared = true): boolean {
  const target = pages.find((p) => p.id === pageId);
  if (!target) return false;
  const reach = shared && target.flow ? pages.filter((p) => p.flow === target.flow) : [target];
  return reach.some((p) => p.locked === true);
}

/** A page's lock set or cleared. Never refused by its own lock (unlocking is how one gets in). */
export function pageLockSet<T extends PagesTab>(
  tab: T,
  pageId: string,
  locked: boolean,
): PageEdit<T> {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if ((target.locked === true) === locked) return { tab };
  const next = pages.map((p) => {
    if (p.id !== pageId) return p;
    const { locked: _drop, ...rest } = p;
    return locked ? { ...rest, locked: true as const } : rest;
  });
  return { tab: withPages(tab, next) };
}

/** A page's name set (trimmed, capped at PAGE_NAME_MAX); empty clears it. */
export function pageRenamed<T extends PagesTab>(tab: T, pageId: string, raw: string): PageEdit<T> {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if (pageLockRefuses(pages, pageId, false)) return refused('locked');
  const name = raw.trim().slice(0, PAGE_NAME_MAX);
  if ((target.name ?? '') === name) return { tab };
  const next = pages.map((p) => {
    if (p.id !== pageId) return p;
    const { name: _drop, ...rest } = p;
    return name ? { ...rest, name } : rest;
  });
  return { tab: withPages(tab, next) };
}

// A turn or a new size re-fits an infographic page's content into the page as it now is
// (withContentFittedToPage); an article's pages all change together and its writing reflows, so
// nothing is fitted.
function reshaped<T extends PagesTab>(tab: T, pageId: string, patch: (p: Page) => Page): T {
  const pages = pagesOf(tab);
  const reach = pagesSharing(pages, pageId);
  const next = pages.map((p) => (reach.has(p.id) ? patch(p) : p));
  if (pages.find((p) => p.id === pageId)?.flow) return withPages(tab, next);
  const ids = elementIdsOnPage(tab.elements, layOutPages(pages), pageId);
  return withContentFittedToPage(withPages(tab, next), ids, pageId);
}

/** A page turned. A page in a slide size, or the logo artboard, has no turn. */
export function pageTurned<T extends PagesTab>(
  tab: T,
  pageId: string,
  orientation: PageOrientation,
): PageEdit<T> {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if (pageLockRefuses(pages, pageId)) return refused('locked');
  if (target.orientation === orientation) return { tab };
  if (!pageHasOrientation(target)) return refused('no_orientation');
  return { tab: reshaped(tab, pageId, (p) => ({ ...p, orientation })) };
}

/** A page resized to a size its kind offers (pageSizesFor). Fit to Content is never chosen: its
 *  sides come from content. */
export function pageResized<T extends PagesTab>(
  tab: T,
  pageId: string,
  size: PageSizeId,
): PageEdit<T> {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if (pageLockRefuses(pages, pageId)) return refused('locked');
  if ((target.size ?? 'a4') === size) return { tab };
  if (size === 'fit' || !pageSizesFor(pageKindOf(target)).includes(size))
    return refused('size_not_offered');
  return {
    tab: reshaped(tab, pageId, (p) => {
      // Leaving Fit to Content leaves its sides behind with it.
      const { size: _drop, fit: _sides, ...rest } = p;
      return size === 'a4' ? rest : { ...rest, size };
    }),
  };
}

/** A page's background patched; on an article, every page of it. A new fill re-inks what is on
 *  the page so it still reads (pageInkFor, docs/specs/007-editor/pages-mode.md "Re-inking"),
 *  judged from the author's own colours where `memory` recalls them; `memory` comes back as it is
 *  after (the caller keeps it). A logo page takes no pattern. */
export function pageBackgroundSet<T extends PagesTab>(
  tab: T,
  pageId: string,
  patch: Partial<PageBackground>,
  memory?: InkMemory,
): PageEdit<T> & { memory?: InkMemory } {
  const stored = pageBackgroundStored(tab, pageId, patch);
  if ('refused' in stored) return stored;
  if (stored.inks.length === 0) return { tab: stored.tab };
  return pagesInkFor(stored.tab, stored.inks, memory);
}

/** pageBackgroundSet's page half: the background written onto the page (and its article), and
 *  the pages a new fill must re-ink, left for the caller to ink (pagesInkFor) so a spread over
 *  many pages inks them in one walk. No inks when nothing changed or the fill was left alone. */
export function pageBackgroundStored<T extends PagesTab>(
  tab: T,
  pageId: string,
  patch: Partial<PageBackground>,
): { tab: T; inks: PageInk[] } | { refused: PageEditRefusal } {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if (pageLockRefuses(pages, pageId)) return refused('locked');
  if (target.kind === 'logo' && 'pattern' in patch) return refused('pattern_not_offered');
  const was = target.background;
  const background = withBackgroundPatch(target, patch);
  if (sameFill(was?.fill, background?.fill) && was?.pattern === background?.pattern) {
    return { tab, inks: [] };
  }
  const reach = pagesSharing(pages, pageId);
  const next = pages.map((p) => {
    if (!reach.has(p.id)) return p;
    const { background: _drop, ...rest } = p;
    return background ? { ...rest, background } : rest;
  });
  const out = withPages(tab, next) as T;
  if (!('fill' in patch)) return { tab: out, inks: [] };
  return { tab: out, inks: [...reach].map((id) => ({ pageId: id, background })) };
}

/** Whether another page of this kind fits (an article's copy is all its pages). */
const room = (pages: readonly Page[], more = 1) => pages.length + more <= MAX_PAGES;

/**
 * A new page of a kind after the last: an infographic page takes the last infographic page's size
 * and orientation (else A4 portrait; A4 after a Fit to Content page); an article the last page's
 * paper size and orientation when it is a paper size, else A4 portrait, its writing a new Title and
 * paragraph (`flow` its id); a slide the last slide's size (else 16:9), landscape; a logo page the
 * 1024 artboard. All on the plain paper.
 */
export function pageAdded<T extends PagesTab>(
  tab: T,
  kind: PageKind,
  id: string,
  flow: string,
  // A wireframe page's device, chosen as it was added; absent takes the last wireframe page's.
  device?: WireframeDeviceId,
): PageEdit<T> {
  const pages = pagesOf(tab);
  if (!room(pages) || pages.some((p) => p.id === id)) return refused('page_limit');
  // The new page wears the background of the page before it (the last), whatever either kind; a
  // logo page takes its fill alone, since it takes no pattern.
  const carried = carriedBackground(pages[pages.length - 1]?.background, kind);
  if (kind === 'article') {
    const last = pages[pages.length - 1];
    const paper = last && ['a4', 'letter', 'a3'].includes(last.size ?? 'a4');
    const out = withArticleAdded(
      tab,
      {
        id,
        orientation: paper ? last.orientation : 'portrait',
        ...(paper && last.size ? { size: last.size } : {}),
        ...(carried ? { background: carried } : {}),
      },
      flow,
    );
    return { tab: out as T };
  }
  let page: Page;
  if (kind === 'slide') {
    const lastSlide = [...pages].reverse().find((p) => p.kind === 'slide');
    page = newSlidePage(id, lastSlide?.size);
  } else if (kind === 'logo') {
    page = newLogoPage(id);
  } else if (kind === 'wireframe') {
    // The last wireframe page's device and frame (docs/specs/007-editor/wireframe-pages.md
    // "Choosing the device"), its device unless one was just chosen.
    const lastWireframe = [...pages].reverse().find((p) => p.kind === 'wireframe');
    page = newWireframePage(id, device ?? lastWireframe?.device, lastWireframe?.frameLook);
  } else {
    const model = [...pages]
      .reverse()
      .find((p) => !p.flow && p.kind !== 'slide' && p.kind !== 'logo' && p.kind !== 'wireframe');
    const size = model?.size === 'fit' ? undefined : model?.size;
    page = { id, orientation: model?.orientation ?? 'portrait', ...(size ? { size } : {}) };
  }
  if (carried) page = { ...page, background: carried };
  return { tab: withPages(tab, [...pages, page]) };
}

/**
 * A new page like `sourceId` after the last (docs/specs/007-editor/pages-mode.md "Adding a page"):
 * its kind and shape, a wireframe page's device, frame look, orientation and system bars too,
 * carrying the last page's background as any new page does; never its content. An article page
 * starts a new article on the same paper.
 */
export function pageAddedLike<T extends PagesTab>(
  tab: T,
  sourceId: string,
  id: string,
  flow: string,
): PageEdit<T> {
  const pages = pagesOf(tab);
  const source = pages.find((p) => p.id === sourceId);
  if (!source) return refused('unknown_page');
  if (source.kind !== 'wireframe') {
    const kind = pageKindOf(source);
    if (kind !== 'infographic' || source.size === 'fit') return pageAdded(tab, kind, id, flow);
    // An infographic page in the source's own size and turn (pageAdded takes the last infographic's).
    const out = pageAdded(tab, kind, id, flow);
    if (!('tab' in out)) return out;
    const next = pagesOf(out.tab).map((p) => {
      if (p.id !== id) return p;
      const { size: _size, ...rest } = p;
      return {
        ...rest,
        orientation: source.orientation,
        ...(source.size && source.size !== 'a4' ? { size: source.size } : {}),
      };
    });
    return { tab: withPages(out.tab, next) };
  }
  if (!room(pages) || pages.some((p) => p.id === id)) return refused('page_limit');
  const carried = carriedBackground(pages[pages.length - 1]?.background, 'wireframe');
  const page: Page = {
    ...newWireframePage(id, source.device, source.frameLook),
    orientation: source.orientation,
    ...(source.systemBars === false ? { systemBars: false as const } : {}),
    ...(carried ? { background: carried } : {}),
  };
  return { tab: withPages(tab, [...pages, page]) };
}

// The background a new page of `kind` carries over from the page before it: none for the paper,
// and no pattern on a logo page.
function carriedBackground(
  background: PageBackground | undefined,
  kind: PageKind,
): PageBackground | undefined {
  if (!background) return undefined;
  const { fill, pattern } = background;
  const out: PageBackground = {
    ...(fill ? { fill } : {}),
    ...(pattern && kind !== 'logo' ? { pattern } : {}),
  };
  return out.fill || out.pattern ? out : undefined;
}

export type WireframeDevicePatch = {
  frameLook?: WireframeFrameLook;
  systemBars?: boolean;
  orientation?: PageOrientation;
};

/**
 * A wireframe page's orientation, frame look or system bars changed (docs/specs/007-editor/
 * wireframe-pages.md "Choosing the device"); its device is its own for good, chosen as it was added.
 * A turn or new system bars re-fit the content into the new safe area, as a new size does. Refused
 * on any other kind of page.
 */
export function pageDeviceSet<T extends PagesTab>(
  tab: T,
  pageId: string,
  patch: WireframeDevicePatch,
): PageEdit<T> {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if (pageLockRefuses(pages, pageId)) return refused('locked');
  if (target.kind !== 'wireframe') return refused('not_a_wireframe');
  const device = target.device ?? 'iphone';
  const look = patch.frameLook ?? target.frameLook ?? 'theme';
  const bars = patch.systemBars === undefined ? target.systemBars !== false : patch.systemBars;
  const orientation = WIREFRAME_DEVICES[device].turns
    ? (patch.orientation ?? target.orientation)
    : 'portrait';
  const same =
    look === (target.frameLook ?? 'theme') &&
    bars === (target.systemBars !== false) &&
    orientation === target.orientation;
  if (same) return { tab };
  const apply = (p: Page): Page => {
    const { frameLook: _l, systemBars: _b, ...rest } = p;
    return {
      ...rest,
      orientation,
      device,
      ...(look !== 'theme' ? { frameLook: look } : {}),
      // A device without bars keeps no choice about them.
      ...(!bars && deviceHasSystemBars(device) ? { systemBars: false as const } : {}),
    };
  };
  // A look alone moves nothing: no re-fit.
  const reshapes = bars !== (target.systemBars !== false) || orientation !== target.orientation;
  if (!reshapes)
    return {
      tab: withPages(
        tab,
        pages.map((p) => (p.id === pageId ? apply(p) : p)),
      ),
    };
  return { tab: reshaped(tab, pageId, apply) };
}

/** A copy after the page, content and all; an article page copies its whole article (`flow` the
 *  copy's article id). */
export function pageDuplicated<T extends PagesTab>(
  tab: T,
  pageId: string,
  id: string,
  flow: string,
): PageEdit<T> {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if (target.flow) {
    const out = withArticleDuplicated(tab, target.flow, flow);
    return out ? { tab: out } : refused('page_limit');
  }
  if (!room(pages) || pages.some((p) => p.id === id)) return refused('page_limit');
  return { tab: withDuplicatedPage(tab, pageId, id) };
}

/** A page deleted with everything on it, the pages after it closing the gap; an article page
 *  deletes its whole article, writing and all. Never the last unit. */
export function pageRemoved<T extends PagesTab>(tab: T, pageId: string): PageEdit<T> {
  const pages = pagesOf(tab);
  const target = pages.find((p) => p.id === pageId);
  if (!target) return refused('unknown_page');
  if (pageLockRefuses(pages, pageId)) return refused('locked');
  if (pageUnits(pages).length <= 1) return refused('last_page');
  if (target.flow) {
    const out = withArticleRemoved(tab, target.flow);
    return out ? { tab: out } : refused('last_page');
  }
  const emptied = withPageContentReplaced(tab, pageId, []);
  return {
    tab: withPages(
      emptied,
      pages.filter((p) => p.id !== pageId),
    ),
  };
}

/** A page's unit (the page, or its whole article) moved to a place among the units (0 first), its
 *  content with it. */
export function pageMovedTo<T extends PagesTab>(
  tab: T,
  pageId: string,
  unitIndex: number,
): PageEdit<T> {
  const pages = pagesOf(tab);
  const units = pageUnits(pages);
  const from = units.findIndex((u) => u.pageIds.includes(pageId));
  if (from < 0) return refused('unknown_page');
  const to = Math.max(0, Math.min(units.length - 1, Math.round(unitIndex)));
  if (from === to) return { tab };
  return { tab: withUnitMoved(tab, pageId, to) as T };
}

/** Everything on a page replaced by a layout's elements (built for the page by buildPageLayout). */
export function pageLaidOut<T extends PagesTab>(
  tab: T,
  pageId: string,
  placed: readonly Element[],
): PageEdit<T> {
  const pages = pagesOf(tab);
  if (!pages.some((p) => p.id === pageId)) return refused('unknown_page');
  if (pageLockRefuses(pages, pageId)) return refused('locked');
  return { tab: withPageContentReplaced(tab, pageId, [...placed]) };
}
