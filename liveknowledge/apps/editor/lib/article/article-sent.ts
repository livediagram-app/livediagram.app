// Send to Plan in the writing (docs/specs/013-workspace/send-to-plan.md "What it sends", "The chip"): what a send from
// the writing names (the block the caret or the words picked are in, and those words), a sent block's chip at the end
// of its text, and, for a reader who cannot write here, the Send to Plan pill under the words picked. The chips and the
// pill are drawn by @liveworkspace/workbench (article-send-dom); this file is their ProseMirror side.
import { Plugin, PluginKey, type EditorState, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view';
import {
  elementSends,
  onSendsChanged,
} from '@liveworkspace/workbench/components/send-to-plan/send-store';
import {
  hideReadSendPill,
  sentChipDom,
  showReadSendPill,
  type ArticlePick,
} from '@liveworkspace/workbench/components/send-to-plan/article-send-dom';

const sentKey = new PluginKey('article-sent');

/** The words a send takes: those picked (in one block or several), else those of the paragraph, item or table cell the
 *  caret is in; null with none. The place is the top-level block they start in. */
export function articleSendPick(state: EditorState): ArticlePick | null {
  const { from, to, $from } = state.selection;
  if ($from.depth < 1) return null;
  const block = $from.node(1);
  const blockId = block.attrs.id as unknown;
  if (typeof blockId !== 'string' || !blockId) return null;
  const text = (
    from < to ? state.doc.textBetween(from, to, '\n', ' ') : $from.parent.textContent
  ).trim();
  return text ? { blockId, text } : null;
}

// Each sent block's chip, after its last word.
function sentDecorations(state: EditorState): DecorationSet {
  const decos: Decoration[] = [];
  state.doc.forEach((node, pos) => {
    const id = node.attrs.id as unknown;
    if (typeof id !== 'string' || !node.isTextblock) return;
    const sends = elementSends(id);
    const newest = sends[0];
    if (!newest) return;
    decos.push(
      Decoration.widget(pos + node.nodeSize - 1, () => sentChipDom(sends), {
        side: 1,
        marks: [],
        ignoreSelection: true,
        key: `sent:${id}:${newest.id}:${newest.card.column}:${newest.card.done}:${sends.length}`,
      }),
    );
  });
  return decos.length > 0 ? DecorationSet.create(state.doc, decos) : DecorationSet.empty;
}

/** A transaction that only redraws the chips: no commit, no toolbar update. */
export const onlySent = (tr: Transaction): boolean => tr.getMeta(sentKey) === true;

// The words a reader picked in this writing, as the browser holds them, or null (none, or outside it).
function readerPick(view: EditorView): { pick: ArticlePick; rect: DOMRect } | null {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!view.dom.contains(range.startContainer) || !view.dom.contains(range.endContainer))
    return null;
  const text = sel.toString().trim();
  const at = view.posAtDOM(range.startContainer, range.startOffset);
  const $at = view.state.doc.resolve(Math.min(at, view.state.doc.content.size));
  const blockId = $at.depth > 0 ? ($at.node(1).attrs.id as unknown) : null;
  if (!text || typeof blockId !== 'string' || !blockId) return null;
  return { pick: { blockId, text }, rect: range.getBoundingClientRect() };
}

/**
 * The chips, kept live (redrawn whenever the open item's sends change), and the reader's pill: while the writing is
 * not `editable`, words picked in it show Send to Plan under them.
 */
export function articleSentPlugin(editable: () => boolean): Plugin {
  return new Plugin({
    key: sentKey,
    props: { decorations: sentDecorations },
    view(view) {
      const stop = onSendsChanged(() => {
        if (!view.isDestroyed)
          view.dispatch(view.state.tr.setMeta(sentKey, true).setMeta('addToHistory', false));
      });
      const onSelection = () => {
        const read = editable() ? null : readerPick(view);
        showReadSendPill(read ? { left: read.rect.left, bottom: read.rect.bottom } : null, () =>
          read ? read.pick : null,
        );
      };
      document.addEventListener('selectionchange', onSelection);
      return {
        destroy() {
          stop();
          document.removeEventListener('selectionchange', onSelection);
          hideReadSendPill();
        },
      };
    },
  });
}
