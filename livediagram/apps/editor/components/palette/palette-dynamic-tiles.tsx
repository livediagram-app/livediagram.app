import { headlineCase } from '@livediagram/api-schema';
import type { IconDef, StickerDef, TechIconDef } from '@livediagram/icons';
import { StickerArt } from '@/components/canvas/StickerView';
import { CatalogIconThumb } from '@/components/primitives/icon-glyph';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';
import type { PaletteTileDef } from './palette-tile-defs';

// Dynamic tiles: individual Icons / Stickers / Technology catalogue entries as palette tiles, for
// the Toolbar layout's strip (toolbar-strip-tiles). Unlike the fixed creation tiles these aren't
// listed in PALETTE_TILES: the catalogues are open-ended and load async (lib/icon-registry), so a
// tile is built from its catalogue entry at render time, under a PREFIXED id (`icon:<iconId>`,
// `tech:<iconId>`, `sticker:<stickerId>`). A catalogue name reads in sentence case, so a tile
// Title Cases it (docs/specs/004-interface-design/menus.md "Item labels").

const ICON_TILE_PREFIX = 'icon:';
const TECH_TILE_PREFIX = 'tech:';
const STICKER_TILE_PREFIX = 'sticker:';
// Rendered tile size; TechIconArt weights its glyph for it.
const TECH_TILE_PX = 18;

export function iconTileDef(icon: IconDef): PaletteTileDef {
  return {
    id: `${ICON_TILE_PREFIX}${icon.id}`,
    section: 'icons',
    label: `Add ${headlineCase(icon.label)}`,
    description: 'Drops this icon at the viewport centre, tinted by the element stroke.',
    action: { type: 'icon', iconId: icon.id },
    icon: <CatalogIconThumb iconId={icon.id} />,
  };
}

export function techTileDef(icon: TechIconDef): PaletteTileDef {
  return {
    id: `${TECH_TILE_PREFIX}${icon.id}`,
    section: 'technology',
    label: `Add ${headlineCase(icon.label)}`,
    caption: icon.short ?? icon.label,
    description: 'Drops this technology icon on the canvas.',
    // Full-colour brand art keeps its own colours under any theme.
    noTint: true,
    action: { type: 'tech-icon', iconId: icon.id },
    icon: (
      <svg width={TECH_TILE_PX} height={TECH_TILE_PX} viewBox="0 0 24 24" aria-hidden>
        <TechIconArt iconId={icon.id} sizePx={TECH_TILE_PX} />
      </svg>
    ),
  };
}

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
