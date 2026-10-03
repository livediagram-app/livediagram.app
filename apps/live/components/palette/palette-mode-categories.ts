import type { EditorMode } from '@livediagram/document';

// Which palette categories each editor mode offers (docs/specs/007-editor/editor-modes.md
// "The palette per mode"). A mode tunes the tools, so the palette narrows to the categories that
// mode is for: Diagram leaves out the mock-up kit, Design keeps only the mock-up kit and what a
// mock-up is made of. Draw shows its own tools in place of the categories, so it lists none here.
// Favourites stays in every mode: it is the person's own pick, whatever the mode.

// The categories that build a mock-up rather than a diagram.
const DESIGN_ONLY: readonly string[] = ['components', 'devices'];

// Design mode's whole set: layout and type, the mock-up kit, and the logos, glyphs and pictures a
// design is dressed with. Charts, behaviours, stickers, pens and the workshop notation are out.
const DESIGN_CATEGORIES: readonly string[] = [
  'favourites',
  'shapes',
  'my-shapes',
  'write',
  'build',
  'components',
  'devices',
  'icons',
  'technology',
  'media',
];

/** Whether the palette offers category `id` in `mode`. */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  if (mode === 'design') return DESIGN_CATEGORIES.includes(id);
  return !DESIGN_ONLY.includes(id);
}
