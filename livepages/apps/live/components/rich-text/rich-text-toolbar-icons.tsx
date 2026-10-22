import { EllipsisIcon as SharedEllipsisIcon, lucideGlyph } from '@livediagram/ui';
import { lucideALargeSmall } from '@livediagram/icons/lucide';

import { MENU_ICON_PX } from '@/components/palette/context-menu-icons';
// Inline SVG icons for the rich-text toolbars (the overflow ellipsis and the
// font-family glyph). Pure presentational; split out of RichTextToolbar.
//
// The bullet / numbered / no-list / heading glyphs that lived here went with
// the buttons they labelled: both toolbars now use the block-type picker
// (docs/specs/009-elements/block-type-picker.md), which is a word list, not a row of pictograms.
export function EllipsisIcon() {
  return <SharedEllipsisIcon size={16} />;
}

// The font / typeface glyph for the Font submenu row.
export const FontGlyph = lucideGlyph(lucideALargeSmall, MENU_ICON_PX);
