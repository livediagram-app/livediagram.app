// The slash menu's trigger (docs/specs/007-editor/article-pages.md "Writing", "The slash menu"):
// a `/` typed at a block's start or after a space opens it; what is typed after it filters it; it
// closes when the caret leaves the `/`, on a space typed straight after it, past 24 characters, or
// on Escape. The keys it takes while open (Up, Down, Enter, Tab, Escape) go to the menu, which the
// writing's editor draws (SlashMenu) through a bridge.
import { Plugin, PluginKey, type EditorState } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';

export type SlashState = { active: false } | { active: true; from: number; query: string };

const SLASH_QUERY_MAX = 24;

export type SlashBridge = {
  // The menu's state changed (opened, filtered, closed).
  onChange: (state: SlashState, view: EditorView) => void;
  // A key while it is open: true when the menu took it.
  onKey: (key: 'up' | 'down' | 'enter' | 'escape') => boolean;
};

export const slashKey = new PluginKey<SlashState>('article-slash');

const CLOSED: SlashState = { active: false };

function stateAfter(prev: SlashState, state: EditorState, typed: boolean): SlashState {
  const sel = state.selection;
  if (!sel.empty) return CLOSED;
  const $head = sel.$head;
  if ($head.depth < 1 || $head.parent.type.spec.code) return CLOSED;
  if (prev.active) {
    const { from } = prev;
    if (from < $head.start() || from >= $head.pos || from >= state.doc.content.size) return CLOSED;
    if (state.doc.textBetween(from, from + 1) !== '/') return CLOSED;
    const query = state.doc.textBetween(from + 1, $head.pos, '\n', '\n');
    if (query.length > SLASH_QUERY_MAX || /^\s/.test(query) || query.includes('\n')) return CLOSED;
    return { active: true, from, query };
  }
  if (!typed) return CLOSED;
  const offset = $head.parentOffset;
  if (offset < 1) return CLOSED;
  const text = $head.parent.textBetween(Math.max(0, offset - 2), offset, '\n', '\n');
  if (!text.endsWith('/')) return CLOSED;
  const before = text.length > 1 ? text[0]! : '';
  if (offset > 1 && !/\s/.test(before)) return CLOSED;
  return { active: true, from: $head.pos - 1, query: '' };
}

export function slashPlugin(bridge: SlashBridge): Plugin<SlashState> {
  return new Plugin<SlashState>({
    key: slashKey,
    state: {
      init: () => CLOSED,
      apply(tr, prev, _old, next) {
        if (tr.getMeta(slashKey) === 'close') return CLOSED;
        if (!tr.docChanged && !tr.selectionSet) return prev;
        const mapped: SlashState = prev.active
          ? { ...prev, from: tr.mapping.map(prev.from) }
          : prev;
        // Opened only by typing, never by a remote change or a paste.
        const typed =
          tr.docChanged && tr.getMeta('uiEvent') !== 'paste' && !tr.getMeta('article-remote');
        return stateAfter(mapped, next, typed);
      },
    },
    view: () => {
      let last: SlashState = CLOSED;
      return {
        update(view) {
          const now = slashKey.getState(view.state) ?? CLOSED;
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
        const s = slashKey.getState(view.state);
        if (!s?.active) return false;
        const key =
          event.key === 'ArrowDown'
            ? 'down'
            : event.key === 'ArrowUp'
              ? 'up'
              : event.key === 'Enter' || event.key === 'Tab'
                ? 'enter'
                : event.key === 'Escape'
                  ? 'escape'
                  : null;
        if (!key) return false;
        if (key === 'escape') {
          view.dispatch(view.state.tr.setMeta(slashKey, 'close'));
          return true;
        }
        return bridge.onKey(key);
      },
    },
  });
}

/** The `/` and what was typed after it, taken out of the block (the menu chose). */
export function removeSlashQuery(view: EditorView): void {
  const s = slashKey.getState(view.state);
  if (!s?.active) return;
  view.dispatch(view.state.tr.delete(s.from, view.state.selection.head).setMeta(slashKey, 'close'));
}
