// A page's shape, for reading time, On This Page and the Health Score (docs/specs/030-knowledgebase/verification.md
// "Health Score"): the words its writing holds and how many headings it has. One definition for the editor, which
// counts from the committed blocks, and the index, which keeps both beside the page's passages.
import { articleRunsText, type ArticleBlock } from '@liveknowledge/document';

const HEADING_STYLES: ReadonlySet<string> = new Set(['h1', 'h2', 'h3']);

const wordsIn = (text: string) => text.match(/\S+/g)?.length ?? 0;

/** The words a page's writing holds: text, lists, tables and code; zones, dividers and breaks hold none. */
export function pageWords(blocks: readonly ArticleBlock[]): number {
  let words = 0;
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'list')
      words += wordsIn(articleRunsText(block.runs));
    else if (block.type === 'code') words += wordsIn(block.text);
    else if (block.type === 'table')
      for (const row of block.rows)
        for (const cell of row.cells) words += wordsIn(articleRunsText(cell));
  }
  return words;
}

/** The headings On This Page lists: level one to three paragraphs with any text. */
export function pageHeadingCount(blocks: readonly ArticleBlock[]): number {
  let headings = 0;
  for (const block of blocks)
    if (
      block.type === 'paragraph' &&
      HEADING_STYLES.has(block.style ?? 'body') &&
      articleRunsText(block.runs).trim()
    )
      headings++;
  return headings;
}
