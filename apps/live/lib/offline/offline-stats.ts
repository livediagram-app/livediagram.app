import type { DocumentStats } from '@livediagram/api-schema';
import { tabStatsOf, type Tab } from '@livediagram/document';

// What the Explorer's Details view shows for a document saved only in this browser
// (docs/specs/013-workspace/explorer-details-view.md): its tabs counted with the api's own rule,
// bytes as the JSON the api would store. This browser keeps no per-tab write time, so the mode is
// the first tab's. Null for a document with no tab.

// Counting serialises every tab, so a record is counted once per save: keyed by id and savedAt.
const CACHE_MAX = 500;
const cache = new Map<string, DocumentStats | null>();

export function offlineDocumentStats(rec: {
  id: string;
  savedAt: number;
  tabs: Tab[];
}): DocumentStats | null {
  const key = `${rec.id}:${rec.savedAt}`;
  if (cache.has(key)) return cache.get(key)!;
  const stats = count(rec.tabs);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, stats);
  return stats;
}

function count(tabs: Tab[]): DocumentStats | null {
  if (tabs.length === 0) return null;
  let elements = 0;
  let comments = 0;
  let bytes = 0;
  for (const tab of tabs) {
    const { id: _id, name: _name, ...body } = tab;
    const s = tabStatsOf(body, JSON.stringify(body));
    elements += s.elementCount;
    comments += s.commentCount;
    bytes += s.dataBytes;
  }
  const { id: _id, name: _name, ...first } = tabs[0]!;
  return { mode: tabStatsOf(first, '').mode, elements, comments, bytes };
}
