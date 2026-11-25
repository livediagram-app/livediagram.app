// The selection menu in an article's writing (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection
// menu", Work Tracker 1462), its ProseMirror side: a right-click on the words picked opens it at the pointer, and on a
// touch screen it docks to the screen's edge once a long press's words hold still, clear of the browser's own callout
// (which no mobile browser lets a page replace). SendToPlanHost draws it (SelectionMenu.tsx).
import { PRESS_HOLD_MS } from '../send-to-plan/press-hold';
import { canSendHere } from '../send-to-plan/send-to-plan-entry';
import { canSendDiagramHere } from '../send-to-diagram/send-to-diagram-entry';
import {
  sendArticleWords,
  sendArticleWordsToDiagram,
  type ArticlePick,
} from '../send-to-plan/article-send-dom';
import { pasteClipboard, runClipboardCommand, writeClipboardText } from './selection-clipboard';
import {
  closeSelectionMenu,
  onSelectionMenuChange,
  openSelectionMenu,
  SELECTION_MENU_ATTR,
  type SelectionMenuActions,
  type SelectionMenuAsk,
} from './selection-menu-store';
import type { MenuPoint } from '../primitives/usePortalMenuPlacement';

type PMTr = { deleteSelection(): PMTr };

/** The writing's view, as read here. */
export type SelectionView = {
  readonly dom: HTMLElement;
  readonly isDestroyed: boolean;
  readonly state: {
    readonly doc: {
      readonly content: { readonly size: number };
      resolve(pos: number): {
        readonly depth: number;
        node(depth: number): { readonly attrs: { readonly [attr: string]: unknown } };
      };
    };
    readonly tr: PMTr;
  };
  posAtDOM(node: Node, offset: number): number;
  dispatch(tr: PMTr): void;
  focus(): void;
  pasteHTML(html: string, event?: ClipboardEvent): boolean;
  pasteText(text: string, event?: ClipboardEvent): boolean;
};

/** How long a touch selection holds still before the menu docks (a long press's word, a handle let go). */
export const DOCK_SETTLE_MS = 350;
/** The docked menu's gap from the screen's edge. */
export const DOCK_MARGIN_PX = 12;
/** The room the docked menu takes at the screen's foot (five rows and their padding): words lower than this dock it
 *  at the top instead, so it never covers them. */
export const DOCK_ROOM_PX = 260;
// The menu's width (PortalMenu's w-56), to centre it.
const MENU_WIDTH_PX = 224;
// Slack round the words' boxes for a right-click on their edge.
const HIT_SLOP_PX = 2;

/** The words picked in the writing as the browser holds them: the send's pick, their range and their text. */
export type LivePick = { pick: ArticlePick; range: Range; text: string };

/** The words picked in this writing, or null (none, outside it, or in no block with an id). */
export function livePick(view: SelectionView): LivePick | null {
  const sel = document.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!view.dom.contains(range.startContainer) || !view.dom.contains(range.endContainer))
    return null;
  const text = sel.toString();
  const at = view.posAtDOM(range.startContainer, range.startOffset);
  const $at = view.state.doc.resolve(Math.min(at, view.state.doc.content.size));
  const blockId = $at.depth > 0 ? $at.node(1).attrs.id : null;
  if (!text.trim() || typeof blockId !== 'string' || !blockId) return null;
  return { pick: { blockId, text: text.trim() }, range, text };
}

/** Whether a point is on the words (any of their line boxes, give or take a hair). */
export function onWords(range: Range, x: number, y: number): boolean {
  for (const r of Array.from(range.getClientRects()))
    if (
      x >= r.left - HIT_SLOP_PX &&
      x <= r.right + HIT_SLOP_PX &&
      y >= r.top - HIT_SLOP_PX &&
      y <= r.bottom + HIT_SLOP_PX
    )
      return true;
  return false;
}

