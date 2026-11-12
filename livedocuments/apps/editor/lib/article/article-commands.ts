// The writing's commands (docs/specs/007-editor/article-pages.md "Writing", "The page toolbar"):
// what a key, the toolbar or the slash menu does to the blocks and the text. Each is a ProseMirror
// command (state, dispatch?) so a caller can ask whether it applies before running it.
import type { Mark, MarkType, Node as PMNode, ResolvedPos } from 'prosemirror-model';
import { NodeSelection, TextSelection, type Command, type Transaction } from 'prosemirror-state';
import { toggleMark } from 'prosemirror-commands';
import { isSafeArticleHref } from '@livedocuments/document';
import { safeMarkColor } from './article-schema';
import { PARAGRAPH, S, caretBlock, isTextBlock } from './article-block-commands';

// The block commands, the keys and the toolbar's selection state, each in its own module.
export {
  setAlign,
  setBlockStyle,
  shiftLevel,
  toggleList,
  toggleTodoChecked,
} from './article-block-commands';
export {
  backspaceAtStart,
  deleteAtEnd,
  enter,
  lineBreak,
  selectAll,
  shiftTab,
  tab,
} from './article-key-commands';
export {
  sameSelectionState,
  selectionStateOf,
  tableHasHeader,
  type ArticleSelectionState,
} from './article-selection-state';

export const toggleBold = toggleMark(S.marks.bold);
export const toggleItalic = toggleMark(S.marks.italic);
export const toggleUnderline = toggleMark(S.marks.underline);
export const toggleStrike = toggleMark(S.marks.strike);
export const toggleCode = toggleMark(S.marks.code);
export const toggleSup = toggleMark(S.marks.sup);
export const toggleSub = toggleMark(S.marks.sub);

// A mark with attributes (a link, a colour) set over the selection, or taken off it with null.
function setAttrMark(type: MarkType, attrs: Record<string, unknown> | null): Command {
  return (state, dispatch) => {
    const { from, to, empty } = state.selection;
    if (dispatch) {
      const tr = state.tr;
      if (empty) {
        // At a caret: what is typed next takes it (or not).
        if (attrs) tr.addStoredMark(type.create(attrs));
        else tr.removeStoredMark(type);
      } else {
        tr.removeMark(from, to, type);
        if (attrs) tr.addMark(from, to, type.create(attrs));
      }
      dispatch(tr);
    }
    return true;
  };
}

export function setLink(href: string | null): Command {
  return (state, dispatch) => {
    if (href !== null && !isSafeArticleHref(href)) return false;
    // A link on a caret with no selection spans the link the caret is in, if any.
    const { empty, $from } = state.selection;
    if (empty) {
      const range = markRange($from, S.marks.link);
      if (!range) return false;
      if (dispatch) {
        const tr = state.tr.removeMark(range.from, range.to, S.marks.link);
        if (href) tr.addMark(range.from, range.to, S.marks.link.create({ href }));
        dispatch(tr);
      }
      return true;
    }
    return setAttrMark(S.marks.link, href ? { href } : null)(state, dispatch);
  };
}

export const setTextColor = (color: string | null): Command =>
  setAttrMark(S.marks.color, color && safeMarkColor(color) ? { color } : null);
export const setHighlight = (color: string | null): Command =>
  setAttrMark(S.marks.highlight, color && safeMarkColor(color) ? { color } : null);

/** Every mark off the selection. */
export const clearFormatting: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  if (empty) return false;
  if (dispatch) {
    const tr = state.tr;
    for (const type of Object.values(S.marks)) tr.removeMark(from, to, type);
    dispatch(tr);
  }
  return true;
};

/** The range of the mark of `type` around a position, if the position is in one. */
export function markRange(
  $pos: ResolvedPos,
  type: MarkType,
): { from: number; to: number; mark: Mark } | null {
  const parent = $pos.parent;
  const start = $pos.start();
  let found: { from: number; to: number; mark: Mark } | null = null;
  parent.forEach((child, offset) => {
    const mark = type.isInSet(child.marks);
    if (!mark) return;
    const from = start + offset;
    const to = from + child.nodeSize;
    if (found && found.to === from && found.mark.eq(mark)) found = { ...found, to };
    else if (!found || found.to < $pos.pos) found = { from, to, mark };
  });
  const f = found as { from: number; to: number; mark: Mark } | null;
  return f && f.from <= $pos.pos && $pos.pos <= f.to ? f : null;
}

/** Nodes put after the block the caret is in (taking its place when it is an empty text block),
 *  the caret into the first text block after them, or the last node selected. */
export function insertBlocksAfterCaret(nodes: PMNode[]): Command {
  return (state, dispatch) => {
    if (nodes.length === 0) return false;
    const here = caretBlock(state.selection.$from);
    const blockAt = here ?? {
      node: state.doc.lastChild!,
      pos: state.doc.content.size - state.doc.lastChild!.nodeSize,
    };
    const replace = isTextBlock(blockAt.node) && blockAt.node.content.size === 0;
    if (dispatch) {
      const tr = state.tr;
      const at = replace ? blockAt.pos : blockAt.pos + blockAt.node.nodeSize;
      if (replace) tr.replaceWith(blockAt.pos, blockAt.pos + blockAt.node.nodeSize, nodes);
      else tr.insert(at, nodes);
      // Always somewhere to write after an atom at the end.
      let end = at + nodes.reduce((n, node) => n + node.nodeSize, 0);
      const last = nodes[nodes.length - 1]!;
      if (last.isAtom && end >= tr.doc.content.size) {
        tr.insert(end, PARAGRAPH.create());
      }
      const firstText = nodes.findIndex((n) => n.isTextblock);
      if (firstText >= 0) {
        const pos = at + nodes.slice(0, firstText).reduce((n, node) => n + node.nodeSize, 0) + 1;
        tr.setSelection(TextSelection.create(tr.doc, pos));
      } else if (last.isAtom) {
        end = at + nodes.reduce((n, node) => n + node.nodeSize, 0) - last.nodeSize;
        tr.setSelection(NodeSelection.create(tr.doc, end));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

export type { Transaction };
