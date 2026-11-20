// What a person has closed in the page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page
// tree"): the pages whose subpages they folded away, per knowledgebase, and whether the sidebar is collapsed to its
// rail. Kept in this browser alone: not a synced preference (those are capped at 4 KB, and page ids would fill
// it). A page with subpages is open until it is closed, so only the closed ones are stored; the most recent
// knowledgebases are kept, the oldest dropped past PAGE_TREE_KEPT.
import {
  readLocalStorageSafe,
  safeJson,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

const CLOSED_KEY = 'liveknowledge:v2:page-tree-closed';
const COLLAPSED_KEY = 'liveknowledge:v2:page-tree-collapsed';
/** How many knowledgebases' closed pages are kept. */
export const PAGE_TREE_KEPT = 50;
/** How many closed pages one knowledgebase keeps: every page it may hold. */
export const PAGE_TREE_CLOSED_MAX = 500;

type Stored = Record<string, string[]>;

function readAll(): Stored {
  const raw = readLocalStorageSafe(CLOSED_KEY);
  const parsed = raw ? safeJson(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Stored = {};
  for (const [id, ids] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(ids)) out[id] = ids.filter((v): v is string => typeof v === 'string');
  }
  return out;
}

/** The pages closed in knowledgebase `documentId`; none for one never seen here. */
export function readClosedPages(documentId: string | null): ReadonlySet<string> {
  return new Set(documentId ? readAll()[documentId] : []);
}

/** Keeps `closed` as knowledgebase `documentId`'s closed pages (moved to the most recent). */
export function writeClosedPages(documentId: string | null, closed: ReadonlySet<string>): void {
  if (!documentId) return;
  const { [documentId]: _was, ...rest } = readAll();
  void _was;
  const entries = Object.entries(rest);
  if (closed.size > 0) entries.push([documentId, [...closed].slice(0, PAGE_TREE_CLOSED_MAX)]);
  writeLocalStorageSafe(
    CLOSED_KEY,
    JSON.stringify(Object.fromEntries(entries.slice(-PAGE_TREE_KEPT))),
  );
}

/** Whether the sidebar is collapsed to its rail in this browser. */
export function readTreeCollapsed(): boolean {
  return readLocalStorageSafe(COLLAPSED_KEY) === '1';
}

export function writeTreeCollapsed(collapsed: boolean): void {
  writeLocalStorageSafe(COLLAPSED_KEY, collapsed ? '1' : '0');
}
