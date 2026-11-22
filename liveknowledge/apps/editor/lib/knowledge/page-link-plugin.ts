// Page links in the writing (docs/specs/030-knowledgebase/links-and-embeds.md "Page links"), one ProseMirror plugin:
// - `[[` typed in the writing opens the page picker, what is typed after it filters it, and it closes when the caret
//   leaves, on `]`, a line break, past 60 characters or on Escape (which leaves the text as typed);
// - a link is one thing to the caret: it never rests inside one, and Backspace or Delete beside one takes it whole;
// - a press on a link opens its page (the host's `onOpen`), a pasted address of a page becomes a link to it.
// Modelled on the slash menu's trigger (lib/article/article-slash.ts); the picker itself is drawn by the host
// through the bridge, with the slash menu's own popover.
import { Plugin, PluginKey, TextSelection, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import { articleSchema } from '@/lib/article/article-schema';

export type PageLinkQuery = { active: false } | { active: true; from: number; query: string };

export const PAGE_LINK_QUERY_MAX = 60;
const TRIGGER = '[[';

export type PageLinkBridge = {
  // The picker's state changed (opened, filtered, closed).
  onChange: (state: PageLinkQuery, view: EditorView) => void;
  // A key while it is open: true when the picker took it.
  onKey: (key: 'up' | 'down' | 'enter') => boolean;
  // A press on a link to `page`.
  onOpen: (page: string) => void;
  // The page a pasted address names, when it is a page of this knowledgebase.
  pageOfUrl: (text: string) => string | undefined;
  // Whether this session may put a link in (an Editor writing).
  canInsert: () => boolean;
};

export const pageLinkKey = new PluginKey<PageLinkQuery>('page-link');

const CLOSED: PageLinkQuery = { active: false };
const pageLink = articleSchema.marks.pageLink;

function stateAfter(prev: PageLinkQuery, state: EditorState, typed: boolean): PageLinkQuery {
  const sel = state.selection;
  if (!sel.empty) return CLOSED;
  const $head = sel.$head;
  if ($head.depth < 1 || $head.parent.type.spec.code) return CLOSED;
  if (prev.active) {
    const { from } = prev;
    if (from < $head.start() || from + TRIGGER.length > $head.pos) return CLOSED;
    if (state.doc.textBetween(from, from + TRIGGER.length) !== TRIGGER) return CLOSED;
    const query = state.doc.textBetween(from + TRIGGER.length, $head.pos, '\n', '\n');
    if (query.length > PAGE_LINK_QUERY_MAX || /[\]\n]/.test(query)) return CLOSED;
    return { active: true, from, query };
  }
  // The one check a keystroke pays for: the two characters before the caret.
  if (!typed || $head.parentOffset < TRIGGER.length) return CLOSED;
  const before = $head.parent.textBetween($head.parentOffset - TRIGGER.length, $head.parentOffset);
  return before === TRIGGER
    ? { active: true, from: $head.pos - TRIGGER.length, query: '' }
    : CLOSED;
}

/** The link the position is strictly inside, as its range; null at a link's edge or outside one. */
function linkAround(state: EditorState, pos: number): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos);
  if (!$pos.parent.isTextblock) return null;
  const before = $pos.nodeBefore;
  const after = $pos.nodeAfter;
  const mark = before && after ? pageLink.isInSet(before.marks) : undefined;
  if (!mark || !after || !mark.isInSet(after.marks)) return null;
  return linkBeside(state, pos, -1);
}

/** The link that ends (`side` -1) or starts (`side` 1) at the position, as its whole range. */
function linkBeside(
  state: EditorState,
  pos: number,
  side: -1 | 1,
): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos);
  if (!$pos.parent.isTextblock) return null;
  const beside = side < 0 ? $pos.nodeBefore : $pos.nodeAfter;
  const mark = beside ? pageLink.isInSet(beside.marks) : undefined;
  if (!mark) return null;
  const parent = $pos.parent;
  const start = $pos.start();
  let index = $pos.index() - (side < 0 ? 1 : 0);
  // An offset inside a text node counts as that node's own index.
  if (side < 0 && $pos.textOffset > 0) index = $pos.index();
  let first = index;
  let last = index;
  while (first > 0 && mark.isInSet(parent.child(first - 1).marks)) first--;
  while (last < parent.childCount - 1 && mark.isInSet(parent.child(last + 1).marks)) last++;
  let from = start;
  for (let i = 0; i < first; i++) from += parent.child(i).nodeSize;
  let to = from;
  for (let i = first; i <= last; i++) to += parent.child(i).nodeSize;
  return { from, to };
}

