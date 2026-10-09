// Articles as runs of pages (docs/specs/007-editor/article-pages.md "An article",
// docs/specs/007-editor/illustrate-pages.md "Page actions"): the row read as units (an
// infographic page, or a whole article), and the pure tab edits that act on a whole article:
// add, duplicate, remove, move, and grow or shrink to the pages its writing reaches.
import {
  articlesOf,
  newArticleFlow,
  normaliseRuns,
  withFreshArticleBlockIds,
  type ArticleBlock,
  type ArticleFlow,
} from './article-flow';
import { duplicateElements } from './duplicate';
import {
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  nextIllustratePageId,
  PAGE_NAME_MAX,
  newLogoPage,
  newSlidePage,
  pageSizesFor,
  withIllustratePages,
  type IllustratePage,
  type PageKind,
} from './illustrate-page';
import { elementIdsOnPage, withPageContentReplaced } from './illustrate-page-content';
import type { Tab } from './index';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
};

/** One thing in the row that moves as one: an infographic page, or every page of an article. */
export type PageUnit = { pageIds: string[]; flow?: string };

/** The row as units, in order (an article's pages sit together: illustratePagesOf). */
export function pageUnits(pages: readonly IllustratePage[]): PageUnit[] {
  const units: PageUnit[] = [];
  for (const p of pages) {
    const last = units[units.length - 1];
    if (p.flow && last?.flow === p.flow) last.pageIds.push(p.id);
    else units.push(p.flow ? { pageIds: [p.id], flow: p.flow } : { pageIds: [p.id] });
  }
  return units;
}

/** An article's pages, laid out, in order. */
export function articlePages<P extends IllustratePage>(pages: readonly P[], flow: string): P[] {
  return pages.filter((p) => p.flow === flow);
}

const withArticleMap = <T extends object>(
  tab: T,
  articles: Record<string, ArticleFlow>,
): T & { articles?: Record<string, ArticleFlow> } => {
  if (Object.keys(articles).length > 0) return { ...tab, articles };
  const { articles: _drop, ...rest } = tab as T & { articles?: unknown };
  void _drop;
  return rest as T;
};

/** The tab with one article's writing replaced. */
export function withArticleFlow<T extends PagesTab>(tab: T, flow: string, doc: ArticleFlow): T {
  return {
    ...tab,
    articles: { ...(tab.articles as Record<string, ArticleFlow> | undefined), [flow]: doc },
  };
}

/** A new article of one page after the last page (or after `afterPageId`'s unit), its writing
 *  a new Title and paragraph. Null at the page limit. */
export function withArticleAdded<T extends PagesTab>(
  tab: T,
  page: Omit<IllustratePage, 'kind' | 'flow'>,
  flow: string,
): (T & { pages: IllustratePage[] }) | null {
  const pages = illustratePagesOf(tab);
  if (pages.length >= MAX_ILLUSTRATE_PAGES || pages.some((p) => p.id === page.id)) return null;
  const next: IllustratePage[] = [...pages, { ...page, kind: 'article', flow }];
  return withArticleFlow(withIllustratePages(tab, next), flow, newArticleFlow());
}

/** The tab without an article: its pages, everything on them (arrows pinned to it too) and its
 *  writing. The units after it close the gap. Null when it is the only unit, or not there. */
export function withArticleRemoved<T extends PagesTab>(tab: T, flow: string): T | null {
  const pages = illustratePagesOf(tab);
  const gone = pages.filter((p) => p.flow === flow);
  if (gone.length === 0 || gone.length === pages.length) return null;
  let emptied: T = tab;
  for (const p of gone) emptied = withPageContentReplaced(emptied, p.id, []);
  const repaged = withIllustratePages(
    emptied,
    pages.filter((p) => p.flow !== flow),
  );
  const { [flow]: _drop, ...articles } = articlesOf(tab);
  void _drop;
  return withArticleMap(repaged, articles);
}

/** The row with a page's unit moved to `toUnit` (its place among the units, 0 first), every
 *  page's content moving with it. Null when nothing moves. */
