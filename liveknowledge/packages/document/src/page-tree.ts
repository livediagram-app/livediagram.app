// The page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page tree"): a knowledgebase's pages
// in order, each under a parent page or at the top level. A page is a tab; `Tab.parent` is the id of the page it sits
// under, absent at the top level, and siblings keep the order the tab list gives them. Everything here is pure: a
// list of tabs in, the tree or a new list out. An edit answers the whole list in tree order (every page followed by
// its subpages), so the list alone always draws the tree, or null when it is refused or changes nothing.

/** The most pages a knowledgebase holds. */
export const MAX_KNOWLEDGEBASE_PAGES = 500;
/** The most levels a page tree has: a top-level page is level 1. */
export const MAX_PAGE_DEPTH = 8;
// The longest id a stored parent may be (a tab id is a UUID; anything longer is not one).
const PARENT_ID_MAX = 128;

/** What the tree reads of a tab. `connection` marks a connected row (docs/specs/030-knowledgebase/links-and-embeds.md
 *  "Connected files in the sidebar"): another app's file placed among the pages, which is no page. */
export type TreePage = { id: string; parent?: string | undefined; connection?: unknown };

/** Whether a tree entry is a connected row rather than a page: it holds a connection (the tab's object, or `true`
 *  where only the mark is kept, as the api's stored tree keeps it). */
export const isConnectedRow = (page: TreePage): boolean =>
  page.connection === true || (typeof page.connection === 'object' && page.connection !== null);

/** How many pages a list holds: its connected rows are not counted (they never count toward the page limit). */
export function pageCount(pages: readonly TreePage[]): number {
  let n = 0;
  for (const p of pages) if (!isConnectedRow(p)) n += 1;
  return n;
}

/** A page in the tree, with its subpages in order. */
export type PageTreeNode<T extends TreePage> = { page: T; children: PageTreeNode<T>[] };

/** A page as one row of the tree drawn top to bottom: `depth` 1 at the top level. */
export type PageTreeRow<T extends TreePage> = { page: T; depth: number; subpages: number };

/** Why a tree edit is refused. */
export type PageTreeRefusal = 'page_limit' | 'depth_limit' | 'own_subtree' | 'unknown_page';

/** A stored `parent`: a non-empty id, else undefined. */
export function parseTabParent(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 && v.length <= PARENT_ID_MAX ? v : undefined;
}

/**
 * Each page's parent as the tree reads it: its stored parent when that page exists, is not itself, and does not
 * close a cycle; else none, so a page whose parent is gone surfaces at the top level and is never lost. A cycle is
 * cut at its first page in the list, which keeps the rest of it as that page's subtree. O(pages x depth).
 */
export function pageParents<T extends TreePage>(
  pages: readonly T[],
): Map<string, string | undefined> {
  // Only a page holds subpages: an entry stored under a connected row reads at the top level.
  const ids = new Set(pages.filter((p) => !isConnectedRow(p)).map((p) => p.id));
  const raw = new Map<string, string | undefined>();
  for (const p of pages) {
    const parent = parseTabParent(p.parent);
    raw.set(p.id, parent !== undefined && parent !== p.id && ids.has(parent) ? parent : undefined);
  }
  const out = new Map<string, string | undefined>();
  for (const p of pages) {
    let parent = raw.get(p.id);
    // Walk up through the parents already read (a cut one ends the walk): back at this page is a cycle.
    let at = parent;
    for (let steps = 0; at !== undefined && steps <= pages.length; steps++) {
      if (at === p.id) {
        parent = undefined;
        break;
      }
      at = out.has(at) ? out.get(at) : raw.get(at);
    }
    out.set(p.id, parent);
  }
  return out;
}

// The tree as lists of child ids, the top level under ROOT, each in tab-list order.
const ROOT = '';
type Shape = { parents: Map<string, string | undefined>; children: Map<string, string[]> };

function shapeOf<T extends TreePage>(pages: readonly T[]): Shape {
  const parents = pageParents(pages);
  const children = new Map<string, string[]>([[ROOT, []]]);
  for (const p of pages) children.set(p.id, []);
  for (const p of pages) children.get(parents.get(p.id) ?? ROOT)!.push(p.id);
  return { parents, children };
}

/** The tree: the top-level pages in order, each with its subpages. */
export function buildPageTree<T extends TreePage>(pages: readonly T[]): PageTreeNode<T>[] {
  const { children } = shapeOf(pages);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const nodes = (ids: readonly string[]): PageTreeNode<T>[] =>
    ids.map((id) => ({ page: byId.get(id)!, children: nodes(children.get(id)!) }));
  return nodes(children.get(ROOT)!);
}

/** The tree as rows, top to bottom: each page, then its subpages. `subpages` counts every page under it. */
export function pageTreeRows<T extends TreePage>(pages: readonly T[]): PageTreeRow<T>[] {
  const rows: PageTreeRow<T>[] = [];
  const walk = (nodes: readonly PageTreeNode<T>[], depth: number): number => {
    let count = 0;
    for (const node of nodes) {
      const row: PageTreeRow<T> = { page: node.page, depth, subpages: 0 };
      rows.push(row);
      row.subpages = walk(node.children, depth + 1);
      count += 1 + row.subpages;
    }
    return count;
  };
  walk(buildPageTree(pages), 1);
  return rows;
}

