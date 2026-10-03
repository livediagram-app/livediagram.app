// Documents as runs of pages (docs/specs/007-editor/document-pages.md "A document",
// docs/specs/007-editor/illustrate-pages.md "Page actions"): the row read as units (an
// infographic page, or a whole document), and the pure tab edits that act on a whole document:
// add, duplicate, remove, move, and grow or shrink to the pages its writing reaches.
import { docsOf, newDocFlow, withFreshDocBlockIds, type DocBlock, type DocFlow } from './doc-flow';
import { duplicateElements } from './duplicate';
import {
  illustratePagesOf,
  layOutIllustratePages,
  MAX_ILLUSTRATE_PAGES,
  nextIllustratePageId,
  PAGE_NAME_MAX,
  withIllustratePages,
  type IllustratePage,
  type LaidOutPage,
} from './illustrate-page';
import { elementIdsOnPage, withPageContentReplaced } from './illustrate-page-content';
import type { Tab } from './index';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  docs?: unknown;
};

/** One thing in the row that moves as one: an infographic page, or every page of a document. */
export type PageUnit = { pageIds: string[]; flow?: string };

/** The row as units, in order (a document's pages sit together: illustratePagesOf). */
export function pageUnits(pages: readonly IllustratePage[]): PageUnit[] {
  const units: PageUnit[] = [];
  for (const p of pages) {
    const last = units[units.length - 1];
    if (p.flow && last?.flow === p.flow) last.pageIds.push(p.id);
    else units.push(p.flow ? { pageIds: [p.id], flow: p.flow } : { pageIds: [p.id] });
  }
  return units;
}

/** The unit a page belongs to, and its place among the units. */
export function unitOfPage(
  pages: readonly IllustratePage[],
  pageId: string,
): { unit: PageUnit; index: number } | undefined {
  const units = pageUnits(pages);
  const index = units.findIndex((u) => u.pageIds.includes(pageId));
  return index < 0 ? undefined : { unit: units[index]!, index };
}

/** A document's pages, laid out, in order. */
export function documentPages<P extends IllustratePage>(pages: readonly P[], flow: string): P[] {
  return pages.filter((p) => p.flow === flow);
}

const withDocs = <T extends object>(
  tab: T,
  docs: Record<string, DocFlow>,
): T & { docs?: Record<string, DocFlow> } => {
  if (Object.keys(docs).length > 0) return { ...tab, docs };
  const { docs: _drop, ...rest } = tab as T & { docs?: unknown };
  void _drop;
  return rest as T;
};

/** The tab with one document's writing replaced. */
export function withDocFlow<T extends PagesTab>(tab: T, flow: string, doc: DocFlow): T {
  return { ...tab, docs: { ...(tab.docs as Record<string, DocFlow> | undefined), [flow]: doc } };
}

/** A new document of one page after the last page (or after `afterPageId`'s unit), its writing
 *  a new Title and paragraph. Null at the page limit. */
export function withDocumentAdded<T extends PagesTab>(
  tab: T,
  page: Omit<IllustratePage, 'kind' | 'flow'>,
  flow: string,
): (T & { pages: IllustratePage[] }) | null {
  const pages = illustratePagesOf(tab);
  if (pages.length >= MAX_ILLUSTRATE_PAGES || pages.some((p) => p.id === page.id)) return null;
  const next: IllustratePage[] = [...pages, { ...page, kind: 'document', flow }];
  return withDocFlow(withIllustratePages(tab, next), flow, newDocFlow());
}

/** The tab without a document: its pages, everything on them (arrows pinned to it too) and its
 *  writing. The units after it close the gap. Null when it is the only unit, or not there. */
export function withDocumentRemoved<T extends PagesTab>(tab: T, flow: string): T | null {
  const pages = illustratePagesOf(tab);
  const gone = pages.filter((p) => p.flow === flow);
  if (gone.length === 0 || gone.length === pages.length) return null;
  let emptied: T = tab;
  for (const p of gone) emptied = withPageContentReplaced(emptied, p.id, []);
  const repaged = withIllustratePages(
    emptied,
    pages.filter((p) => p.flow !== flow),
  );
  const { [flow]: _drop, ...docs } = docsOf(tab);
  void _drop;
  return withDocs(repaged, docs);
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

/** Zones' positions point at their page by id: a copied document's zones at the copied pages. */
function withZonePagesMapped(flow: DocFlow, pageMap: ReadonlyMap<string, string>): DocFlow {
  const blocks = flow.blocks.map((b): DocBlock => {
    if (b.type !== 'zone' || !b.at) return b;
    const page = pageMap.get(b.at.page);
    return page ? { ...b, at: { ...b.at, page } } : b;
  });
  return flow.style ? { blocks, style: flow.style } : { blocks };
}

/** A copy of a document right after it: a new flow holding a copy of its writing (fresh block
 *  ids), a copy of each of its pages (a name with "copy"), and a copy of everything on them (new
 *  ids; arrows between copied elements stay between the copies). Null at the page limit. */
export function withDocumentDuplicated<T extends PagesTab>(
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
      ...(p.name ? { name: `${p.name} copy`.slice(0, PAGE_NAME_MAX) } : {}),
    };
  });
  const lastAt = pages.findIndex((p) => p.id === source[source.length - 1]!.id);
  const next = [...pages.slice(0, lastAt + 1), ...copies, ...pages.slice(lastAt + 1)];
  const before = layOutIllustratePages(pages);
  const moved = withIllustratePages(tab, next);
  const after = layOutIllustratePages(next);
  // Every element on the document's pages, shifted from its page to that page's copy (all pages of
  // a document are one size, so one shift does for all of them).
  const onDoc = new Set<string>();
  for (const p of source)
    for (const id of elementIdsOnPage(tab.elements, before, p.id)) onDoc.add(id);
  const from = before.find((p) => p.id === source[0]!.id)!.rect;
  const to = after.find((p) => p.id === copies[0]!.id)!.rect;
  const copied = new Set(onDoc);
  let dropped = true;
  while (dropped) {
    dropped = false;
    for (const el of tab.elements) {
      if (!copied.has(el.id) || el.type !== 'arrow') continue;
      const tied = [el.from, el.to].some(
        (ep) =>
          (ep.kind === 'pinned' && !onDoc.has(ep.elementId)) ||
          (ep.kind === 'on-arrow' && !copied.has(ep.arrowId)),
      );
      if (tied) {
        copied.delete(el.id);
        dropped = true;
      }
    }
  }
  const { newElements } = duplicateElements(tab.elements, copied, to.x - from.x, to.y - from.y);
  const doc = docsOf(tab)[flow] ?? newDocFlow();
  return withDocFlow(
    { ...moved, elements: [...moved.elements, ...newElements] },
    newFlow,
    withZonePagesMapped(withFreshDocBlockIds(doc), pageMap),
  );
}

/**
 * A document grown or shrunk to `count` pages (docs/specs/007-editor/document-pages.md "Flowing
 * onto pages"): pages added after its last (like it: size, orientation, background), or trailing
 * pages with nothing on them removed. A page with elements on it stays. Never under one page,
 * never past the page limit. The same tab back when nothing changes.
 */
export function withDocumentPageCount<T extends PagesTab>(tab: T, flow: string, count: number): T {
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
        kind: 'document',
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

/** The lead page of each document, laid out (its first page). */
export function documentLeads(pages: readonly LaidOutPage[]): LaidOutPage[] {
  const seen = new Set<string>();
  return pages.filter((p) => {
    if (!p.flow || seen.has(p.flow)) return false;
    seen.add(p.flow);
    return true;
  });
}
