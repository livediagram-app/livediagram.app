// The writing editor's own plugins (docs/specs/007-editor/article-pages.md "Blocks", "Writing"):
// every block keeps one unique id (a split or a paste copies attributes, ids included); a list's
// markers and an empty block's placeholder are drawn as decorations, never stored; and a press on
// a to-do's box ticks it.
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { articleListMarkers, nextArticleBlockId } from '@livedocuments/document';
import { articleSchema, listAttr, numberAttr } from './article-schema';

/** Every top-level block with an id of its own: a missing or repeated id is given a fresh one. */
export const blockIdsPlugin = new Plugin({
  key: new PluginKey('article-block-ids'),
  appendTransaction(trs, _old, state) {
    if (!trs.some((tr) => tr.docChanged)) return null;
    const seen = new Set<string>();
    let tr: Transaction | null = null;
    state.doc.forEach((node, offset) => {
      const id = node.attrs.id as string | undefined;
      if (id && !seen.has(id)) {
        seen.add(id);
        return;
      }
      const fresh = nextArticleBlockId(seen);
      seen.add(fresh);
      tr ??= state.tr;
      tr.setNodeAttribute(offset, 'id', fresh);
    });
    if (tr) (tr as Transaction).setMeta('addToHistory', false);
    return tr;
  },
});

// What an empty block says to someone writing.
const PLACEHOLDER: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  quote: 'Quote',
  list: 'List',
  todo: 'To-do',
};
const FIRST_BODY_PLACEHOLDER = 'Start writing, or press / for blocks';

const HEADING_STYLES = new Set(['title', 'h1', 'h2', 'h3']);

/** An empty heading or table header cell, named for a screen reader (docs/specs/007-editor/article-pages.md
 *  "Blocks"): a writer hears the placeholder, a reader has the empty heading hidden. A decoration, not
 *  schema output, so the name goes the moment the block holds text. */
export function emptyNameDecorations(doc: PMNode, editable: boolean): Decoration[] {
  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.content.size === 0) {
      if (node.type === articleSchema.nodes.table_header) {
        decos.push(Decoration.node(pos, pos + node.nodeSize, { 'aria-label': 'Column header' }));
      } else if (
        node.type === articleSchema.nodes.paragraph &&
        HEADING_STYLES.has(node.attrs.style as string)
      ) {
        decos.push(
          Decoration.node(
            pos,
            pos + node.nodeSize,
            editable
              ? { 'aria-label': PLACEHOLDER[node.attrs.style as string] ?? 'Heading' }
              : { 'aria-hidden': 'true' },
          ),
        );
      }
    }
    return false;
  });
  return decos;
}

function decorations(state: EditorState, editable: boolean): DecorationSet {
  const decos: Decoration[] = [];
  const blocks: {
    id: string;
    type: string;
    list?: 'bullet' | 'numbered' | 'todo';
    level?: number;
  }[] = [];
  const positions = new Map<string, number>();
  state.doc.forEach((node, offset) => {
    const id = node.attrs.id as string;
    positions.set(id, offset);
    blocks.push(
      node.type === articleSchema.nodes.list_item
        ? {
            id,
            type: 'list',
            list: listAttr(node.attrs),
            level: numberAttr(node.attrs, 'level'),
          }
        : { id, type: node.type.name },
    );
  });
  for (const [id, marker] of articleListMarkers(blocks)) {
    const at = positions.get(id);
    const node = at === undefined ? null : state.doc.nodeAt(at);
    if (node && at !== undefined)
      decos.push(Decoration.node(at, at + node.nodeSize, { 'data-marker': marker }));
  }
  if (editable) {
    // Headings, quotes and list items always say what they are when empty; an empty body paragraph
    // invites writing while it is the first one in a short article, else only while the caret is
    // in it.
    const caret = state.selection.empty ? state.selection.$from : null;
    const caretBlock = caret && caret.depth > 0 ? caret.before(1) : -1;
    let firstBody = true;
    state.doc.forEach((node: PMNode, offset) => {
      const isList = node.type === articleSchema.nodes.list_item;
      if (!isList && node.type !== articleSchema.nodes.paragraph) return;
      const style = isList
        ? node.attrs.list === 'todo'
          ? 'todo'
          : 'list'
        : (node.attrs.style as string);
      const isFirstBody = style === 'body' && firstBody;
      if (style === 'body') firstBody = false;
      if (node.content.size > 0) return;
      // A ticked to-do's ::after is its tick (article-pages.css), so it has no placeholder.
      if (isList && node.attrs.checked === true) return;
      const text =
        PLACEHOLDER[style] ??
        (isFirstBody && state.doc.childCount <= 3
          ? FIRST_BODY_PLACEHOLDER
          : offset === caretBlock
            ? 'Type / for blocks'
            : null);
      if (!text) return;
      decos.push(
        Decoration.node(offset, offset + node.nodeSize, {
          class: 'article-empty',
          'data-placeholder': text,
        }),
      );
    });
  }
  decos.push(...emptyNameDecorations(state.doc, editable));
  return DecorationSet.create(state.doc, decos);
}