/** The screen the page shows: the visual viewport (above an on-screen keyboard), in the page's fixed coordinates. */
export function screenBox(): { top: number; left: number; width: number; height: number } {
  const vv = window.visualViewport;
  return vv
    ? { top: vv.offsetTop, left: vv.offsetLeft, width: vv.width, height: vv.height }
    : { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
}

/** Where the docked menu sits: centred at the screen's foot, or at its top while the words are low on the screen. */
export function dockSpot(
  words: { top: number; bottom: number },
  screen: { top: number; left: number; width: number; height: number },
): { at: MenuPoint; placement: SelectionMenuAsk['placement'] } {
  const foot = screen.top + screen.height - DOCK_MARGIN_PX;
  const x = screen.left + Math.max(DOCK_MARGIN_PX, (screen.width - MENU_WIDTH_PX) / 2);
  const low = words.bottom > foot - DOCK_ROOM_PX;
  const roomAbove = words.top > screen.top + DOCK_MARGIN_PX + DOCK_ROOM_PX;
  if (low && roomAbove)
    return { at: { x, y: screen.top + DOCK_MARGIN_PX }, placement: 'below-start' };
  return { at: { x, y: foot }, placement: 'above-start' };
}

// The keyboard's menu key (or Shift+F10): a contextmenu with no pointer behind it.
function fromKeyboard(e: MouseEvent): boolean {
  if ((e as Partial<PointerEvent>).pointerType === '') return true;
  return e.button === 0 && !e.ctrlKey && e.clientX === 0 && e.clientY === 0;
}

/**
 * Binds the menu to a writing; answers the unbind. `editable` says whether the words can be changed now (Cut and
 * Paste show only then). Only while the session may send: elsewhere the browser's own menu is left alone.
 */
export function bindSelectionMenu(view: SelectionView, editable: () => boolean): () => void {
  // The pointer of the last press, so a touch's long press (a contextmenu on Android) is left to the dock.
  let pointer = 'mouse';
  // When a press on the menu began: a tap on a row clears the words before its click lands, and the menu stays for it.
  let menuPressAt = Number.NEGATIVE_INFINITY;
  let open: number | null = null;
  let settle: ReturnType<typeof setTimeout> | null = null;

  const close = () => {
    if (open !== null) closeSelectionMenu(open);
    open = null;
  };
  const show = (ask: Omit<SelectionMenuAsk, 'anchor' | 'actions'>, live: LivePick) => {
    open = openSelectionMenu({ ...ask, anchor: view.dom, actions: actionsFor(live) });
  };
  const cancelSettle = () => {
    if (settle !== null) clearTimeout(settle);
    settle = null;
  };

  // The rows' verbs, on the words as the menu found them.
  const actionsFor = ({ pick, range, text }: LivePick): SelectionMenuActions => {
    const saved = range.cloneRange();
    const writable = editable();
    // The words picked again: while editing, the caret back in the writing on them (ProseMirror keeps them through
    // the menu's focus); reading, the page's selection as it was, which a tap on the menu may have cleared.
    const restore = () => {
      if (writable) return view.focus();
      const sel = document.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(saved);
    };
    const clip = (kind: 'copy' | 'cut') => () => {
      restore();
      if (runClipboardCommand(kind)) return;
      // The browser refused its own command: the words as plain text, and a cut takes them once they are on it.
      void writeClipboardText(text).then((ok) => {
        if (ok && kind === 'cut' && !view.isDestroyed)
          view.dispatch(view.state.tr.deleteSelection());
      });
    };
    return {
      cut: writable ? clip('cut') : null,
      copy: clip('copy'),
      paste: writable ? () => void pasteClipboard(view) : null,
      sendToPlan: () => sendArticleWords(pick),
      sendToDiagram: canSendDiagramHere() ? () => sendArticleWordsToDiagram(pick) : null,
    };
  };

  const onPointerDown = (e: PointerEvent) => {
    pointer = e.pointerType || 'mouse';
    if (e.target instanceof Element && e.target.closest(`[${SELECTION_MENU_ATTR}]`))
      menuPressAt = Date.now();
  };

  const onContextMenu = (e: MouseEvent) => {
    if (pointer === 'touch' || e.shiftKey || !canSendHere()) return;
    const live = livePick(view);
    if (!live) return;
    const keyboard = fromKeyboard(e);
    if (!keyboard && !onWords(live.range, e.clientX, e.clientY)) return;
    e.preventDefault();
    cancelSettle();
    const words = live.range.getBoundingClientRect();
    show(
      {
        at: keyboard ? { x: words.left, y: words.bottom } : { x: e.clientX, y: e.clientY },
        placement: 'below-start',
        docked: false,
      },
      live,
    );
  };

  const dock = () => {
    settle = null;
    const live = livePick(view);
    if (!live || !canSendHere()) return;
    show({ ...dockSpot(live.range.getBoundingClientRect(), screenBox()), docked: true }, live);
  };

  const onSelection = () => {
    const live = livePick(view);
    if (!live) {
      cancelSettle();
      if (Date.now() - menuPressAt < PRESS_HOLD_MS) return;
      return close();
    }
    // A touch's words dock the menu once they hold still; it follows them as the handles move.
    if (pointer !== 'touch') return;
    cancelSettle();
    settle = setTimeout(dock, DOCK_SETTLE_MS);
  };

  // Any change to the menu (it closed from its side: a row, Escape, a press outside; or another opened) leaves this
  // writing's id stale, so the words going later close nothing. A show sets it again after its own change.
  const onMenu = () => {
    open = null;
  };

  document.addEventListener('pointerdown', onPointerDown, true);
  document.addEventListener('selectionchange', onSelection);
  view.dom.addEventListener('contextmenu', onContextMenu);
  const stopMenu = onSelectionMenuChange(onMenu);
  return () => {
    document.removeEventListener('pointerdown', onPointerDown, true);
    document.removeEventListener('selectionchange', onSelection);
    view.dom.removeEventListener('contextmenu', onContextMenu);
    stopMenu();
    cancelSettle();
    close();
  };
}
