import type { EditorMode } from '@livediagram/document';

// What the mode menu's preview shows for each mode beyond the catalogue's name and description
// (docs/specs/007-editor/editor-modes.md "The mode switch"): the mode's tint and its main tools.

// Each mode's tint, used only by the mode menu: the list's tiles and the preview's picture. Text
// tones are -700 on -100 (light) and -300 on a 15% wash (dark), at least 3:1 for the glyphs.
export const MODE_TINT: Readonly<Record<EditorMode, string>> = {
  diagram: 'bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300',
  draw: 'bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
  facilitate: 'bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
  illustrate: 'bg-pink-100 text-pink-700 dark:bg-pink-400/15 dark:text-pink-300',
  plan: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
};

// The preview's button, as solid as the mode's tint: white text on -700 (light, at least 5:1), dark on -300.
export const MODE_ACTION_TINT: Readonly<Record<EditorMode, string>> = {
  diagram:
    'bg-sky-700 text-white hover:bg-sky-800 dark:bg-sky-300 dark:text-slate-900 dark:hover:bg-sky-200',
  draw: 'bg-orange-700 text-white hover:bg-orange-800 dark:bg-orange-300 dark:text-slate-900 dark:hover:bg-orange-200',
  facilitate:
    'bg-violet-700 text-white hover:bg-violet-800 dark:bg-violet-300 dark:text-slate-900 dark:hover:bg-violet-200',
  illustrate:
    'bg-pink-700 text-white hover:bg-pink-800 dark:bg-pink-300 dark:text-slate-900 dark:hover:bg-pink-200',
  plan: 'bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-300 dark:text-slate-900 dark:hover:bg-emerald-200',
};

// The tools a mode brings into focus, as the preview's chips: what changes if you pick it.
export const MODE_TOOLS: Readonly<Record<EditorMode, readonly string[]>> = {
  diagram: ['Shapes', 'Arrows', 'Icons', 'Templates', 'Snapping'],
  draw: ['Pens', 'Highlighter', 'Eraser', 'Shape recognition'],
  facilitate: ['Timer', 'Votes', 'Polls', 'Reveals', 'Stickers'],
  illustrate: ['Infographics', 'Slides', 'Articles', 'Logos'],
  plan: ['Boards', 'Cards', 'Card types', 'Fields'],
};

// What the preview's button says for the mode it shows, as choosing its row would act.
export type ModeMenuAction = 'switch' | 'new-tab' | 'current' | 'inert';

export function modeMenuActionLabel(action: ModeMenuAction, label: string): string {
  switch (action) {
    case 'switch':
      return `Switch to ${label}`;
    case 'new-tab':
      return `Open a New ${label} Tab`;
    case 'current':
      return 'Current Mode';
    case 'inert':
      return 'Can’t Switch Here';
  }
}
