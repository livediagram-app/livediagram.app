// How long a page takes to read, for the right rail (docs/specs/030-knowledgebase/page-surface.md "Reading
// time"). Counted from the committed blocks like On This Page, so it changes when the writing is committed, never per
// keystroke; the last answer is kept per block list.
import { articleRunsText, type ArticleBlock } from '@liveknowledge/document';

/** Words an adult reads in a minute of working prose. */
export const WORDS_PER_MINUTE = 230;

const cache = new WeakMap<readonly ArticleBlock[], number>();

const wordsIn = (text: string) => text.match(/\S+/g)?.length ?? 0;

/** The words a page's writing holds: text, lists, tables and code; zones, dividers and breaks hold none. */
export function pageWords(blocks: readonly ArticleBlock[]): number {
  const held = cache.get(blocks);
  if (held !== undefined) return held;
  let words = 0;
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'list')
      words += wordsIn(articleRunsText(block.runs));
    else if (block.type === 'code') words += wordsIn(block.text);
    else if (block.type === 'table')
      for (const row of block.rows)
        for (const cell of row.cells) words += wordsIn(articleRunsText(cell));
  }
  cache.set(blocks, words);
  return words;
}

/** Whole minutes to read `words`, at least one for any writing; 0 for an empty page. */
export function readingMinutes(words: number): number {
  return words === 0 ? 0 : Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
