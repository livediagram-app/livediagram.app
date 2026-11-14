import { changesType, variantsOf } from '@livehuddle/document';
import {
  CORRIDOR_PRESET_TILES,
  DOOR_PRESET_TILES,
  RUG_PRESET_TILES,
} from './palette-floor-presets';
import { ROOM_TILES } from './tile-defs/room-tiles';
import type { PaletteTileDef } from './tile-defs/types';
import { tileDisplayName } from './palette-tile-defs';

// The element menu's Type section's choices (docs/specs/009-elements/office.md "A piece's type"): a kind's palette
// cards, so the menu names and draws each type exactly as the palette does, in the palette's order.

const TABLE_TILES = ['tools:meeting-table', 'tools:long-table'].map((id) =>
  ROOM_TILES.find((t) => t.id === id)!,
);

const TYPE_TILES: Readonly<Record<string, readonly PaletteTileDef[]>> = {
  door: DOOR_PRESET_TILES,
  rug: RUG_PRESET_TILES,
  corridor: CORRIDOR_PRESET_TILES,
  'meeting-table': TABLE_TILES,
};

/** One type a piece can take: its stored name, and the caption and glyph its palette card shows. */
export type PieceTypeChoice = { type: string; label: string; icon: React.ReactNode };

/** The types a kind's Type section offers, in palette order; none for a kind whose type the menu does not change. */
export function pieceTypeChoices(kind: string): PieceTypeChoice[] {
  if (!changesType(kind)) return [];
  const first = variantsOf(kind)[0]!;
  return TYPE_TILES[kind]!.map((tile) => {
    // Every Type tile places a shape; its `variant` is the type, absent for the first.
    const { variant } = tile.action as { variant?: string };
    return { type: variant ?? first, label: tileDisplayName(tile), icon: tile.icon };
  });
}
