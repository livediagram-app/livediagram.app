// Send to Plan in an article's writing (livedocuments' and liveknowledge's docs/specs/013-workspace/send-to-plan.md
// "What it sends", "The chip"), its ProseMirror side: what a send from the writing names (the block the caret or the
// words picked are in, and those words), a sent block's chip after its last word, and, for a reader who cannot write
// there, the Send to Plan pill under the words picked (both drawn by article-send-dom).
//
// This package holds no ProseMirror of its own: each editor hands in its own Decoration and DecorationSet (`draw`) and
// builds its Plugin from `articleSentSpec`, so one copy of ProseMirror runs and the types below are only the few
// shapes read here.
import { elementSends, onSendsChanged } from './send-store';
import {
  hideReadSendPill,
  sentChipDom,
  showReadSendPill,
  type ArticlePick,
} from './article-send-dom';

type PMNode = {
  readonly attrs: { readonly [attr: string]: unknown };
  readonly isTextblock: boolean;
  readonly nodeSize: number;
  readonly textContent: string;
};
type PMResolved = { readonly depth: number; node(depth: number): PMNode; readonly parent: PMNode };
type PMDoc = PMNode & {
  forEach(f: (node: PMNode, offset: number, index: number) => void): void;
  readonly content: { readonly size: number };
  resolve(pos: number): PMResolved;
  textBetween(
    from: number,
    to: number,
    blockSeparator?: string | null,
    leafText?: string | null,
  ): string;
};
type PMTr = { setMeta(key: string, value: unknown): PMTr; getMeta(key: string): unknown };
/** The editor state, as read here. */
export type PMState = {
  readonly doc: PMDoc;
  readonly selection: { readonly from: number; readonly to: number; readonly $from: PMResolved };
  readonly tr: PMTr;
};
type PMView = {
  readonly state: PMState;
  readonly dom: Element;
  readonly isDestroyed: boolean;
  dispatch(tr: PMTr): void;
  posAtDOM(node: Node, offset: number): number;
};

/** The editor's own decoration makers, over its own document (`State['doc']`). */
export type ArticleSentDraw<Deco, Set, State extends PMState> = {
  widget: (
    pos: number,
    toDOM: () => Node,
    spec: { side: number; marks: []; ignoreSelection: boolean; key: string },
  ) => Deco;
  set: (doc: State['doc'], decos: Deco[]) => Set;
  empty: Set;
};

// The meta a chips-only redraw carries.
const SENT = 'article-sent';

/** The words a send takes: those picked (in one block or several), else those of the paragraph, item or table cell the
 *  caret is in; null with none. The place is the top-level block they start in. */
export function articleSendPick(state: PMState): ArticlePick | null {
  const { from, to, $from } = state.selection;
  if ($from.depth < 1) return null;
  const blockId = $from.node(1).attrs.id;
  if (typeof blockId !== 'string' || !blockId) return null;
  const text = (
    from < to ? state.doc.textBetween(from, to, '\n', ' ') : $from.parent.textContent
  ).trim();
  return text ? { blockId, text } : null;
}

/** A transaction that only redraws the chips: no commit, no toolbar update. */
export const onlySent = (tr: PMTr): boolean => tr.getMeta(SENT) === true;

// The words a reader picked in this writing, as the browser holds them, or null (none, or outside it).
function readerPick(view: PMView): { pick: ArticlePick; rect: DOMRect } | null {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!view.dom.contains(range.startContainer) || !view.dom.contains(range.endContainer))
    return null;
  const text = sel.toString().trim();
  const at = view.posAtDOM(range.startContainer, range.startOffset);
  const $at = view.state.doc.resolve(Math.min(at, view.state.doc.content.size));
  const blockId = $at.depth > 0 ? $at.node(1).attrs.id : null;
  if (!text || typeof blockId !== 'string' || !blockId) return null;
  return { pick: { blockId, text }, rect: range.getBoundingClientRect() };
}

/**
 * The plugin's spec: the chips, kept live (redrawn whenever the open item's sends change), and the reader's pill:
 * while the writing is not `editable`, words picked in it show Send to Plan under them.
 */
export function articleSentSpec<Deco, Set, State extends PMState>(
  editable: () => boolean,
  draw: ArticleSentDraw<Deco, Set, State>,
) {
  // Each sent block's chip, after its last word.
  const decorations = (state: State): Set => {
    const decos: Deco[] = [];
    state.doc.forEach((node, pos) => {
      const id = node.attrs.id;
      if (typeof id !== 'string' || !node.isTextblock) return;
      const sends = elementSends(id);
      const newest = sends[0];
      if (!newest) return;
      decos.push(
        draw.widget(pos + node.nodeSize - 1, () => sentChipDom(sends), {
          side: 1,
          marks: [],
          ignoreSelection: true,
          key: `sent:${id}:${newest.id}:${newest.card.column}:${newest.card.done}:${sends.length}`,
        }),
      );
    });
    return decos.length > 0 ? draw.set(state.doc, decos) : draw.empty;
  };
  return {
    props: { decorations },
    view(view: PMView) {
      const stop = onSendsChanged(() => {
        if (!view.isDestroyed)
          view.dispatch(view.state.tr.setMeta(SENT, true).setMeta('addToHistory', false));
      });
      const onSelection = () => {
        const read = editable() ? null : readerPick(view);
        if (!read) return hideReadSendPill();
        const { pick, rect } = read;
        showReadSendPill({ left: rect.left, bottom: rect.bottom }, () => pick);
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
  };
}
