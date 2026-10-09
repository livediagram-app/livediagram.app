// A switch of the tab's editor mode as one tab edit (docs/specs/007-editor/editor-modes.md "Where
// the mode lives"): the mode, and what entering it brings, together, so one undo puts the tab back
// in the mode it was in exactly as it was. Entering Illustrate puts a board that does not fit its
// first page onto a page made around it (docs/specs/007-editor/illustrate-pages.md "Into pages").
// Pure: tab in, tab out.
import { opensInOf, setTabOpensIn, type EditorMode } from './editor-mode';
import { withContentOnAPage } from './illustrate-paginate';
import type { Tab } from './index';

export type EditorModeSwitch<T> = {
  tab: T;
  // Whether entering Illustrate made a page around the content.
  pagedContent: boolean;
};

/** The tab switched to `mode`, with what the mode brings; the same tab when it is already in it
 *  (or is an event-storming board). */
export function withEditorModeSwitched<T extends Tab>(
  tab: T,
  mode: EditorMode,
): EditorModeSwitch<T> {
  const moded = setTabOpensIn(tab, mode);
  if (moded === tab) return { tab, pagedContent: false };
  if (opensInOf(moded) !== 'illustrate') return { tab: moded, pagedContent: false };
  const paged = withContentOnAPage(moded);
  return paged ? { tab: paged as T, pagedContent: true } : { tab: moded, pagedContent: false };
}
