// The command menu's keyboard model (docs/specs/004-interface-design/menus.md "Keyboard"), pure:
// what a key press means, where a move lands, and what typed letters find. The DOM half lives in
// useMenu.

import { MENU_TYPEAHEAD_RESET_MS } from './menu-constants';

export type MenuKeyEvent = {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type MenuMove = 'next' | 'previous' | 'first' | 'last';

export type MenuKeyIntent =
  | { kind: 'move'; to: MenuMove }
  | { kind: 'activate' }
  | { kind: 'enter-submenu' }
  | { kind: 'leave-submenu' }
  | { kind: 'close' }
  | { kind: 'tab'; backwards: boolean }
  | { kind: 'type'; char: string };

/** Where focus lands when a menu opens; `checked` falls back to the first item. */
export type MenuInitialFocus = 'checked' | 'first' | 'last' | 'none';

const MOVES: Record<string, MenuMove> = {
  ArrowDown: 'next',
  ArrowUp: 'previous',
  Home: 'first',
  End: 'last',
};

/**
 * What a key press means to a command menu, or null to leave it to the browser. `searching` is a typeahead search
 * still building (typeaheadActive): a space typed inside one joins it ("move t" finds Move to Trash), where with no search under way
 * it presses the focused row.
 */
export function menuKeyIntent(
  e: MenuKeyEvent,
  at: { inSubmenu: boolean; onSubmenuTrigger: boolean; searching?: boolean },
): MenuKeyIntent | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const move = MOVES[e.key];
  if (move) return { kind: 'move', to: move };
  if (e.key === ' ' && at.searching) return { kind: 'type', char: ' ' };
  if (e.key === 'Enter' || e.key === ' ') return { kind: 'activate' };
  if (e.key === 'ArrowRight') return at.onSubmenuTrigger ? { kind: 'enter-submenu' } : null;
  if (e.key === 'ArrowLeft') return at.inSubmenu ? { kind: 'leave-submenu' } : null;
  if (e.key === 'Escape') return { kind: 'close' };
  if (e.key === 'Tab') return { kind: 'tab', backwards: e.shiftKey };
  // A printable character is one code point long; named keys (F5, Shift) are words.
  if ([...e.key].length === 1) return { kind: 'type', char: e.key.toLowerCase() };
  return null;
}

/** The index a move lands on, wrapping; -1 in an empty menu. */
export function moveIndex(current: number, count: number, to: MenuMove): number {
  if (count === 0) return -1;
  if (to === 'first') return 0;
  if (to === 'last') return count - 1;
  if (current < 0) return to === 'next' ? 0 : count - 1;
  const step = to === 'next' ? 1 : -1;
  return (current + step + count) % count;
}

export type TypeaheadState = { query: string; at: number };

/** Whether a typeahead search is still building at `now`: something typed, inside the reset window. */
export function typeaheadActive(state: TypeaheadState, now: number): boolean {
  return state.query !== '' && now - state.at < MENU_TYPEAHEAD_RESET_MS;
}

/** The search after one more typed character: it builds inside the reset window, else restarts. */
export function typeaheadQuery(prev: TypeaheadState, char: string, now: number): TypeaheadState {
  return { query: typeaheadActive(prev, now) ? prev.query + char : char, at: now };
}

/**
 * The next label starting with `query`, wrapping; -1 when none. A first letter searches from after
 * `current`; a search being built ("mo" after "m") from `current` itself, which the letters before
 * already found, so focus stays put while it still matches rather than hopping between the items
 * that share the start. One letter typed again ("dd") searches for that letter alone, so repeating
 * it cycles the items that share it.
 */
export function typeaheadIndex(labels: readonly string[], current: number, query: string): number {
  if (labels.length === 0 || query === '') return -1;
  const repeated = [...query].every((c) => c === query[0]);
  const needle = repeated ? query[0]! : query;
  // With nothing focused (-1), step 1 is the first item.
  const first = repeated || current < 0 ? 1 : 0;
  for (let step = first; step < labels.length + first; step += 1) {
    const index = (current + step + labels.length) % labels.length;
    if (labels[index]!.trim().toLowerCase().startsWith(needle)) return index;
  }
  return -1;
}

/** Where focus lands on open, given which items are checked; -1 for none or an empty menu. */
export function initialIndex(checked: readonly boolean[], focus: MenuInitialFocus): number {
  if (checked.length === 0 || focus === 'none') return -1;
  if (focus === 'last') return checked.length - 1;
  if (focus === 'checked') return Math.max(0, checked.indexOf(true));
  return 0;
}
