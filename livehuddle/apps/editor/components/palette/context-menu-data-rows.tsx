// Small shared context-menu pieces the per-kind sections reuse: the "None" marker glyph, the Data and Rating
// category glyphs, and the labelled percent slider. Split from context-menu-rows.tsx (which re-exports what it
// needs) so that file keeps the generic look-and-feel rows.

import { MENU_ICON_PX } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import { Glyph, Prims } from '@livehuddle/ui';
import { lucideStar } from '@liveworkspace/icons/lucide';

// A filled star category glyph (the hollow star is the Icon category).
export function RatingMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24} fill="currentColor">
      <Prims prims={lucideStar} />
    </Glyph>
  );
}
