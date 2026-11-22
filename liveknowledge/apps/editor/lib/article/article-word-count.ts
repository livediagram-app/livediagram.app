// An article's Word Count (docs/specs/007-editor/article-pages.md "Word Count"): the words of the article the
// caret is in, and of the selection, counted as agents' page summaries count them (`articleWordCount`), so the
// editor and the summaries agree, with how long they take to read and how easily they read (`articleReadability`,
// the summaries' own). Read only while More Formatting is open, never per keystroke. Pure.
import type { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import {
  articleReadability,
  articleWordCount,
  READING_LEVEL_LABEL,
  readingTimeLabel,
  type ArticleFlow,
  type Readability,
} from '@liveknowledge/document';
import { docToBlocks } from './article-convert';

export type ArticleCounts = {
  // The article's words.
  total: number;
  // The selection's words, or null with nothing selected.
  selected: number | null;
  // How easily the article reads.
  readability?: Readability;
  // How easily the selection reads, or null with nothing selected.
  selectedReadability?: Readability | null;
};

type Whole = { total: number; readability: Readability };

// The article's figures per doc: a selection moving over unchanged writing reads only the selection again.
const WHOLE = new WeakMap<PMNode, Whole>();

const figuresOf = (flow: ArticleFlow): Whole => {
  const total = articleWordCount(flow);
  return { total, readability: articleReadability(flow, total) };
};

/** The words of the writing `state` holds, and of its selection, with how easily each reads: a cell selection reads
 *  only its cells. */
export function articleCountsOf(state: EditorState): ArticleCounts {
  const { doc, selection } = state;
  let whole = WHOLE.get(doc);
  if (whole === undefined) {
    whole = figuresOf({ blocks: docToBlocks(doc) });
    WHOLE.set(doc, whole);
  }
  const { total, readability } = whole;
  if (selection.empty) return { total, selected: null, readability, selectedReadability: null };
  const blocks = [];
  for (const range of selection.ranges) {
    const from = range.$from.pos;
    const to = range.$to.pos;
    if (to > from) blocks.push(...docToBlocks(doc.cut(from, to)));
  }
  const part = figuresOf({ blocks });
  return { total, selected: part.total, readability, selectedReadability: part.readability };
}

const WORDS = new Intl.NumberFormat('en');

/** "1 word", "840 words", or with a selection "12 of 840 words". */
export function wordCountLabel({ total, selected }: ArticleCounts): string {
  const unit = total === 1 ? 'word' : 'words';
  return selected === null
    ? `${WORDS.format(total)} ${unit}`
    : `${WORDS.format(selected)} of ${WORDS.format(total)} ${unit}`;
}

/** The figures the line reads from: the selection's while text is selected, else the article's. */
export function shownReadability(counts: ArticleCounts): Readability | null {
  return counts.selected !== null
    ? (counts.selectedReadability ?? null)
    : (counts.readability ?? null);
}

/** The whole line: "840 words · 4 min read · Easy to read", the selection's figures while text is selected
 *  ("12 of 840 words · 1 min read · Plain English"); a part with nothing to say is left out. */
export function wordCountLine(counts: ArticleCounts): string {
  return [wordCountLabel(counts), ...readingParts(counts)].join(' · ');
}

/** What the line says after the count: "4 min read", "Easy to read", each only when there is something to say. */
export function readingParts(counts: ArticleCounts): string[] {
  const r = shownReadability(counts);
  const parts: string[] = [];
  const time = r ? readingTimeLabel(r) : null;
  if (time) parts.push(time);
  if (r?.level) parts.push(READING_LEVEL_LABEL[r.level]);
  return parts;
}
