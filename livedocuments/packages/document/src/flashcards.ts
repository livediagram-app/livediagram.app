// Flashcards (docs/specs/007-editor/flashcards.md): cards of text to speak from, each its own
// one-page article that never flows. A new card's writing, the words on a card and how long they
// take to say, the text-only cut of a card's blocks, adding a card and splitting a too-long one onto
// a new card. Pure.
import {
  articlesOf,
  newFlashcardFlow,
  nextArticleBlockId,
  normaliseRuns,
  type ArticleRun,
  withFreshArticleBlockIds,
  type ArticleBlock,
  type ArticleFlow,
  type ArticleParagraphBlock,
} from './article-flow';
import { withArticleFlow } from './article-pages';
import type { ArticleTableBlock } from './article-table';
import { MAX_PAGES, newFlashcardPage, pagesOf, withPages, type Page } from './page';
import type { Tab } from './index';

type PagesTab = Pick<Tab, 'elements'> & {
  pages?: unknown;
  pageOrientation?: unknown;
  articles?: unknown;
};

// A steady speaking pace (docs/specs/007-editor/flashcards.md "Card number and speaking time"):
// talks run 120 to 150 words a minute; the middle of that, a little slow, as notes are spoken.
export const FLASHCARD_WORDS_PER_MINUTE = 130;
// Under a minute, a card's time is said to the next this-many seconds.
const SPEAKING_STEP_S = 5;

// What the continued card's title adds to the card's own (Split Onto a New Card).
const CONTINUED = ' (continued)';
// The longest title a continued card keeps: a title, not a paragraph.
const CONTINUED_TITLE_MAX = 120;

const blockText = (b: ArticleBlock): string =>
  'runs' in b ? b.runs.map((r) => r.text).join('') : b.type === 'code' ? b.text : '';

// A word: a run of letters or digits (an apostrophe or hyphen inside keeps it one word).
const WORD = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** How many words a piece of plain text holds (a note card's, a block's). */
export function spokenWordCount(text: string): number {
  return text.match(WORD)?.length ?? 0;
}

/** How long a number of words takes to say aloud, in seconds: at FLASHCARD_WORDS_PER_MINUTE, rounded up. */
export function speakingSecondsFor(words: number): number {
  return Math.ceil((words * 60) / FLASHCARD_WORDS_PER_MINUTE);
}

/** How many words a card's writing holds: its title and every block's text. */
export function flashcardWordCount(flow: ArticleFlow): number {
  let n = 0;
  for (const b of flow.blocks) n += spokenWordCount(blockText(b));
  return n;
}

// Each writing's count, kept while the writing is the same object (a commit makes a new one).
const counted = new WeakMap<ArticleFlow, number>();

/** How long a card's words take to say aloud, in seconds (0 for none): at
 *  FLASHCARD_WORDS_PER_MINUTE, rounded up. Cached per writing object. */
export function flashcardSpeakingSeconds(flow: ArticleFlow): number {
  let words = counted.get(flow);
  if (words === undefined) {
    words = flashcardWordCount(flow);
    counted.set(flow, words);
  }
  return speakingSecondsFor(words);
}

/** A speaking time as the card's footer says it: "25 sec" under a minute (to the next 5 s), then
 *  "3 min" (the nearest minute); null for no words. */
export function speakingTimeLabel(seconds: number): string | null {
  if (seconds <= 0) return null;
  if (seconds < 60) {
    return `${Math.min(55, Math.ceil(seconds / SPEAKING_STEP_S) * SPEAKING_STEP_S)} sec`;
  }
  return `${Math.round(seconds / 60)} min`;
}

/** Whether a block is one a card holds (docs/specs/007-editor/flashcards.md "Text only"): text,
 *  never a zone, a page break, a table or a contents block. */
export function isFlashcardBlock(b: ArticleBlock): boolean {
  return b.type !== 'zone' && b.type !== 'pageBreak' && b.type !== 'table' && b.type !== 'toc';
}

/** A table as a card holds it: a bulleted item a row, its cells joined by " · ", the header row's
 *  text bold. */
function tableAsList(t: ArticleTableBlock, taken: Set<string>): ArticleBlock[] {
  return t.rows.map((row, r) => {
    const runs: ArticleRun[] = [];
    row.cells.forEach((cell, c) => {
      if (c > 0) runs.push({ text: ' · ' });
      for (const run of cell) runs.push(t.header && r === 0 ? { ...run, b: true } : run);
    });
    const id = nextArticleBlockId(taken);
    taken.add(id);
    return { id, type: 'list', list: 'bullet', runs: normaliseRuns(runs) };
  });
}

/** A card's writing cut to the text: zones, page breaks and contents blocks left out (`leftOut`
 *  counts them), each table written as a list (`tables` counts them). The same array back when
 *  nothing changed. */
