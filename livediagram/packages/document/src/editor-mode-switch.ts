// A switch of the tab's editor mode as one tab edit (docs/specs/007-editor/editor-modes.md "Where
// the mode lives"): the mode, and what entering it brings, together, so one undo puts the tab back
// in the mode it was in exactly as it was. Pure: tab in, tab out.
import { setTabOpensIn, type EditorMode } from './editor-mode';
import type { Tab } from './index';

export type EditorModeSwitch<T> = {
  tab: T;
};

/** The tab switched to `mode`, with what the mode brings; the same tab when it is already in it
 *  (or is an event-storming board). */
export function withEditorModeSwitched<T extends Tab>(
  tab: T,
  mode: EditorMode,
): EditorModeSwitch<T> {
  return { tab: setTabOpensIn(tab, mode) };
}
