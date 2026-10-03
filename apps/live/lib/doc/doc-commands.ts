// The writing's commands (docs/specs/007-editor/document-pages.md "Writing", "The page toolbar"):
// what a key, the toolbar or the slash menu does to the blocks and the text. Each is a ProseMirror
// command (state, dispatch?) so a caller can ask whether it applies before running it.
import type { Mark, MarkType, Node as PMNode, ResolvedPos } from 'prosemirror-model';
import {
  NodeSelection,
  Selection,
  TextSelection,
  type Command,
  type EditorState,
  type Transaction,
} from 'prosemirror-state';
import { splitBlockAs, toggleMark } from 'prosemirror-commands';
import {
  DOC_LIST_MAX_LEVEL,
  isSafeDocHref,
  type DocAlign,
  type DocListKind,
  type DocParagraphStyle,
} from '@livediagram/document';
import { docSchema, safeMarkColor } from './doc-schema';

const S = docSchema;
const PARAGRAPH = S.nodes.paragraph!;
const LIST = S.nodes.list_item!;
const CODE = S.nodes.code_block!;

/** The top-level blocks the selection touches, with their positions. */
export function selectedBlocks(state: EditorState): { node: PMNode; pos: number }[] {
  const { from, to } = state.selection;
  const out: { node: PMNode; pos: number }[] = [];
  state.doc.forEach((node, pos) => {
    const end = pos + node.nodeSize;
    if (end > from && pos < to) out.push({ node, pos });
    else if (from === to && pos <= from && from <= end) out.push({ node, pos });
  });
  // A caret exactly between two blocks belongs to the one it is in: keep the last match.
  return from === to && out.length > 1 ? [out[out.length - 1]!] : out;
}

const isTextBlock = (n: PMNode) => n.type === PARAGRAPH || n.type === LIST;

/** The block the caret is in (depth 1), if any. */
function caretBlock($pos: ResolvedPos): { node: PMNode; pos: number } | null {
  if ($pos.depth < 1) return null;
  return { node: $pos.node(1), pos: $pos.before(1) };
}

/** Every selected text block (or code block) turned into a paragraph of `style`. */
export function setBlockStyle(style: DocParagraphStyle | 'code'): Command {
  return (state, dispatch) => {
    const blocks = selectedBlocks(state).filter(
      ({ node }) => isTextBlock(node) || node.type === CODE,
    );
    if (blocks.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of blocks) {
        if (style === 'code') {
          if (node.type !== CODE)
            tr.setBlockType(pos + 1, pos + node.nodeSize - 1, CODE, { id: node.attrs.id });
          continue;
        }
        const attrs = {
          id: node.attrs.id,
          style,
          align: node.type === CODE ? 'left' : (node.attrs.align ?? 'left'),
        };
        if (node.type === PARAGRAPH) tr.setNodeMarkup(pos, PARAGRAPH, attrs);
        else tr.setBlockType(pos + 1, pos + node.nodeSize - 1, PARAGRAPH, attrs);
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

/** The selected text blocks as a list of `kind`, or back to text when they all already are. */
export function toggleList(kind: DocListKind): Command {
  return (state, dispatch) => {
    const blocks = selectedBlocks(state).filter(({ node }) => isTextBlock(node));
    if (blocks.length === 0) return false;
    const all = blocks.every(({ node }) => node.type === LIST && node.attrs.list === kind);
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of blocks) {
        if (all) {
          tr.setNodeMarkup(pos, PARAGRAPH, {
            id: node.attrs.id,
            style: 'body',
            align: node.attrs.align,
          });
        } else {
          tr.setNodeMarkup(pos, LIST, {
            id: node.attrs.id,
            list: kind,
            level: node.type === LIST ? node.attrs.level : 0,
            checked: false,
            align: node.attrs.align,
          });
        }
      }
      dispatch(tr);
    }
    return true;
  };
}

/** List items a level in (`by` 1) or out (-1); out of level 0 a list item becomes text. */
export function shiftLevel(by: 1 | -1): Command {
  return (state, dispatch) => {
    const items = selectedBlocks(state).filter(({ node }) => node.type === LIST);
    if (items.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of items) {
        const level = (node.attrs.level as number) + by;
        if (level < 0)
          tr.setNodeMarkup(pos, PARAGRAPH, {
            id: node.attrs.id,
            style: 'body',
            align: node.attrs.align,
          });
        else
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            level: Math.min(DOC_LIST_MAX_LEVEL, level),
          });
      }
      dispatch(tr);
    }
    return true;
  };
}

export function setAlign(align: DocAlign): Command {
  return (state, dispatch) => {
    const blocks = selectedBlocks(state).filter(({ node }) => isTextBlock(node));
    if (blocks.length === 0) return false;
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of blocks)
        tr.setNodeMarkup(pos, undefined, { ...node.attrs, align });
      dispatch(tr);
    }
    return true;
  };
}

