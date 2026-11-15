// An article's Word Count (docs/specs/007-editor/article-pages.md "Word Count"): the words of the article the
// caret is in, and of the selection, counted as agents' page summaries count them (`articleWordCount`), so the
// editor and the summaries agree. Read only while More Formatting is open, never per keystroke. Pure.
import type { EditorState } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { articleWordCount } from '@livedocuments/document';
import { docToBlocks } from './article-convert';

export type ArticleCounts = {
  // The article's words.
  total: number;
  // The selection's words, or null with nothing selected.
  selected: number | null;
};

// The article's count per doc: a selection moving over unchanged writing counts only the selection again.
const TOTALS = new WeakMap<PMNode, number>();

/** The words of the writing `state` holds, and of its selection: a cell selection counts only its cells. */
export function articleCountsOf(state: EditorState): ArticleCounts {
  const { doc, selection } = state;
  let total = TOTALS.get(doc);
  if (total === undefined) {
    total = articleWordCount({ blocks: docToBlocks(doc) });
    TOTALS.set(doc, total);
  }
  if (selection.empty) return { total, selected: null };
  let selected = 0;
  for (const range of selection.ranges) {
    const from = range.$from.pos;
    const to = range.$to.pos;
    if (to > from) selected += articleWordCount({ blocks: docToBlocks(doc.cut(from, to)) });
  }
  return { total, selected };
}

const WORDS = new Intl.NumberFormat('en');

/** "1 word", "840 words", or with a selection "12 of 840 words". */
export function wordCountLabel({ total, selected }: ArticleCounts): string {
  const unit = total === 1 ? 'word' : 'words';
  return selected === null
    ? `${WORDS.format(total)} ${unit}`
    : `${WORDS.format(selected)} of ${WORDS.format(total)} ${unit}`;
}
