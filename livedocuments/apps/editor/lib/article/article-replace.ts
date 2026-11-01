// The writing's content made the blocks the tab now holds (a peer's edit, an undo or a redo arriving),
// as the article editor applies it (ArticleEditor): only the stretch between the first and the last
// difference is replaced, so a caret in an untouched block, or elsewhere in the block a peer is typing
// in, stays exactly where it is.
import { TextSelection, type EditorState, type Transaction } from 'prosemirror-state';
import type { ArticleBlock } from '@livedocuments/document';
import { blocksToDoc } from './article-convert';

/** The transaction that makes `state`'s doc `blocks`, or null when it already is. `takeCaret` (an
 *  undo's change) puts the caret at the end of what changed. A difference that spans more than one
 *  textblock (two cells of a table, two list items) replaces the top-level blocks it touches whole: a
 *  slice open across a table's cells was fitted by adding a cell to every row, so a redo of typing in
 *  two cells grew the table a column, and the next edit stored it. */
export function replaceContentTr(
  state: EditorState,
  blocks: readonly ArticleBlock[],
  takeCaret: boolean,
): Transaction | null {
  const next = blocksToDoc(blocks);
  const doc = state.doc;
  const start = doc.content.findDiffStart(next.content);
  if (start === null) return null;
  const end = doc.content.findDiffEnd(next.content)!;
  // findDiffEnd answers for both articles; keep the two ends ordered for the replace.
  let { a: endA, b: endB } = end;
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }
  const caret = endB;
  let from = start;
  const $from = doc.resolve(start);
  const $toA = doc.resolve(endA);
  const $toB = next.resolve(endB);
  const oneTextblock =
    $from.parent.isTextblock &&
    $toA.parent.isTextblock &&
    $toB.parent.isTextblock &&
    $from.sameParent($toA) &&
    $from.depth === $toB.depth &&
    $from.start() === $toB.start();
  if (!oneTextblock) {
    if ($from.depth > 0) from = $from.before(1);
    if ($toA.depth > 0) endA = $toA.after(1);
    if ($toB.depth > 0) endB = $toB.after(1);
  }
  const tr = state.tr.replace(from, endA, next.slice(from, endB));
  tr.setMeta('article-remote', true).setMeta('addToHistory', false);
  if (takeCaret) {
    const at = Math.min(tr.doc.content.size, Math.max(0, caret));
    tr.setSelection(TextSelection.near(tr.doc.resolve(at), -1));
  }
  return tr;
}