export const toggleBold = toggleMark(S.marks.bold!);
export const toggleItalic = toggleMark(S.marks.italic!);
export const toggleUnderline = toggleMark(S.marks.underline!);
export const toggleStrike = toggleMark(S.marks.strike!);
export const toggleCode = toggleMark(S.marks.code!);
export const toggleSup = toggleMark(S.marks.sup!);
export const toggleSub = toggleMark(S.marks.sub!);

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
    if (href !== null && !isSafeDocHref(href)) return false;
    // A link on a caret with no selection spans the link the caret is in, if any.
    const { empty, $from } = state.selection;
    if (empty) {
      const range = markRange($from, S.marks.link!);
      if (!range) return false;
      if (dispatch) {
        const tr = state.tr.removeMark(range.from, range.to, S.marks.link!);
        if (href) tr.addMark(range.from, range.to, S.marks.link!.create({ href }));
        dispatch(tr);
      }
      return true;
    }
    return setAttrMark(S.marks.link!, href ? { href } : null)(state, dispatch);
  };
}

export const setTextColor = (color: string | null): Command =>
  setAttrMark(S.marks.color!, color && safeMarkColor(color) ? { color } : null);
export const setHighlight = (color: string | null): Command =>
  setAttrMark(S.marks.highlight!, color && safeMarkColor(color) ? { color } : null);

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

// Enter (docs/specs/007-editor/document-pages.md "Writing"): the new block's kind.
const splitAs = splitBlockAs((node, atEnd) => {
  if (node.type === LIST) return { type: LIST, attrs: { ...node.attrs, id: '', checked: false } };
  if (node.type !== PARAGRAPH) return null;
  const style = node.attrs.style as DocParagraphStyle;
  // After a heading (at its end) comes body text; a quote goes on as a quote.
  const heading = style !== 'body' && style !== 'quote';
  return {
    type: PARAGRAPH,
    attrs: { id: '', style: atEnd && heading ? 'body' : style, align: node.attrs.align },
  };
});

/** Enter: an empty list item steps out a level (to text from level 0), an empty quote becomes
 *  text, a code block takes a newline (and is left by Enter on an empty last line), anything else
 *  splits. */
export const enter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  const here = caretBlock($from);
  if (!here) return false;
  const { node, pos } = here;
  if (node.type === CODE) {
    if (!empty) return false;
    const text = node.textContent;
    const atEnd = $from.parentOffset === node.content.size;
    if (atEnd && text.endsWith('\n')) {
      // Leave the code block: the trailing newline goes, a paragraph follows.
      if (dispatch) {
        const tr = state.tr.delete($from.pos - 1, $from.pos);
        const after = pos + node.nodeSize - 1;
        tr.insert(after, PARAGRAPH.create());
        tr.setSelection(TextSelection.create(tr.doc, after + 1));
        dispatch(tr.scrollIntoView());
      }
      return true;
    }
    if (dispatch) dispatch(state.tr.insertText('\n').scrollIntoView());
    return true;
  }
  if (empty && node.content.size === 0) {
    if (node.type === LIST) return shiftLevel(-1)(state, dispatch);
    if (node.type === PARAGRAPH && node.attrs.style === 'quote')
      return setBlockStyle('body')(state, dispatch);
  }
  return splitAs(state, dispatch);
};

/** Backspace at the start of a block (docs/specs/007-editor/document-pages.md "Writing"). */
export const backspaceAtStart: Command = (state, dispatch, view) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0) return false;
  const here = caretBlock($from);
  if (!here) return false;
  const { node, pos } = here;
  if (node.type === LIST) return shiftLevel(-1)(state, dispatch);
  if (node.type === PARAGRAPH && node.attrs.style !== 'body')
    return setBlockStyle('body')(state, dispatch);
  // The block before: a divider or a page break goes; a zone is selected (a second Backspace
  // removes it).
  const index = $from.index(0);
  const before = index > 0 ? state.doc.child(index - 1) : null;
  if (!before) return false;
  const beforePos = pos - before.nodeSize;
  if (before.type === S.nodes.divider || before.type === S.nodes.page_break) {
    if (dispatch) dispatch(state.tr.delete(beforePos, pos));
    return true;
  }
  if (before.type === S.nodes.zone) {
    if (dispatch) {
      const tr = state.tr;
      // An empty block goes with the move to the zone.
      if (node.content.size === 0 && isTextBlock(node)) tr.delete(pos, pos + node.nodeSize);
      tr.setSelection(NodeSelection.create(tr.doc, beforePos));
      dispatch(tr);
    }
    return true;
  }
  void view;
  return false;
};

