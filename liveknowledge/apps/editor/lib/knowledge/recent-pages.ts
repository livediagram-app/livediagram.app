// The pages a person opened most recently in a knowledgebase (docs/specs/030-knowledgebase/search-and-ask.md
// "Search": while the search field is empty, This Knowledgebase lists them). Kept in this browser alone, per
// knowledgebase, the newest first, RECENT_PAGES_MAX at most; the most recent knowledgebases are kept, the oldest
// dropped past RECENT_PAGES_KEPT. Page ids only: a page's name is read from the tree when it is listed.
import {
  readLocalStorageSafe,
  safeJson,
  writeLocalStorageSafe,
} from '@liveworkspace/workbench/lib/local-storage-safe';

const KEY = 'liveknowledge:v2:recent-pages';
/** How many pages one knowledgebase lists. */
export const RECENT_PAGES_MAX = 8;
/** How many knowledgebases' recent pages are kept. */
export const RECENT_PAGES_KEPT = 50;

type Stored = Record<string, string[]>;

function readAll(): Stored {
  const raw = readLocalStorageSafe(KEY);
  const parsed = raw ? safeJson(raw) : null;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const out: Stored = {};
  for (const [id, ids] of Object.entries(parsed as Record<string, unknown>)) {
    if (Array.isArray(ids))
      out[id] = ids.filter((v): v is string => typeof v === 'string').slice(0, RECENT_PAGES_MAX);
  }
  return out;
}

/** The pages opened most recently in knowledgebase `documentId`, the newest first; none for one never seen here. */
export function readRecentPages(documentId: string | null): readonly string[] {
  return documentId ? (readAll()[documentId] ?? []) : [];
}

/** Notes page `pageId` as just opened in knowledgebase `documentId`. The same page again, already first, writes nothing. */
export function noteRecentPage(documentId: string | null, pageId: string): void {
  if (!documentId || !pageId) return;
  const all = readAll();
  const was = all[documentId] ?? [];
  if (was[0] === pageId) return;
  const { [documentId]: _was, ...rest } = all;
  void _was;
  const kept = Object.entries(rest).slice(-(RECENT_PAGES_KEPT - 1));
  const next: Stored = Object.fromEntries(kept);
  next[documentId] = [pageId, ...was.filter((id) => id !== pageId)].slice(0, RECENT_PAGES_MAX);
  writeLocalStorageSafe(KEY, JSON.stringify(next));
}
