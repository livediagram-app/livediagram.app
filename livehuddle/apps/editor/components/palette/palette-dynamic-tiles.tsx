import { headlineCase } from '@livehuddle/api-schema';
import type { StickerDef } from '@liveworkspace/icons';
import { StickerArt } from '@/components/canvas/StickerView';
import type { PaletteTileDef } from './palette-tile-defs';

// Dynamic tiles: individual Stickers catalogue entries as palette tiles, for
// the Toolbar layout's strip (toolbar-strip-tiles). Unlike the fixed creation tiles these aren't
// listed in PALETTE_TILES: the catalogues are open-ended and load async (lib/icon-registry), so a
// tile is built from its catalogue entry at render time, under a PREFIXED id
// (`sticker:<stickerId>`). A catalogue name reads in sentence case, so a tile
// Title Cases it (docs/specs/004-interface-design/menus.md "Item labels").

const STICKER_TILE_PREFIX = 'sticker:';

export function stickerTileDef(sticker: StickerDef): PaletteTileDef {
  return {
    id: `${STICKER_TILE_PREFIX}${sticker.id}`,
    section: 'stickers',
    label: `Add ${headlineCase(sticker.label)}`,
    description: 'Drops this sticker at the viewport centre.',
    action: { type: 'sticker', stickerId: sticker.id },
    icon: <StickerArt def={sticker} className="h-[18px] w-[18px]" />,
  };
}
