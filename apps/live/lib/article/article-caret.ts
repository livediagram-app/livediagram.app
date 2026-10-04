// Where a caret is in the writing, in terms every copy of it shares (docs/specs/007-editor/
// article-pages.md "Collaboration"): the top-level block it is in, by id, and how many characters
// into that block's text it sits. A ProseMirror position is no use to a collaborator, whose copy
// differs wherever either of them typed since the last commit; a block id and an offset into it
// land in the same place in both. An inline leaf (a line break) counts as one character, as its
// stored `\n` does.
import type { Node as PMNode } from 'prosemirror-model';
import { NodeSelection, type EditorState } from 'prosemirror-state';

export type ArticleCaretPlace = { blockId: string; offset: number };

const charsOf = (node: PMNode): number => (node.isText ? node.text!.length : 1);

/** The characters of `block`'s text before `rel`, a position counted from its content's start. */
function offsetIn(block: PMNode, rel: number): number {
  let chars = 0;
  let pos = 0;
  block.forEach((child) => {
    if (pos >= rel) return;
    chars += child.isText ? Math.min(child.nodeSize, rel - pos) : 1;
    pos += child.nodeSize;
  });
  return chars;
}

/** Where the selection's head is, as a block id and a character offset; null with no block there. */
export function caretOf(state: EditorState): ArticleCaretPlace | null {
  const { doc, selection } = state;
  // A selected block (a zone, a divider) is where its selection starts.
  const head = selection instanceof NodeSelection ? selection.from : selection.head;
  const $head = doc.resolve(head);
  if ($head.depth >= 1) {
    const block = $head.node(1);
    const id = block.attrs.id as string | undefined;
    return id ? { blockId: id, offset: offsetIn(block, head - $head.start(1)) } : null;
  }
  // Between blocks (a selected block, a gap cursor): the block after it, or the one before.
  const block = $head.nodeAfter ?? $head.nodeBefore;
  const id = block?.attrs.id as string | undefined;
  return id ? { blockId: id, offset: 0 } : null;
}

export type ResolvedCaret = {
  // The block's position and the position just past it.
  from: number;
  to: number;
  // The caret's position in the block's text, its offset clamped to the text's length; null for a
  // block with no text (a zone, a divider): only its margin bar shows.
  pos: number | null;
};

/** Where `place` falls in `doc`; null when no block has its id (the block went). */
export function resolveCaret(doc: PMNode, place: ArticleCaretPlace): ResolvedCaret | null {
  let found: ResolvedCaret | null = null;
  doc.forEach((block, from) => {
    if (found || block.attrs.id !== place.blockId) return;
    const to = from + block.nodeSize;
    if (!block.isTextblock) {
      found = { from, to, pos: null };
      return;
    }
    const start = from + 1;
    let left = Math.max(0, place.offset);
    let pos = 0;
    let done = false;
    block.forEach((child) => {
      if (done) return;
      const chars = charsOf(child);
      if (left <= chars && (child.isText || left === 0)) {
        pos += child.isText ? left : 0;
        done = true;
        return;
      }
      left -= chars;
      pos += child.nodeSize;
    });
    found = { from, to, pos: start + (done ? pos : block.content.size) };
  });
  return found;
}
