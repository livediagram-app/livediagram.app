// Whether a stored page has something to show, for its Explorer snapshot (docs/specs/006-document/
// document-snapshots.md): a knowledgebase page is writing (an article) with no elements, so counting elements alone
// read every page as empty and its knowledgebase said "Nothing to preview".
import { drawnCount, hasWriting } from '@liveknowledge/document';

export { hasWriting };

/** The tab's elements, and one more for its writing: what the index's "empty" reads (0 is nothing to preview). */
export function drawnCountWithWriting(tab: { elements?: unknown; articles?: unknown }): number {
  return drawnCount(tab) + (hasWriting(tab) ? 1 : 0);
}
