import type { EditorMode } from '@livediagram/document';

// What the mode menu's preview shows for each mode beyond the catalogue's name and description
// (docs/specs/007-editor/editor-modes.md "The mode switch"): the mode's tint and its main tools.

// Each mode's tint, used only by the mode menu: the list's tiles and the preview's picture. Text
// tones are -700 on -100 (light) and -300 on a 15% wash (dark), at least 3:1 for the glyphs.
export const MODE_TINT: Readonly<Record<EditorMode, string>> = {
  diagram: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  draw: 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
  workshop: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
};

// The tools a mode brings into focus, as the preview's chips: what changes if you pick it.
export const MODE_TOOLS: Readonly<Record<EditorMode, readonly string[]>> = {
  diagram: ['Shapes', 'Arrows', 'Icons', 'Templates', 'Snapping'],
  draw: ['Pens', 'Highlighter', 'Eraser', 'Shape recognition'],
  workshop: ['Timer', 'Votes', 'Polls', 'Reveals', 'Stickers'],
};

// What choosing a row does: switch, open a new tab across a lock, nothing on the current mode, or
// nothing at all on a locked row with no new tab to offer.
export type ModeMenuAction = 'switch' | 'current';
