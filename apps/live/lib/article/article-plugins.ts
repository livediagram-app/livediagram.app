// The writing editor's own plugins (docs/specs/007-editor/article-pages.md "Blocks", "Writing"):
// every block keeps one unique id (a split or a paste copies attributes, ids included); a list's
// markers and an empty block's placeholder are drawn as decorations, never stored; and a press on
// a to-do's box ticks it.
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { articleListMarkers, nextArticleBlockId } from '@livediagram/document';
import { articleSchema } from './article-schema';

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
export const FIRST_BODY_PLACEHOLDER = 'Start writing, or press / for blocks';

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
        ? { id, type: 'list', list: node.attrs.list, level: node.attrs.level }
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
  return DecorationSet.create(state.doc, decos);
}

/** List markers and placeholders. `isEditable` is read live: a viewer sees no placeholders. */
export function decorationsPlugin(isEditable: () => boolean): Plugin {
  return new Plugin({
    key: new PluginKey('article-decorations'),
    props: { decorations: (state) => decorations(state, isEditable()) },
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