export function withUnitMoved<T extends PagesTab>(
  tab: T,
  pageId: string,
  toUnit: number,
): (T & { pages: IllustratePage[] }) | null {
  const pages = illustratePagesOf(tab);
  const units = pageUnits(pages);
  const from = units.findIndex((u) => u.pageIds.includes(pageId));
  if (from < 0) return null;
  const to = Math.max(0, Math.min(toUnit, units.length - 1));
  if (to === from) return null;
  const [moved] = units.splice(from, 1);
  units.splice(to, 0, moved!);
  const byId = new Map(pages.map((p) => [p.id, p]));
  return withIllustratePages(
    tab,
    units.flatMap((u) => u.pageIds.map((id) => byId.get(id)!)),
  );
}

/** Zones' positions point at their page by id: a copied article's zones at the copied pages. */
function withZonePagesMapped(flow: ArticleFlow, pageMap: ReadonlyMap<string, string>): ArticleFlow {
  const blocks = flow.blocks.map((b): ArticleBlock => {
    if (b.type !== 'zone' || !b.at) return b;
    const page = pageMap.get(b.at.page);
    return page ? { ...b, at: { ...b.at, page } } : b;
  });
  return flow.style ? { blocks, style: flow.style } : { blocks };
}

/** A copy of an article right after it: a new flow holding a copy of its writing (fresh block
 *  ids), a copy of each of its pages (a name with "copy"), and a copy of everything on them (new
 *  ids; arrows between copied elements stay between the copies). Null at the page limit. */
export function withArticleDuplicated<T extends PagesTab>(
  tab: T,
  flow: string,
  newFlow: string,
): (T & { pages: IllustratePage[] }) | null {
  const pages = illustratePagesOf(tab);
  const source = pages.filter((p) => p.flow === flow);
  if (source.length === 0 || pages.length + source.length > MAX_ILLUSTRATE_PAGES) return null;
  const taken = [...pages];
  const pageMap = new Map<string, string>();
  const copies = source.map((p): IllustratePage => {
    const id = nextIllustratePageId(taken);
    taken.push({ id, orientation: p.orientation });
    pageMap.set(p.id, id);
    return {
      ...p,
      id,
      flow: newFlow,
      locked: undefined,
      ...(p.name ? { name: `${p.name} copy`.slice(0, PAGE_NAME_MAX) } : {}),
    };
  });
  const lastAt = pages.findIndex((p) => p.id === source[source.length - 1]!.id);
  const next = [...pages.slice(0, lastAt + 1), ...copies, ...pages.slice(lastAt + 1)];
  const before = layOutIllustratePages(pages);
  const moved = withIllustratePages(tab, next);
  const after = layOutIllustratePages(next);
  // Every element on the article's pages, shifted from its page to that page's copy (all pages of
  // an article are one size, so one shift does for all of them).
  const onArticle = new Set<string>();
  for (const p of source)
    for (const id of elementIdsOnPage(tab.elements, before, p.id)) onArticle.add(id);
  const from = before.find((p) => p.id === source[0]!.id)!.rect;
  const to = after.find((p) => p.id === copies[0]!.id)!.rect;
  const copied = new Set(onArticle);
  let dropped = true;
  while (dropped) {
    dropped = false;
    for (const el of tab.elements) {
      if (!copied.has(el.id) || el.type !== 'arrow') continue;
      const tied = [el.from, el.to].some(
        (ep) =>
          (ep.kind === 'pinned' && !onArticle.has(ep.elementId)) ||
          (ep.kind === 'on-arrow' && !copied.has(ep.arrowId)),
      );
      if (tied) {
        copied.delete(el.id);
        dropped = true;
      }
    }
  }
  const { newElements, idMap } = duplicateElements(
    tab.elements,
    copied,
    to.x - from.x,
    to.y - from.y,
  );
  const doc = articlesOf(tab)[flow] ?? newArticleFlow();
  return withArticleFlow(
    { ...moved, elements: [...moved.elements, ...newElements] },
    newFlow,
    withNotesRelinked(withZonePagesMapped(withFreshArticleBlockIds(doc), pageMap), idMap),
  );
}

/**
 * An article grown or shrunk to `count` pages (docs/specs/007-editor/article-pages.md "Flowing
 * onto pages"): pages added after its last (like it: size, orientation, background), or trailing
 * pages with nothing on them removed. A page with elements on it stays. Never under one page,
 * never past the page limit. The same tab back when nothing changes.
 */
