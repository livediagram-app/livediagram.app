// A page's writing split into passages (docs/specs/030-knowledgebase/search-and-ask.md "Search"): a heading and the
// blocks under it, at most MAX_PASSAGE_CHARS characters. A long section is split between blocks, and a block longer
// than a passage at the end of a sentence. One pass over the writing: every character is read a bounded number of
// times, so indexing a save is linear in the page's length.
import type { ArticleBlock, ArticleFlow } from '@liveknowledge/document';
import { stableHash } from './hash';
import { blockText } from './writing-text';

export const MAX_PASSAGE_CHARS = 1200;
/** A heading's text in a passage's heading path is cut here: a heading may be as long as any block. */
export const MAX_HEADING_PATH_CHARS = 120;

export type Passage = {
  /** Stable while the page, the headings above the passage and its place among their passages stay the same. */
  id: string;
  /** The page (tab) it is part of. */
  tab: string;
  /** Its place among the page's passages, 0 first. */
  ordinal: number;
  /** The headings it sits under, outermost first. Empty before the first heading. */
  headings: string[];
  text: string;
  /** Changes when the text does: what closes a conflict (conflicts.ts). */
  textHash: string;
  /** The first and the last block the text comes from, to find the passage on the page. */
  firstBlock: string;
  lastBlock: string;
};

const HEADING_LEVEL: Readonly<Record<string, number>> = { h1: 0, h2: 1, h3: 2 };

const headingLevel = (block: ArticleBlock): number | undefined =>
  block.type === 'paragraph' && block.style ? HEADING_LEVEL[block.style] : undefined;

const isSpace = (code: number) => code === 32 || code === 10 || code === 9 || code === 13;
// '.', '!', '?'
const endsSentence = (code: number) => code === 46 || code === 33 || code === 63;
const isHighSurrogate = (code: number) => code >= 0xd800 && code <= 0xdbff;

// Where to cut text that runs past a passage from `start`: after the last sentence end or line break that fits,
// else after the last space, else at the limit (never between the halves of a surrogate pair).
function cutAfter(text: string, start: number): number {
  const limit = start + MAX_PASSAGE_CHARS;
  let space = -1;
  for (let i = limit - 1; i > start; i--) {
    const code = text.charCodeAt(i);
    if (!isSpace(code)) continue;
    if (code === 10 || endsSentence(text.charCodeAt(i - 1))) return i + 1;
    if (space < 0) space = i + 1;
  }
  if (space > 0) return space;
  return isHighSurrogate(text.charCodeAt(limit - 1)) ? limit - 1 : limit;
}

/** `text` in pieces of at most MAX_PASSAGE_CHARS, cut at sentence ends where it can be. */
export function passagePieces(text: string): string[] {
  const pieces: string[] = [];
  let start = 0;
  while (text.length - start > MAX_PASSAGE_CHARS) {
    const end = cutAfter(text, start);
    const piece = text.slice(start, end).trim();
    if (piece) pieces.push(piece);
    start = end;
  }
  const rest = text.slice(start).trim();
  if (rest) pieces.push(rest);
  return pieces;
}

/** The passages of a page's writing, in order. The Title block is left out: the page's title is indexed as its
 *  own row (sql/page-index.ts). */
export function pagePassages(tab: string, flow: Pick<ArticleFlow, 'blocks'>): Passage[] {
  const passages: Passage[] = [];
  const path: string[] = ['', '', ''];
  // How many passages each heading path has so far: a passage's id counts within its own section, so writing added
  // under one heading renames no passage under another.
  const perPath = new Map<string, number>();
  let parts: string[] = [];
  let length = 0;
  let firstBlock = '';
  let lastBlock = '';

  const flush = () => {
    if (!parts.length) return;
    const headings = path.filter(Boolean);
    const key = headings.join('\n');
    const nth = perPath.get(key) ?? 0;
    perPath.set(key, nth + 1);
    const text = parts.join('\n');
    passages.push({
      id: stableHash(tab, key, String(nth)),
      tab,
      ordinal: passages.length,
      headings,
      text,
      textHash: stableHash(text),
      firstBlock,
      lastBlock,
    });
    parts = [];
    length = 0;
  };

  const add = (piece: string, block: string) => {
    if (parts.length && length + 1 + piece.length > MAX_PASSAGE_CHARS) flush();
    if (!parts.length) firstBlock = block;
    length += (parts.length ? 1 : 0) + piece.length;
    parts.push(piece);
    lastBlock = block;
  };

  for (const block of flow.blocks) {
    if (block.type === 'paragraph' && block.style === 'title') continue;
    const text = blockText(block).trim();
    const level = headingLevel(block);
    if (level !== undefined) {
      // A heading opens a passage, and an empty one still ends the section above it.
      flush();
      path[level] = text.slice(0, MAX_HEADING_PATH_CHARS).trim();
      for (let deeper = level + 1; deeper < path.length; deeper++) path[deeper] = '';
    }
    if (!text) continue;
    if (text.length <= MAX_PASSAGE_CHARS) add(text, block.id);
    else for (const piece of passagePieces(text)) add(piece, block.id);
  }
  flush();
  return passages;
}
