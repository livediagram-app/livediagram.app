// What a person has opened in the page tree (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "The page
// tree"): the pages whose subpages they unfolded, per knowledgebase, and whether the sidebar is collapsed to its
// rail. Kept in this browser alone: not a synced preference (those are capped at 4 KB, and page ids would fill
// it), and never in the knowledgebase, so one reader's tree never changes another's. A page with subpages is closed
// until it is opened, so only the opened ones are stored; the most recent knowledgebases are kept, the oldest
// dropped past PAGE_TREE_KEPT. The older v2 record held closed pages (open until closed) and is not read.
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

/** Whether the sidebar is collapsed to its rail in this browser. */
export function readTreeCollapsed(): boolean {
  return readLocalStorageSafe(COLLAPSED_KEY) === '1';
}

export function writeTreeCollapsed(collapsed: boolean): void {
  writeLocalStorageSafe(COLLAPSED_KEY, collapsed ? '1' : '0');
}
