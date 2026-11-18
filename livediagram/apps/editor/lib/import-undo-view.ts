// Where the view goes when the person's own undo or redo crosses an import (docs/specs/008-canvas/canvas-and-palette.md
// "Undoing an import brings its view back"). The view is not in history, so an undo leaves it alone, except across an
// import, which replaced the tab's content and framed it: undone, the view goes back to where it was before the
// import; redone, the tab lands on the import again. Pure, so the rule is tested without a canvas.

import type { Tab } from '@livediagram/document';
import type { ViewPose } from '@liveworkspace/workbench/lib/viewport-glide';

// The latest import: the tab it landed on, the ids of what it landed, and the view it started from.
export type ImportViewMark = {
  tabId: string;
  ids: ReadonlySet<string>;
  before: ViewPose;
};

// 'restore': put the view back to `mark.before`. 'land': frame the tab as the import did. null: leave the view.
export type ImportViewMove = 'restore' | 'land' | null;

// Whether the mark's tab holds any element the import landed. Linear in that tab's elements.
function holdsImport(tabs: readonly Tab[], mark: ImportViewMark): boolean {
  const tab = tabs.find((t) => t.id === mark.tabId);
  return !!tab && tab.elements.some((el) => mark.ids.has(el.id));
}

/** The view move an undo or redo from `before` to `after` asks for, with `activeId` the tab on screen. */
export function importViewMove(
  mark: ImportViewMark | null,
  before: readonly Tab[],
  after: readonly Tab[],
  activeId: string,
): ImportViewMove {
  // Only the tab the import landed on, while it is the one on screen: an undo that reaches another tab's import
  // must not move this tab's view.
  if (!mark || mark.ids.size === 0 || activeId !== mark.tabId) return null;
  const was = holdsImport(before, mark);
  const now = holdsImport(after, mark);
  if (was && !now) return 'restore';
  if (!was && now) return 'land';
  return null;
}