// The top-level block holding a collapsed caret, when that block is empty (the one placeholder the caret decides),
// else -1.
function caretEmptyBlock(state: EditorState): number {
  const sel = state.selection;
  if (!sel.empty || sel.$from.depth === 0) return -1;
  return sel.$from.node(1).content.size === 0 ? sel.$from.before(1) : -1;
}

// Whether a change keeps everything the markers and placeholders are worked out from: the same top-level blocks, each
// changed one a textblock with the same markup that stays empty or stays filled. Typing into a block is such a
// change; a block added, removed or restyled, a table edited, or a block emptied or filled is not.
function sameShape(a: PMNode, b: PMNode): boolean {
  if (a.childCount !== b.childCount) return false;
  for (let i = 0; i < a.childCount; i++) {
    const was = a.child(i);
    const now = b.child(i);
    if (was === now) continue;
    if (!was.isTextblock || !was.sameMarkup(now)) return false;
    if ((was.content.size === 0) !== (now.content.size === 0)) return false;
  }
  return true;
}

type DecorationsState = { set: DecorationSet; editable: boolean; caretEmpty: number };

const decorationsKey = new PluginKey<DecorationsState>('article-decorations');

/** List markers and placeholders. `isEditable` is read live: a viewer sees no placeholders. They are worked out from
 *  the whole article, so they are kept in plugin state and only moved with the text by a change that keeps the
 *  article's shape (docs/specs/008-canvas/canvas-performance.md): working them out on every key and caret move cost
 *  about 2 ms a key on a 50-page article. */
export function decorationsPlugin(isEditable: () => boolean): Plugin<DecorationsState> {
  const fresh = (state: EditorState): DecorationsState => {
    const editable = isEditable();
    return { set: decorations(state, editable), editable, caretEmpty: caretEmptyBlock(state) };
  };
  return new Plugin<DecorationsState>({
    key: decorationsKey,
    state: {
      init: (_config, state) => fresh(state),
      apply(tr, prev, _old, state) {
        const caretEmpty = caretEmptyBlock(state);
        if (prev.editable !== isEditable()) return fresh(state);
        if (!tr.docChanged) return caretEmpty === prev.caretEmpty ? prev : fresh(state);
        const caretWas = prev.caretEmpty < 0 ? -1 : tr.mapping.map(prev.caretEmpty);
        if (caretEmpty !== caretWas || !sameShape(tr.before, tr.doc)) return fresh(state);
        return { set: prev.set.map(tr.mapping, tr.doc), editable: prev.editable, caretEmpty };
      },
    },
    props: {
      decorations(state) {
        const kept = decorationsKey.getState(state);
        // Editable changed with no transaction since: worked out for this draw, kept by the next transaction.
        return kept && kept.editable === isEditable() ? kept.set : decorations(state, isEditable());
      },
    },
  });
}

/** A press on a to-do's box (the gutter before its text) ticks or unticks it, one edit. */
export function todoTogglePlugin(isEditable: () => boolean): Plugin {
  return new Plugin({
    key: new PluginKey('article-todo-toggle'),
    props: {
      handleDOMEvents: {
        mousedown(view: EditorView, event: MouseEvent) {
          const li = (event.target as HTMLElement | null)?.closest?.('li.article-list-todo');
          if (!li || !isEditable()) return false;
          const box = li.getBoundingClientRect();
          const scale = box.width / (li as HTMLElement).offsetWidth || 1;
          const padding = parseFloat(getComputedStyle(li).paddingLeft) * scale;
          if (event.clientX > box.left + padding) return false;
          const pos = view.posAtDOM(li, 0) - 1;
          const node = view.state.doc.nodeAt(pos);
          if (!node || node.type !== articleSchema.nodes.list_item) return false;
          event.preventDefault();
          view.dispatch(view.state.tr.setNodeAttribute(pos, 'checked', !node.attrs.checked));
          return true;
        },
      },
    },
  });
}