export function pageLinkPlugin(bridge: PageLinkBridge): Plugin<PageLinkQuery> {
  return new Plugin<PageLinkQuery>({
    key: pageLinkKey,
    state: {
      init: () => CLOSED,
      apply(tr, prev, _old, next) {
        const meta: unknown = tr.getMeta(pageLinkKey);
        if (meta === 'close') return CLOSED;
        if (!tr.docChanged && !tr.selectionSet) return prev;
        const mapped: PageLinkQuery = prev.active
          ? { ...prev, from: tr.mapping.map(prev.from) }
          : prev;
        // Opened by typing (or by the slash menu's Link to Page, which says so), never by a remote change or a paste.
        const typed =
          meta === 'open' ||
          (tr.docChanged && tr.getMeta('uiEvent') !== 'paste' && !tr.getMeta('article-remote'));
        return bridge.canInsert() ? stateAfter(mapped, next, typed) : CLOSED;
      },
    },
    // A caret that lands inside a link moves to its edge, onward in the direction it was going.
    appendTransaction(_trs, old, state) {
      const sel = state.selection;
      if (!sel.empty) return null;
      const inside = linkAround(state, sel.head);
      if (!inside) return null;
      const forward = sel.head >= old.selection.head;
      return state.tr.setSelection(
        TextSelection.create(state.doc, forward ? inside.to : inside.from),
      );
    },
    view: () => {
      let last: PageLinkQuery = CLOSED;
      return {
        update(view) {
          const now = pageLinkKey.getState(view.state) ?? CLOSED;
          if (now === last) return;
          last = now;
          bridge.onChange(now, view);
        },
        destroy() {
          last = CLOSED;
        },
      };
    },
    props: {
      handleKeyDown(view, event) {
        const s = pageLinkKey.getState(view.state);
        if (s?.active) {
          if (event.key === 'Escape') {
            // The text stays as typed.
            view.dispatch(view.state.tr.setMeta(pageLinkKey, 'close'));
            return true;
          }
          const key =
            event.key === 'ArrowDown'
              ? 'down'
              : event.key === 'ArrowUp'
                ? 'up'
                : event.key === 'Enter' || event.key === 'Tab'
                  ? 'enter'
                  : null;
          return key ? bridge.onKey(key) : false;
        }
        // Backspace after a link, or Delete before one, takes the whole link.
        if (event.key !== 'Backspace' && event.key !== 'Delete') return false;
        const sel = view.state.selection;
        if (!sel.empty || !view.editable) return false;
        const link = linkBeside(view.state, sel.head, event.key === 'Backspace' ? -1 : 1);
        if (!link) return false;
        view.dispatch(view.state.tr.delete(link.from, link.to).scrollIntoView());
        return true;
      },
      handleDOMEvents: {
        // The click itself, not ProseMirror's press: in a reader's view the anchor would otherwise follow its own
        // address.
        click(_view, event) {
          const target = event.target instanceof Element ? event.target : null;
          const link = target?.closest<HTMLElement>('a.article-page-link');
          const page = link?.dataset.page;
          if (!link || !page) return false;
          // With a modifier held the link's own address opens the page in a new tab.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return false;
          event.preventDefault();
          bridge.onOpen(page);
          return true;
        },
      },
      handlePaste(view, event) {
        if (!bridge.canInsert()) return false;
        const text = event.clipboardData?.getData('text/plain').trim() ?? '';
        if (!text || /\s/.test(text)) return false;
        const page = bridge.pageOfUrl(text);
        if (!page) return false;
        insertPageLink(view, page, text, view.state.selection.from, view.state.selection.to);
        return true;
      },
    },
  });
}

/** A link to `page` put over `from`..`to`, the caret after it. `text` is the words stored with it (the page's
 *  title when it was linked); what shows is always the page's current title. */
export function insertPageLink(
  view: EditorView,
  page: string,
  text: string,
  from: number,
  to: number,
): void {
  const node = articleSchema.text(text || 'Page', [pageLink.create({ page })]);
  const tr = view.state.tr.replaceWith(from, to, node);
  tr.setSelection(TextSelection.create(tr.doc, from + node.nodeSize));
  view.dispatch(tr.setMeta(pageLinkKey, 'close').scrollIntoView());
}

/** The picker chose: the `[[` and what was typed after it give way to the link. */
export function pickPageLink(view: EditorView, page: string, title: string): void {
  const s = pageLinkKey.getState(view.state);
  if (!s?.active) return;
  insertPageLink(view, page, title, s.from, view.state.selection.head);
}

/** Open the picker at the caret (the slash menu's Link to Page): `[[` is typed for the person. */
export function openPageLinkPicker(view: EditorView): void {
  view.dispatch(view.state.tr.insertText(TRIGGER).setMeta(pageLinkKey, 'open'));
}
