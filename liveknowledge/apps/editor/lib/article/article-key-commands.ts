// The writing's keys (docs/specs/007-editor/article-pages.md "Writing", "Keyboard"): what Enter,
// Backspace, Delete, Tab, Shift+Tab, Shift+Enter and select-all do to the blocks. Each is a
// ProseMirror command. Re-exported from article-commands.ts.
import { NodeSelection, Selection, TextSelection, type Command } from 'prosemirror-state';
import { splitBlockAs } from 'prosemirror-commands';
import type { ArticleParagraphStyle } from '@liveknowledge/document';
import { textAttr } from './article-schema';
import {
  CODE,
  LIST,
  PARAGRAPH,
  S,
  caretBlock,
  isTextBlock,
  setBlockStyle,
  shiftLevel,
  toggleList,
} from './article-block-commands';

// Enter (docs/specs/007-editor/article-pages.md "Writing"): the new block's kind.
const splitAs = splitBlockAs((node, atEnd) => {
  if (node.type === LIST) return { type: LIST, attrs: { ...node.attrs, id: '', checked: false } };
  if (node.type !== PARAGRAPH) return null;
  const style = node.attrs.style as ArticleParagraphStyle;
  // After a heading (at its end) comes body text; a quote goes on as a quote.
  const heading = style !== 'body' && style !== 'quote';
  return {
    type: PARAGRAPH,
    attrs: {
      id: '',
      style: atEnd && heading ? 'body' : style,
      align: textAttr(node.attrs, 'align'),
    },
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
  // At the end of a heading with an empty paragraph waiting under it (a new article's first
  // paragraph): into that paragraph, rather than another.
  if (
    empty &&
    node.type === PARAGRAPH &&
    node.attrs.style !== 'body' &&
    node.attrs.style !== 'quote' &&
    $from.parentOffset === node.content.size
  ) {
    const next = state.doc.nodeAt(pos + node.nodeSize);
    if (next?.type === PARAGRAPH && next.attrs.style === 'body' && next.content.size === 0) {
      if (dispatch)
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, pos + node.nodeSize + 1)));
      return true;
    }
  }
  if (empty && node.content.size === 0) {
    if (node.type === LIST) return shiftLevel(-1)(state, dispatch);
    if (node.type === PARAGRAPH && node.attrs.style === 'quote')
      return setBlockStyle('body')(state, dispatch);
  }
  return splitAs(state, dispatch);
};

/** Backspace at the start of a block (docs/specs/007-editor/article-pages.md "Writing"). */
export const backspaceAtStart: Command = (state, dispatch, view) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== 0) return false;
  const here = caretBlock($from);
  if (!here) return false;
  const { node, pos } = here;
  if (node.type === LIST) return shiftLevel(-1)(state, dispatch);
  // The page's Title stays a Title (keep-title-plugin.ts): Backspace at its start does nothing.
  if (node.type === PARAGRAPH && node.attrs.style === 'title' && $from.index(0) === 0) return true;
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
  if (before.type === S.nodes.zone || before.type === S.nodes.toc) {
    if (dispatch) {
      const tr = state.tr;
      // An empty block goes with the move to the zone (or the contents).
      if (node.content.size === 0 && isTextBlock(node)) tr.delete(pos, pos + node.nodeSize);
      tr.setSelection(NodeSelection.create(tr.doc, beforePos));
      dispatch(tr);
    }
    return true;
  }
  if (before.type === S.nodes.table) {
    // Into the end of the table's last cell, never joined into it.
    if (dispatch) {
      const tr = state.tr;
      if (node.content.size === 0 && isTextBlock(node)) tr.delete(pos, pos + node.nodeSize);
      tr.setSelection(Selection.near(tr.doc.resolve(pos - 3), -1));
      dispatch(tr.scrollIntoView());
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
  if (after.type === S.nodes.zone || after.type === S.nodes.toc) {
    if (dispatch) dispatch(state.tr.setSelection(NodeSelection.create(state.doc, afterPos)));
    return true;
  }
  if (after.type === S.nodes.table) {
    // Into the start of the table's first cell, never joined into it.
    if (dispatch) dispatch(state.tr.setSelection(TextSelection.create(state.doc, afterPos + 3)));
    return true;
  }
  return false;
};

/** Tab: a list item a level in; at the start of body text, a bulleted list; in code, two spaces.
 *  Anything else is kept by the writing (focus stays). */
export const tab: Command = (state, dispatch) => {
  if (tabFromTitle(state, dispatch)) return true;
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
    else dispatch(state.tr.replaceSelectionWith(S.nodes.hard_break.create()).scrollIntoView());
  }
  return true;
};

/** The page's Title block, the writing's first top-level paragraph in the Title style; undefined with none. */
const titleOf = (doc: Parameters<Command>[0]['doc']) => {
  const first = doc.firstChild;
  return first && first.type === PARAGRAPH && first.attrs.style === 'title' ? first : undefined;
};

/** Select all of the box the caret is in (owner, 2026-11-21): in the Title, the Title's words; in the writing under
 *  it, all of that writing and never the Title. A page with no Title selects everything. */
export const selectAll: Command = (state, dispatch) => {
  if (dispatch) {
    const title = titleOf(state.doc);
    const inTitle = title !== undefined && state.selection.$from.pos < title.nodeSize;
    if (title && inTitle) {
      dispatch(state.tr.setSelection(TextSelection.create(state.doc, 1, title.nodeSize - 1)));
      return true;
    }
    const start = title
      ? Selection.findFrom(state.doc.resolve(title.nodeSize), 1, true)
      : Selection.atStart(state.doc);
    const end = Selection.atEnd(state.doc);
    if (!start) return true;
    dispatch(state.tr.setSelection(TextSelection.between(start.$from, end.$to)));
  }
  return true;
};

/** Tab in the Title (owner, 2026-11-21): the caret goes to the start of the writing under it, a body line made there
 *  when the page has none yet. */
export const tabFromTitle: Command = (state, dispatch) => {
  const title = titleOf(state.doc);
  if (!title || state.selection.$from.pos >= title.nodeSize) return false;
  if (dispatch) {
    let tr = state.tr;
    if (state.doc.childCount === 1)
      tr = tr.insert(title.nodeSize, PARAGRAPH.create({ style: 'body' }));
    const next = Selection.findFrom(tr.doc.resolve(title.nodeSize), 1, true);
    if (next) dispatch(tr.setSelection(next).scrollIntoView());
  }
  return true;
};
