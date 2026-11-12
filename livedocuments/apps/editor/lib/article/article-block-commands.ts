// The writing's block commands (docs/specs/007-editor/article-pages.md "Writing", "The page toolbar"):
// a block's style, a list, a to-do's tick, a list's level and the alignment, plus the block lookups
// the other command modules share. Re-exported from article-commands.ts.
import type { Node as PMNode, ResolvedPos } from 'prosemirror-model';
import type { Command, EditorState } from 'prosemirror-state';
import {
  ARTICLE_LIST_MAX_LEVEL,
  type ArticleAlign,
  type ArticleListKind,
  type ArticleParagraphStyle,
} from '@livedocuments/document';
import { articleSchema, numberAttr, textAttr } from './article-schema';

export const S = articleSchema;
export const PARAGRAPH = S.nodes.paragraph;
export const LIST = S.nodes.list_item;
export const CODE = S.nodes.code_block;

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

export const isTextBlock = (n: PMNode) => n.type === PARAGRAPH || n.type === LIST;

/** The block the caret is in (depth 1), if any. */
export function caretBlock($pos: ResolvedPos): { node: PMNode; pos: number } | null {
  if ($pos.depth < 1) return null;
  return { node: $pos.node(1), pos: $pos.before(1) };
}

/** Every selected text block (or code block) turned into a paragraph of `style`. */
export function setBlockStyle(style: ArticleParagraphStyle | 'code'): Command {
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
            tr.setBlockType(pos + 1, pos + node.nodeSize - 1, CODE, {
              id: textAttr(node.attrs, 'id'),
            });
          continue;
        }
        const attrs = {
          id: textAttr(node.attrs, 'id'),
          style,
          align: node.type === CODE ? 'left' : (textAttr(node.attrs, 'align') ?? 'left'),
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
export function toggleList(kind: ArticleListKind): Command {
  return (state, dispatch) => {
    const blocks = selectedBlocks(state).filter(({ node }) => isTextBlock(node));
    if (blocks.length === 0) return false;
    const all = blocks.every(({ node }) => node.type === LIST && node.attrs.list === kind);
    if (dispatch) {
      const tr = state.tr;
      for (const { node, pos } of blocks) {
        if (all) {
          tr.setNodeMarkup(pos, PARAGRAPH, {
            id: textAttr(node.attrs, 'id'),
            style: 'body',
            align: textAttr(node.attrs, 'align'),
          });
        } else {
          tr.setNodeMarkup(pos, LIST, {
            id: textAttr(node.attrs, 'id'),
            list: kind,
            level: node.type === LIST ? numberAttr(node.attrs, 'level') : 0,
            checked: false,
            align: textAttr(node.attrs, 'align'),
          });
        }
      }
      dispatch(tr);
    }
    return true;
  };
}

/** The selected to-do items ticked, or all unticked when every one already is (⌘Enter, the
 *  keyboard's way to tick a box). False when the selection holds no to-do item, so the key falls
 *  through. */
export const toggleTodoChecked: Command = (state, dispatch) => {
  const todos = selectedBlocks(state).filter(
    ({ node }) => node.type === LIST && node.attrs.list === 'todo',
  );
  if (todos.length === 0) return false;
  if (dispatch) {
    const checked = !todos.every(({ node }) => node.attrs.checked === true);
    const tr = state.tr;
    for (const { pos } of todos) tr.setNodeAttribute(pos, 'checked', checked);
    dispatch(tr);
  }
  return true;
};

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
            id: textAttr(node.attrs, 'id'),
            style: 'body',
            align: textAttr(node.attrs, 'align'),
          });
        else
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            level: Math.min(ARTICLE_LIST_MAX_LEVEL, level),
          });
      }
      dispatch(tr);
    }
    return true;
  };
}

export function setAlign(align: ArticleAlign): Command {
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
