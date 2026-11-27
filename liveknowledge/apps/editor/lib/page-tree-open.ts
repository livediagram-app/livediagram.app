// What a person has opened in the page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page
// tree"): the pages whose subpages they unfolded, per knowledgebase, and whether the sidebar is collapsed to its
// rail. The first page opens by default, so a reader sees the knowledgebase's categories (Work Tracker 1489), until
// they close it: that close is kept as `!<page id>` in the same list. Kept in this browser alone: not a synced preference (those are capped at 4 KB, and page ids would fill
// it), and never in the knowledgebase, so one reader's tree never changes another's. A page with subpages is closed
// until it is opened, so only the opened ones are stored; the most recent knowledgebases are kept, the oldest
// dropped past PAGE_TREE_KEPT. The older v2 record held closed pages (open until closed) and is not read.
import {
  isConnectedRow,
  pageParents,
  type TreePage as DocumentTreePage,
} from '@liveknowledge/document';
import {
  readLocalStorageSafe,
  safeJson,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

const OPENED_KEY = 'liveknowledge:v3:page-tree-opened';
const COLLAPSED_KEY = 'liveknowledge:v2:page-tree-collapsed';
/** How many knowledgebases' opened pages are kept. */
export const PAGE_TREE_KEPT = 50;
/** How many opened pages one knowledgebase keeps: every page it may hold. */
export const PAGE_TREE_OPENED_MAX = 500;

type Stored = Record<string, string[]>;

function readAll(): Stored {
  const raw = readLocalStorageSafe(OPENED_KEY);
  const parsed = raw ? safeJson(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Stored = {};
  for (const [id, ids] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(ids)) out[id] = ids.filter((v): v is string => typeof v === 'string');
  }
  return out;
}

/** The pages opened in knowledgebase `documentId`; none for one never seen here. */
export function readOpenedPages(documentId: string | null): ReadonlySet<string> {
  return new Set(documentId ? readAll()[documentId] : []);
}

/** Keeps `opened` as knowledgebase `documentId`'s opened pages (moved to the most recent). */
export function writeOpenedPages(documentId: string | null, opened: ReadonlySet<string>): void {
  if (!documentId) return;
  const { [documentId]: _was, ...rest } = readAll();
  void _was;
  const entries = Object.entries(rest);
  if (opened.size > 0) entries.push([documentId, [...opened].slice(0, PAGE_TREE_OPENED_MAX)]);
  writeLocalStorageSafe(
    OPENED_KEY,
    JSON.stringify(Object.fromEntries(entries.slice(-PAGE_TREE_KEPT))),
  );
}

/** The knowledgebase's first page: the first top-level page in tree order (a connected row is no page); null for none.
 *  Linear in the pages (times their depth), once a change of the list. */
export function firstPageOf(pages: readonly DocumentTreePage[]): string | null {
  const parents = pageParents(pages);
  for (const page of pages) {
    if (!isConnectedRow(page) && parents.get(page.id) === undefined) return page.id;
  }
  return null;
}

/** The stored mark of a page the reader closed that opens by default: the first page (a tab id never starts so). */
export const closedMark = (id: string): string => `!${id}`;

/**
 * What shows open: the stored `opened`, with `first` (the first top-level page) added unless the reader closed it.
 * Answers `opened` itself when nothing is added, so the tree's rows are worked out again only on a change.
 */
export function openedWithFirst(
  opened: ReadonlySet<string>,
  first: string | null,
): ReadonlySet<string> {
  if (first === null || opened.has(first) || opened.has(closedMark(first))) return opened;
  return new Set(opened).add(first);
}

/**
 * The stored set with `id` opened or closed: opening drops any closed mark, and closing the page that opens by default
 * (`first`) keeps a mark, so it stays closed for this reader. Answers `stored` itself when nothing changes.
 */
export function withPageOpen(
  stored: ReadonlySet<string>,
  id: string,
  open: boolean,
  first: string | null,
): ReadonlySet<string> {
  const mark = closedMark(id);
  const next = new Set(stored);
  if (open) {
    next.add(id);
    next.delete(mark);
  } else {
    next.delete(id);
    if (id === first) next.add(mark);
  }
  if (next.size === stored.size && [...next].every((v) => stored.has(v))) return stored;
  return next;
}

type TreePage = { id: string; parent?: string | undefined };

// The trees open on screen hear a page opened from outside them (a page just made under a closed one).
type OpenedListener = (
  documentId: string,
  pages: readonly TreePage[],
  ids: readonly string[],
) => void;
const listeners = new Set<OpenedListener>();

/** Calls `listener` whenever the pages above `ids` are opened in a knowledgebase from outside the tree. */
export function subscribeOpenedPages(listener: OpenedListener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * `opened` with every page above each of `ids` added, so each shows in the tree: a page just made as a subpage, or
 * moved under another, never lands under a closed one. Answers `opened` itself when nothing changes. Linear in the
 * pages (times the depth of the ones asked about); a cycle in a damaged list stops the climb.
 */
export function withParentsOpened(
  opened: ReadonlySet<string>,
  pages: readonly TreePage[],
  ids: Iterable<string>,
): ReadonlySet<string> {
  const parentOf = new Map<string, string | undefined>();
  for (const page of pages) parentOf.set(page.id, page.parent);
  let out: Set<string> | null = null;
  for (const id of ids) {
    const seen = new Set<string>([id]);
    for (let up = parentOf.get(id); up !== undefined && !seen.has(up); up = parentOf.get(up)) {
      seen.add(up);
      if ((out ?? opened).has(up)) continue;
      out ??= new Set(opened);
      out.add(up);
    }
  }
  return out ?? opened;
}

/**
 * Opens the pages above each of `ids` in knowledgebase `documentId`, for this reader, and tells the tree: what a person
 * makes as a subpage (Add Subpage, a page link's Create Page, an import, a structure) or moves under another page
 * shows where it went. `pages` holds the pages they sit under (the knowledgebase's, with the new ones).
 */
export function openParentsOf(
  documentId: string | null,
  pages: readonly TreePage[],
  ids: Iterable<string>,
): void {
  if (!documentId) return;
  const asked = [...ids];
  const before = readOpenedPages(documentId);
  const after = withParentsOpened(before, pages, asked);
  if (after !== before) writeOpenedPages(documentId, after);
  // The tree adds them to what it holds, so they show even where this browser keeps nothing.
  for (const listener of listeners) listener(documentId, pages, asked);
}

/** Whether the sidebar is collapsed to its rail in this browser. */
export function readTreeCollapsed(): boolean {
  return readLocalStorageSafe(COLLAPSED_KEY) === '1';
}

export function writeTreeCollapsed(collapsed: boolean): void {
  writeLocalStorageSafe(COLLAPSED_KEY, collapsed ? '1' : '0');
}
