// The notice for an edit the article caps refused (docs/specs/007-editor/article-pages.md "How much an article
// holds"). Kept apart from the caps plugin (article-caps.ts): the editor sets the toast as it mounts, and a
// one-symbol import of the plugin's module put ProseMirror in every document's first load, articles or not.
import {
  MAX_ARTICLE_BLOCK_TEXT,
  MAX_ARTICLE_BLOCKS,
  MAX_ARTICLE_CELL_TEXT,
} from '@livedocuments/document';

export type ArticleCap = 'blocks' | 'text' | 'cell';

export const ARTICLE_CAP_NOTICE: Record<ArticleCap, string> = {
  blocks: `An article holds at most ${MAX_ARTICLE_BLOCKS.toLocaleString('en-GB')} blocks.`,
  text: `A paragraph holds at most ${MAX_ARTICLE_BLOCK_TEXT.toLocaleString('en-GB')} characters.`,
  cell: `A table cell holds at most ${MAX_ARTICLE_CELL_TEXT.toLocaleString('en-GB')} characters.`,
};

// One notice per stretch of refused edits, not one per key held down.
const NOTICE_GAP_MS = 2500;
let lastNotice = 0;
let toast: ((message: string) => void) | null = null;

/** Where the notice goes: the editor's toast, set once it mounts. */
export function setArticleCapsToast(next: ((message: string) => void) | null): void {
  toast = next;
}

/** Says which cap an edit met, at most once in NOTICE_GAP_MS. */
export function announceArticleCap(cap: ArticleCap, now = Date.now()): void {
  if (now - lastNotice < NOTICE_GAP_MS) return;
  lastNotice = now;
  toast?.(ARTICLE_CAP_NOTICE[cap]);
}
