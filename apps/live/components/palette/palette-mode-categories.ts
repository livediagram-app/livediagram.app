import type { EditorMode } from '@livediagram/document';

// Which palette categories each editor mode offers (docs/specs/007-editor/editor-modes.md
// "The palette per mode"). A mode tunes the tools, so the palette narrows to the categories that
// mode is for: Diagram leaves out the mock-up kit (Components, Devices), Infographic keeps it plus
// the layout, type and decoration a visual page is made of. Draw shows its own tools in place of the categories, so it lists none here.
// Favourites stays in every mode: it is the person's own pick, whatever the mode.

// The categories that build a mock-up rather than a diagram.
const MOCK_UP_KIT: readonly string[] = ['components', 'devices'];

// Infographic mode's whole set: layout and type, the mock-up kit, the glyphs, stickers and
// pictures a visual page is dressed with, and its charts. Behaviours, tech icons, pens and the
// workshop notation are out.
const INFOGRAPHIC_CATEGORIES: readonly string[] = [
  'favourites',
  'shapes',
  'my-shapes',
  'write',
  'build',
  'components',
  'devices',
  'icons',
  'stickers',
  'media',
  'data',
];

/** Whether the palette offers category `id` in `mode`. */
export function paletteCategoryOffered(mode: EditorMode, id: string): boolean {
  if (mode === 'infographic') return INFOGRAPHIC_CATEGORIES.includes(id);
  return !MOCK_UP_KIT.includes(id);
}