/** Delete at the end of a block: a divider or page break after it goes; a zone is selected. */
export const deleteAtEnd: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== $from.parent.content.size) return false;
  const here = caretBlock($from);
  if (!here) return false;
  const index = $from.index(0);
  const after = index + 1 < state.doc.childCount ? state.doc.child(index + 1) : null;
  if (!after) return false;
  const afterPos = here.pos + here.node.nodeSize;
  if (after.type === S.nodes.divider || after.type === S.nodes.page_break) {
    if (dispatch) dispatch(state.tr.delete(afterPos, afterPos + after.nodeSize));
    return true;
  }
  if (after.type === S.nodes.zone) {
    if (dispatch) dispatch(state.tr.setSelection(NodeSelection.create(state.doc, afterPos)));
    return true;
  }
  return false;
};

/** Tab: a list item a level in; at the start of body text, a bulleted list; in code, two spaces.
 *  Anything else is kept by the writing (focus stays). */
export const tab: Command = (state, dispatch) => {
  const here = caretBlock(state.selection.$from);
  if (!here) return true;
  const { node } = here;
  if (node.type === LIST) return shiftLevel(1)(state, dispatch);
  if (node.type === CODE) {
    if (dispatch) dispatch(state.tr.insertText('  '));
    return true;
  }
  if (
    node.type === PARAGRAPH &&
    node.attrs.style === 'body' &&
    state.selection.empty &&
    state.selection.$from.parentOffset === 0
  )
    return toggleList('bullet')(state, dispatch);
  return true;
};

export const shiftTab: Command = (state, dispatch) => {
  const here = caretBlock(state.selection.$from);
  if (here?.node.type === LIST) return shiftLevel(-1)(state, dispatch);
  return true;
};

/** Shift+Enter: a line break in the block (a newline in code). */
export const lineBreak: Command = (state, dispatch) => {
  const here = caretBlock(state.selection.$from);
  if (!here) return false;
  if (dispatch) {
    if (here.node.type === CODE) dispatch(state.tr.insertText('\n').scrollIntoView());
    else dispatch(state.tr.replaceSelectionWith(S.nodes.hard_break!.create()).scrollIntoView());
  }
  return true;
};

/** Select all of the writing. */
export const selectAll: Command = (state, dispatch) => {
  if (dispatch) {
    const start = Selection.atStart(state.doc);
    const end = Selection.atEnd(state.doc);
    dispatch(state.tr.setSelection(TextSelection.between(start.$from, end.$to)));
  }
  return true;
};

/** Which formats and block style the selection has, for the toolbar's pressed states. */
export type DocSelectionState = {
  style: DocParagraphStyle | 'code' | 'list' | null;
  list: DocListKind | null;
  align: DocAlign | null;
  marks: Set<string>;
  link: string | null;
  color: string | null;
  highlight: string | null;
  inText: boolean;
};

export function selectionStateOf(state: EditorState): DocSelectionState {
  const blocks = selectedBlocks(state);
  const first = blocks[0]?.node;
  const marks = new Set<string>();
  const { from, to, empty, $from } = state.selection;
  const active = empty ? (state.storedMarks ?? $from.marks()) : [];
  let link: string | null = null;
  let color: string | null = null;
  let highlight: string | null = null;
  const take = (m: Mark) => {
    marks.add(m.type.name);
    if (m.type.name === 'link') link = m.attrs.href as string;
    if (m.type.name === 'color') color = m.attrs.color as string;
    if (m.type.name === 'highlight') highlight = m.attrs.color as string;
  };
  if (empty) active.forEach(take);
  else {
    // A mark counts as on when every text in the selection has it.
    const counts = new Map<string, number>();
    let texts = 0;
    state.doc.nodesBetween(from, to, (node) => {
      if (!node.isText) return;
      texts++;
      for (const m of node.marks) {
        counts.set(m.type.name, (counts.get(m.type.name) ?? 0) + 1);
        if (m.type.name === 'link') link = m.attrs.href as string;
        if (m.type.name === 'color') color = m.attrs.color as string;
        if (m.type.name === 'highlight') highlight = m.attrs.color as string;
      }
    });
    for (const [name, n] of counts) if (n === texts) marks.add(name);
  }
  return {
    style: !first
      ? null
      : first.type === LIST
        ? 'list'
        : first.type === CODE
          ? 'code'
          : first.type === PARAGRAPH
            ? (first.attrs.style as DocParagraphStyle)
            : null,
    list: first?.type === LIST ? (first.attrs.list as DocListKind) : null,
    align: first && isTextBlock(first) ? (first.attrs.align as DocAlign) : null,
    marks,
    link,
    color,
    highlight,
    inText: !!first && (isTextBlock(first) || first.type === CODE),
  };
}

export type { Transaction };
