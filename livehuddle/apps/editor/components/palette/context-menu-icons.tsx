// Icons of the editor's context menus (element, multi-selection, canvas, layer row). One family
// (docs/specs/004-interface-design/iconography.md, "Size steps"): row and section icons render at
// MENU_ICON_PX, the pinned quick-action buttons at QUICK_ACTION_ICON_PX, all on the 24-unit grid so
// their ink reads the same size. Lucide where it has the meaning; in-house glyphs follow the same grid.
// Option tiles (animation kinds, layout styles, rotation) are previews and keep their own drawing.

import { Glyph, LinkIcon, lucideGlyph } from '@livehuddle/ui';
import { lucideArrowLeftRight } from '@liveworkspace/icons/lucide';
import { MENU_ICON_PX } from '@liveworkspace/workbench/components/palette/context-menu-icons';

// The link glyph is the shared drawing (@livehuddle/ui), at the menu step: a link card's Link section uses it.
export function LinkMenuIcon() {
  return <LinkIcon size={MENU_ICON_PX} />;
}

// The room menu's "Walls" section (docs/specs/009-elements/office.md "Glass walls"): a run of bricks, the wall itself,
// on the 24-unit grid as the Lucide glyphs are; its Solid and Glass tiles draw the two wall styles.
export function WallsMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9.33h18M3 14.67h18M12 4v5.33M7.5 9.33v5.34M16.5 9.33v5.34M12 14.67V20" />
    </Glyph>
  );
}
// A room's Floor section (docs/specs/009-elements/office.md "Floors"): a square of boards laid in offset rows.
export function FloorMenuGlyph() {
  return (
    <Glyph size={MENU_ICON_PX} units={24}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M10 3v6M15 9v6M8 15v6" />
    </Glyph>
  );
}
// The piece menu's "Type" section (docs/specs/009-elements/office.md "A piece's type"): two arrows passing, a piece
// swapped for another of its kind in place.
export const TypeMenuGlyph = lucideGlyph(lucideArrowLeftRight, MENU_ICON_PX);
