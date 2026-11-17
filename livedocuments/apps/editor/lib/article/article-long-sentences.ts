// Select the Next Long Sentence (docs/specs/007-editor/article-pages.md "Word Count"): the Word Count line, when the
// article has a sentence over LONG_SENTENCE_WORDS, selects the next one after the caret so the writer can split it.
// Sentences are read by the summaries' own pass (`sentencesOf`), over the prose a reader reads: paragraphs and list
// items, never code or a table. Walked on the pick only, never per keystroke. Pure.
import { TextSelection, type Command } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { LONG_SENTENCE_WORDS, sentencesOf } from '@livedocuments/document';

export type DocRange = { from: number; to: number };

// The prose blocks: what `articleReadability` reads as sentences.
const PROSE = new Set(['paragraph', 'list_item']);

/** Every sentence over LONG_SENTENCE_WORDS in the doc, as positions, in order. Each inline node that is not text
 *  (a footnote's marker, a line break) reads as spaces as wide as it is, so offset i in a block's text is position
 *  start + i. */
export function longSentenceRanges(doc: PMNode): DocRange[] {
  const out: DocRange[] = [];
  doc.forEach((block, offset) => {
    if (!PROSE.has(block.type.name)) return;
    let text = '';
    block.forEach((inline) => {
      text += inline.isText ? inline.text! : ' '.repeat(inline.nodeSize);
    });
    const start = offset + 1;
    for (const s of sentencesOf(text)) {
      if (s.words > LONG_SENTENCE_WORDS) out.push({ from: start + s.start, to: start + s.end });
    }
  });
  return out;
}

/** The long sentence to select next: the first starting after the selection's start (an empty selection: at or
 *  after the caret), else the first; null with none. */
export function nextLongSentence(ranges: readonly DocRange[], from: number, empty: boolean) {
  return ranges.find((r) => (empty ? r.from >= from : r.from > from)) ?? ranges[0] ?? null;
}

/** Selects the next long sentence and scrolls it into view; false with none. */
export const selectNextLongSentence: Command = (state, dispatch) => {
  const { selection } = state;
  const next = nextLongSentence(longSentenceRanges(state.doc), selection.from, selection.empty);
  if (!next) return false;
  dispatch?.(
    state.tr.setSelection(TextSelection.create(state.doc, next.from, next.to)).scrollIntoView(),
  );
  return true;
};