export function flashcardCut(blocks: ArticleBlock[]): {
  blocks: ArticleBlock[];
  tables: number;
  leftOut: number;
} {
  if (blocks.every(isFlashcardBlock)) return { blocks, tables: 0, leftOut: 0 };
  const taken = new Set(blocks.map((b) => b.id));
  const out: ArticleBlock[] = [];
  let tables = 0;
  let leftOut = 0;
  for (const b of blocks) {
    if (b.type === 'table') {
      tables++;
      out.push(...tableAsList(b, taken));
    } else if (isFlashcardBlock(b)) out.push(b);
    else leftOut++;
  }
  return { blocks: out, tables, leftOut };
}

/** A card's writing cut to the text (flashcardCut's blocks). */
export function flashcardBlocks(blocks: ArticleBlock[]): ArticleBlock[] {
  return flashcardCut(blocks).blocks;
}

/** A new card after the last page (`page` its id and background), its writing new. Null at the
 *  page limit or when the id is taken. */
export function withFlashcardAdded<T extends PagesTab>(
  tab: T,
  page: Pick<Page, 'id' | 'background'>,
  flow: string,
): (T & { pages: Page[] }) | null {
  const pages = pagesOf(tab);
  if (pages.length >= MAX_PAGES || pages.some((p) => p.id === page.id)) return null;
  const card: Page = {
    ...newFlashcardPage(page.id, flow),
    ...(page.background ? { background: page.background } : {}),
  };
  return withArticleFlow(withPages(tab, [...pages, card]), flow, newFlashcardFlow());
}

export type FlashcardSplitRefusal = 'unknown_page' | 'locked' | 'page_limit' | 'nothing_to_move';

/** Whether a card's writing can be split at `fromBlockId` (the first block that does not fit
 *  whole): there must be a block before it that is not the title, so the card keeps some text. */
export function canSplitFlashcardAt(flow: ArticleFlow, fromBlockId: string): boolean {
  const at = flow.blocks.findIndex((b) => b.id === fromBlockId);
  if (at <= 0) return false;
  return flow.blocks.slice(0, at).some((b) => !(b.type === 'paragraph' && b.style === 'title'));
}

/**
 * Split Onto a New Card (docs/specs/007-editor/flashcards.md "Never flows"): the card's writing
 * from `fromBlockId` on moves onto a new card right after it (same size and background, new block
 * ids), led by a Title reading the card's title with " (continued)" when it has one with words in
 * it. One tab edit.
 */
export function withFlashcardSplit<T extends PagesTab>(
  tab: T,
  pageId: string,
  fromBlockId: string,
  newPageId: string,
  newFlow: string,
): { tab: T & { pages: Page[] } } | { refused: FlashcardSplitRefusal } {
  const pages = pagesOf(tab);
  const card = pages.find((p) => p.id === pageId);
  if (!card || card.kind !== 'flashcard' || !card.flow) return { refused: 'unknown_page' };
  if (card.locked === true) return { refused: 'locked' };
  if (pages.length >= MAX_PAGES || pages.some((p) => p.id === newPageId))
    return { refused: 'page_limit' };
  const doc = articlesOf(tab)[card.flow];
  if (!doc || !canSplitFlashcardAt(doc, fromBlockId)) return { refused: 'nothing_to_move' };
  const at = doc.blocks.findIndex((b) => b.id === fromBlockId);
  const kept = doc.blocks.slice(0, at);
  const moved = doc.blocks.slice(at);
  const title = doc.blocks.find(
    (b): b is ArticleParagraphBlock => b.type === 'paragraph' && b.style === 'title',
  );
  const titleText = title ? blockText(title).trim() : '';
  const lead: ArticleBlock[] = titleText
    ? [
        {
          id: 'lead',
          type: 'paragraph',
          style: 'title',
          runs: [{ text: `${titleText.slice(0, CONTINUED_TITLE_MAX)}${CONTINUED}` }],
        },
      ]
    : [];
  const fresh = withFreshArticleBlockIds({ blocks: [...lead, ...moved] });
  const next: Page = {
    ...newFlashcardPage(newPageId, newFlow),
    ...(card.background ? { background: card.background } : {}),
  };
  const i = pages.findIndex((p) => p.id === pageId);
  const repaged = withPages(tab, [...pages.slice(0, i + 1), next, ...pages.slice(i + 1)]);
  const withKept = withArticleFlow(repaged, card.flow, { ...doc, blocks: kept });
  return {
    tab: withArticleFlow(withKept, newFlow, {
      blocks: fresh.blocks,
      ...(doc.style ? { style: doc.style } : {}),
    }),
  };
}
