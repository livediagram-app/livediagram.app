// A paste onto a flashcard, cut to what a card holds (docs/specs/007-editor/flashcards.md "Text only"):
// a pasted table becomes a list, a row an item (as an agent's table on a card does, flashcardCut), and a
// page break, a zone or a contents block is left out. Only a table, a page break, a zone or a contents
// block at the paste's top level is touched; anything else comes back as it was.
import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import { flashcardCut } from '@livedocuments/document';
import { articleSchema } from './article-schema';
import { blocksToDoc, docToBlocks } from './article-convert';

const NOT_ON_A_CARD = new Set(['table', 'toc', 'page_break', 'zone']);

/** `slice` as a card takes it, with whether anything was cut (`cut`), to say so once. */
export function cardPasteSlice(slice: Slice): { slice: Slice; cut: boolean } {
  let touched = false;
  slice.content.forEach((n) => {
    if (NOT_ON_A_CARD.has(n.type.name)) touched = true;
  });
  if (!touched) return { slice, cut: false };
  const nodes: PMNode[] = [];
  let cut = false;
  slice.content.forEach((n) => {
    if (!NOT_ON_A_CARD.has(n.type.name)) {
      nodes.push(n);
      return;
    }
    cut = true;
    if (n.type.name !== 'table') return;
    const kept = flashcardCut(docToBlocks(articleSchema.node('doc', null, [n]))).blocks;
    if (kept.length > 0) blocksToDoc(kept).forEach((item) => nodes.push(item));
  });
  // The ends stay open only where the node there is the one the paste opened with.
  const first = slice.content.firstChild;
  const last = slice.content.lastChild;
  const openStart = nodes[0] === first ? slice.openStart : 0;
  const openEnd = nodes.at(-1) === last ? slice.openEnd : 0;
  return { slice: new Slice(Fragment.from(nodes), openStart, openEnd), cut };
}