/** A page's ancestors, the top-level one first; none for a top-level page or a page not there. */
export function pageAncestors<T extends TreePage>(pages: readonly T[], id: string): T[] {
  const parents = pageParents(pages);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out: T[] = [];
  for (let at = parents.get(id); at !== undefined; at = parents.get(at)) out.unshift(byId.get(at)!);
  return out;
}

/** A page's level: 1 at the top; 0 for a page not there. */
export function pageDepth<T extends TreePage>(pages: readonly T[], id: string): number {
  return pages.some((p) => p.id === id) ? pageAncestors(pages, id).length + 1 : 0;
}

/** A page and every page under it, in tree order; empty for a page not there. */
export function pageSubtreeIds<T extends TreePage>(pages: readonly T[], id: string): string[] {
  const { children } = shapeOf(pages);
  if (!children.has(id) || id === ROOT) return [];
  const out: string[] = [];
  const walk = (at: string) => {
    out.push(at);
    for (const child of children.get(at)!) walk(child);
  };
  walk(id);
  return out;
}

/** How many pages sit under a page, at every level. */
export function subpageCount<T extends TreePage>(pages: readonly T[], id: string): number {
  return Math.max(0, pageSubtreeIds(pages, id).length - 1);
}

// How many levels a page's subtree takes: 1 for a page with no subpages.
function subtreeLevels(children: Map<string, string[]>, id: string): number {
  let deepest = 0;
  for (const child of children.get(id)!)
    deepest = Math.max(deepest, subtreeLevels(children, child));
  return deepest + 1;
}

// The list in tree order from a shape, each page carrying its parent (or none).
function listOf<T extends TreePage>(pages: readonly T[], shape: Shape): T[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out: T[] = [];
  const walk = (ids: readonly string[], parent: string | undefined) => {
    for (const id of ids) {
      out.push(withParent(byId.get(id)!, parent));
      walk(shape.children.get(id)!, id);
    }
  };
  walk(shape.children.get(ROOT)!, undefined);
  return out;
}

function withParent<T extends TreePage>(page: T, parent: string | undefined): T {
  if (page.parent === parent) return page;
  if (parent !== undefined) return { ...page, parent };
  const { parent: _drop, ...rest } = page;
  void _drop;
  return rest as T;
}

const copyOf = (shape: Shape): Shape => ({
  parents: new Map(shape.parents),
  children: new Map([...shape.children].map(([id, list]) => [id, [...list]])),
});

/** The list in tree order, every page carrying the parent the tree reads for it: a parent that is gone, or one that
 *  closed a cycle, is dropped. The same list back when it is already so. */
export function withPageTreeOrder<T extends TreePage>(pages: readonly T[]): readonly T[] {
  const out = listOf(pages, shapeOf(pages));
  return out.every((p, i) => p === pages[i]) ? pages : out;
}

/** Whether a page may be added under `parent` (the top level when absent), or why not. */
export function pageAddRefusal<T extends TreePage>(
  pages: readonly T[],
  parent?: string,
): PageTreeRefusal | null {
  if (pageCount(pages) >= MAX_KNOWLEDGEBASE_PAGES) return 'page_limit';
  return placeRefusal(pages, parent);
}

// Whether anything may go under `parent` (the top level when absent): a page there, not at the deepest level.
function placeRefusal<T extends TreePage>(
  pages: readonly T[],
  parent: string | undefined,
): PageTreeRefusal | null {
  if (parent === undefined) return null;
  const at = pages.find((p) => p.id === parent);
  if (!at || isConnectedRow(at)) return 'unknown_page';
  const depth = pageDepth(pages, parent);
  return depth + 1 > MAX_PAGE_DEPTH ? 'depth_limit' : null;
}

/** The list with `page` added as the last subpage of `parent` (the last top-level page when absent). */
export function withPageAdded<T extends TreePage>(
  pages: readonly T[],
  page: T,
  parent?: string,
): T[] | { refused: PageTreeRefusal } {
  const refused = pageAddRefusal(pages, parent);
  if (refused) return { refused };
  if (pages.some((p) => p.id === page.id)) return { refused: 'unknown_page' };
  const all = [...pages, withParent(page, parent)];
  return listOf(all, shapeOf(all));
}

/** The list with a connected row added as the last entry under `parent` (the top level when absent). Never refused
 *  for the page limit: a connected row is no page (the index bounds how many a knowledgebase connects). */
export function withConnectedRowAdded<T extends TreePage>(
  pages: readonly T[],
  row: T,
  parent?: string,
): T[] | { refused: PageTreeRefusal } {
  const refused = placeRefusal(pages, parent);
  if (refused) return { refused };
  if (pages.some((p) => p.id === row.id)) return { refused: 'unknown_page' };
  const all = [...pages, withParent(row, parent)];
  return listOf(all, shapeOf(all));
}

