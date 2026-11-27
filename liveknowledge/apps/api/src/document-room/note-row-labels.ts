// A note on a page's words is label-less (an article-note element), so its Inbox rows read "Untitled"
// (elementDisplayLabel's fallback). The index takes its words instead (docs/specs/030-knowledgebase/page-comments.md
// "Comments on the writing"): quoted, from the saved writing only, never a draft. A detached note, its words
// deleted, keeps its label. Returns `rows` itself when no row is a note's, so a page without notes reads no more.
import {
  noteAnchorTexts,
  savedArticlesOf,
  type CollabIndexRows,
  type Element,
} from '@liveknowledge/document';

// An Inbox title, not the whole passage.
const LABEL_MAX = 80;

export function withNoteQuotes(
  rows: CollabIndexRows,
  elements: readonly Element[],
  body: object | undefined,
): CollabIndexRows {
  const notes = new Set(elements.filter((el) => el.type === 'article-note').map((el) => el.id));
  const bare = (r: { elementId: string }) => notes.has(r.elementId);
  if (notes.size === 0 || !(rows.threads.some(bare) || rows.actions.some(bare))) return rows;
  const quotes = noteAnchorTexts(savedArticlesOf(body));
  const label = <R extends { elementId: string; elementLabel: string }>(r: R): R => {
    const quote = bare(r) ? quotes.get(r.elementId)?.trim() : undefined;
    if (!quote) return r;
    const words = quote.length > LABEL_MAX ? `${quote.slice(0, LABEL_MAX - 1).trimEnd()}…` : quote;
    return { ...r, elementLabel: `“${words}”` };
  };
  return { threads: rows.threads.map(label), actions: rows.actions.map(label) };
}