export function withArticlePageCount<T extends PagesTab>(tab: T, flow: string, count: number): T {
  const pages = illustratePagesOf(tab);
  const own = pages.filter((p) => p.flow === flow);
  if (own.length === 0) return tab;
  const want = Math.max(1, Math.min(count, own.length + (MAX_ILLUSTRATE_PAGES - pages.length)));
  if (want === own.length) return tab;
  if (want > own.length) {
    const last = own[own.length - 1]!;
    const taken = [...pages];
    const added: IllustratePage[] = [];
    for (let i = own.length; i < want; i++) {
      const id = nextIllustratePageId(taken);
      const page: IllustratePage = {
        id,
        orientation: last.orientation,
        ...(last.size ? { size: last.size } : {}),
        ...(last.background ? { background: last.background } : {}),
        kind: 'article',
        flow,
      };
      taken.push(page);
      added.push(page);
    }
    const lastAt = pages.findIndex((p) => p.id === last.id);
    return withIllustratePages(tab, [
      ...pages.slice(0, lastAt + 1),
      ...added,
      ...pages.slice(lastAt + 1),
    ]) as T;
  }
  const laid = layOutIllustratePages(pages);
  const drop = new Set<string>();
  for (let i = own.length - 1; i >= want; i--) {
    if (elementIdsOnPage(tab.elements, laid, own[i]!.id).size > 0) break;
    drop.add(own[i]!.id);
  }
  if (drop.size === 0) return tab;
  return withIllustratePages(
    tab,
    pages.filter((p) => !drop.has(p.id)),
  ) as T;
}

/** Whether a page still offers the choice of its kind (docs/specs/007-editor/illustrate-pages.md
 *  "Page kinds"): the tab's only page, never chosen, with nothing on it. */
export function offersPageKindChoice(
  pages: readonly IllustratePage[],
  pageId: string,
  contentCount: number,
): boolean {
  return pages.length === 1 && pages[0]!.id === pageId && !pages[0]!.kind && contentCount === 0;
}

/** The tab with its first page's kind chosen: an infographic page (kept, now chosen), an article
 *  (the page becomes its first page, its writing a new Title and paragraph),, a slide (the page
 *  turned into a 16:9 landscape slide) or a logo page (the 1024 artboard). Null when the page no
 *  longer offers the choice. */
export function withPageKindChosen<T extends PagesTab>(
  tab: T,
  pageId: string,
  kind: PageKind,
  flow: string,
): (T & { pages: IllustratePage[] }) | null {
  const pages = illustratePagesOf(tab);
  const page = pages.find((p) => p.id === pageId);
  if (!page || pages.length !== 1 || page.kind) return null;
  if (kind === 'infographic') return withIllustratePages(tab, [{ ...page, kind: 'infographic' }]);
  if (kind === 'slide') {
    const { name } = page;
    return withIllustratePages(tab, [
      {
        ...newSlidePage(page.id),
        ...(page.background ? { background: page.background } : {}),
        ...(name ? { name } : {}),
      },
    ]);
  }
  if (kind === 'logo') {
    // The artboard keeps the page's name and fill; a logo page takes no pattern.
    const { name } = page;
    const fill = page.background?.fill;
    return withIllustratePages(tab, [
      {
        ...newLogoPage(page.id),
        ...(fill ? { background: { fill } } : {}),
        ...(name ? { name } : {}),
      },
    ]);
  }
  // An article takes only the paper and screen sizes: a page in any other (the 16:9 slide the
  // unchosen page could be set to) becomes A4.
  const { size, fit: _sides, ...rest } = page;
  void _sides;
  const keepSize = size && pageSizesFor('article').includes(size) ? { size } : {};
  return withArticleFlow(
    withIllustratePages(tab, [{ ...rest, ...keepSize, kind: 'article', flow }]),
    flow,
    newArticleFlow(),
  );
}

/** A copied article's margin notes tied to the copies of their markers (`idMap`: original
 *  element id to copy's): a note whose marker was not copied loses its mark, so the copy never
 *  points at the original article's comments. */
function withNotesRelinked(doc: ArticleFlow, idMap: ReadonlyMap<string, string>): ArticleFlow {
  const blocks = doc.blocks.map((b) => {
    if (!('runs' in b) || !b.runs.some((r) => r.note)) return b;
    const runs = b.runs.map((r) => {
      if (!r.note) return r;
      const copy = idMap.get(r.note);
      if (copy) return { ...r, note: copy };
      const { note: _n, nk: _k, ...rest } = r;
      void _n;
      void _k;
      return rest;
    });
    return { ...b, runs: normaliseRuns(runs) };
  });
  return doc.style ? { blocks, style: doc.style } : { blocks };
}