/** Where a move puts a page: under `parent` (the top level when absent), before its subpage `before` (last when
 *  absent). */
export type PageMove = { parent?: string | undefined; before?: string | undefined };

/** Whether a page may move there with its subpages, or why not: never under itself or one of its own subpages, and
 *  never so deep that its deepest subpage passes MAX_PAGE_DEPTH. */
export function pageMoveRefusal<T extends TreePage>(
  pages: readonly T[],
  id: string,
  to: PageMove,
): PageTreeRefusal | null {
  const shape = shapeOf(pages);
  if (!shape.children.has(id) || id === ROOT) return 'unknown_page';
  if (to.parent !== undefined) {
    if (!shape.children.has(to.parent) || to.parent === ROOT) return 'unknown_page';
    if (pages.some((p) => p.id === to.parent && isConnectedRow(p))) return 'unknown_page';
    if (pageSubtreeIds(pages, id).includes(to.parent)) return 'own_subtree';
  }
  const under = to.parent === undefined ? 0 : pageDepth(pages, to.parent);
  return under + subtreeLevels(shape.children, id) > MAX_PAGE_DEPTH ? 'depth_limit' : null;
}

/** The list with a page moved, its subpages with it. Null when it is refused (pageMoveRefusal) or already there. */
export function withPageMoved<T extends TreePage>(
  pages: readonly T[],
  id: string,
  to: PageMove,
): T[] | null {
  if (pageMoveRefusal(pages, id, to)) return null;
  const shape = copyOf(shapeOf(pages));
  const from = shape.children.get(shape.parents.get(id) ?? ROOT)!;
  from.splice(from.indexOf(id), 1);
  const into = shape.children.get(to.parent ?? ROOT)!;
  const at = to.before !== undefined && to.before !== id ? into.indexOf(to.before) : -1;
  into.splice(at < 0 ? into.length : at, 0, id);
  shape.parents.set(id, to.parent);
  const out = listOf(pages, shape);
  return out.every((p, i) => p === pages[i]) ? null : out;
}

/** The list with a page moved one place up (-1) or down (1) among its siblings; null at the end of them. */
export function withPageStepped<T extends TreePage>(
  pages: readonly T[],
  id: string,
  by: -1 | 1,
): T[] | null {
  const shape = shapeOf(pages);
  if (!shape.children.has(id) || id === ROOT) return null;
  const parent = shape.parents.get(id);
  const siblings = shape.children.get(parent ?? ROOT)!;
  const at = siblings.indexOf(id);
  const next = at + by;
  if (next < 0 || next >= siblings.length) return null;
  // Up: before the sibling above. Down: before the one after the sibling below (last when there is none).
  const before = by === -1 ? siblings[next] : siblings[next + 1];
  return withPageMoved(pages, id, { parent, before });
}

/** The list with a page made the last subpage of the sibling above it; null with no sibling above, or too deep. */
export function withPageIndented<T extends TreePage>(pages: readonly T[], id: string): T[] | null {
  const shape = shapeOf(pages);
  if (!shape.children.has(id) || id === ROOT) return null;
  const siblings = shape.children.get(shape.parents.get(id) ?? ROOT)!;
  const above = siblings[siblings.indexOf(id) - 1];
  return above === undefined ? null : withPageMoved(pages, id, { parent: above });
}

/** The list with a page moved out a level, to just after the page it was under; null at the top level. */
export function withPageOutdented<T extends TreePage>(pages: readonly T[], id: string): T[] | null {
  const shape = shapeOf(pages);
  const parent = shape.parents.get(id);
  if (parent === undefined) return null;
  const grand = shape.parents.get(parent);
  const uncles = shape.children.get(grand ?? ROOT)!;
  return withPageMoved(pages, id, { parent: grand, before: uncles[uncles.indexOf(parent) + 1] });
}

/** The list without a page and its subpages; null for a page not there, or when no page would be left. */
export function withPageDeleted<T extends TreePage>(pages: readonly T[], id: string): T[] | null {
  const gone = new Set(pageSubtreeIds(pages, id));
  if (gone.size === 0) return null;
  const left = pages.filter((p) => !gone.has(p.id));
  // A knowledgebase always keeps a page: its connected rows alone are not one.
  if (pageCount(left) === 0) return null;
  return listOf(left, shapeOf(left));
}

/** Whether a list of pages is within the tree's limits: at most MAX_KNOWLEDGEBASE_PAGES, none below MAX_PAGE_DEPTH.
 *  What the room checks before it takes a change to the tree. */
export function pageTreeRefusal<T extends TreePage>(pages: readonly T[]): PageTreeRefusal | null {
  if (pageCount(pages) > MAX_KNOWLEDGEBASE_PAGES) return 'page_limit';
  const { children } = shapeOf(pages);
  let deepest = 0;
  for (const top of children.get(ROOT)!) deepest = Math.max(deepest, subtreeLevels(children, top));
  return deepest > MAX_PAGE_DEPTH ? 'depth_limit' : null;
}
